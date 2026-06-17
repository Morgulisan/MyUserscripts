// ==UserScript==
// @name         tecis Dokumente Datenbank
// @namespace    http://tampermonkey.net/
// @version      1.8.4
// @description  Vorbefüllte PDFs und Anträge mit einem Click in die Beratungsmappe laden: HEK, hkk, Erhöhungen und Kampagnen
// @author       Malte Kretzschmar
// @match        https://bm.bp.vertrieb-plattform.de/bm/*
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @grant        GM_addStyle
// @connect      mopoliti.de
// @connect      www.crm.vertrieb-plattform.de
// @require      https://mopoliti.de/Userscripts/libraries/pdf-lib.js
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tecis.de
// ==/UserScript==

(function () {
'use strict';

// GENERATED FILE - DO NOT EDIT DIRECTLY.
// Source of truth lives under src/core and src/adapters.

async function initDokumenteDatenbank({ fetchJson, addCss, PDFLibRef = PDFLib }) {

    try {
        addCss(`
        div.awd-content-fixed { top: 80px !important; }
        div.awd-concept-title-buttons { height: 85px !important; }
    `);
    } catch (e){

    }

    const { PDFDocument } = PDFLibRef;

    // --- ⬇️ EDIT THIS SECTION FOR CONCATENATION RULES ⬇️ ---
    // This map defines reusable concatenation rules. The server can refer to these
    // rules by their key (e.g., "concat_Name_Vorname").
    const concatenationMap = {
        // CORRECTED: Using a filter that checks for the primary address flag ("primaer": true)
        "concat_Strasse_Hausnummer" : ["$.adressen[?(@.primaer==true)].strasseHausnummer.strasse", " ", "$.adressen[?(@.primaer==true)].strasseHausnummer.hausNr"],
        "concat_PLZ_Ort" : ["$.adressen[?(@.primaer==true)].plzOrt.postleitzahl", " ", "$.adressen[?(@.primaer==true)].plzOrt.ort"],
        "concat_Name_Vorname": ["$.nachname",  ", ",  "$.vorname"],
        "concat_Vorname_Nachname": ["$.vorname",  " ",  "$.nachname"],
    };
    // --- ⬆️ END OF EDITABLE SECTION ⬆️ ---

    const pdfTemplatesUrl = 'https://mopoliti.de/tecis/Store/get_pdf_templates.php';

    function base64ToBlob(base64, contentType = 'application/pdf') {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        return new Blob([new Uint8Array(byteNumbers)], { type: contentType });
    }

    async function fetchPdfTemplates() {
        const data = await fetchJson(pdfTemplatesUrl);
        if (data.status === 'success' && Array.isArray(data.templates)) {
            return data.templates;
        }
        throw new Error(data.message || 'Error retrieving PDF templates');
    }

    async function fetchTemplatePdfBlob(template, personalData = {}) {
        const pdfData = await fetchJson(template.pdf_url);
        if (pdfData.status !== 'success' || !pdfData.pdf) {
            throw new Error(pdfData.message || 'Error fetching PDF file');
        }

        let pdfBlob = base64ToBlob(pdfData.pdf, 'application/pdf');
        try {
            const existingPdfBytes = await pdfBlob.arrayBuffer();
            const pdfDoc = await PDFDocument.load(existingPdfBytes);
            const form = pdfDoc.getForm();
            const mappings = template.field_mappings || {};

            for (const [pdfFieldName, dataKey] of Object.entries(mappings)) {
                try {
                    let finalValue;
                    if (dataKey === '$HEUTE') {
                        const today = new Date();
                        const dd = String(today.getDate()).padStart(2, '0');
                        const mm = String(today.getMonth() + 1).padStart(2, '0');
                        const yyyy = today.getFullYear();
                        finalValue = `${dd}.${mm}.${yyyy}`;
                    } else if (concatenationMap.hasOwnProperty(dataKey)) {
                        const ruleParts = concatenationMap[dataKey];
                        const resolvedParts = ruleParts.map(part => {
                            if (typeof part === 'string' && part.startsWith('$')) {
                                return resolveJsonPath(personalData, part) || '';
                            }
                            return part;
                        });
                        finalValue = resolvedParts.join('');
                    } else {
                        finalValue = resolveJsonPath(personalData, dataKey) || "";
                    }

                    form.getTextField(pdfFieldName).setText(String(finalValue));
                } catch (e) {
                    console.warn(`Field "${pdfFieldName}" with rule "${dataKey}" could not be set.`, e);
                }
            }

            const newPdfBytes = await pdfDoc.save();
            pdfBlob = new Blob([newPdfBytes], { type: 'application/pdf' });
        } catch (err) {
            console.warn("PDFLib processing failed. Using original PDF.", err);
        }
        return pdfBlob;
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function getMandantenNrFromUrlOrStorage() {
        const params = new URLSearchParams(location.search);
        const current = params.get('mandantennr');
        if (current) {
            sessionStorage.setItem('tecis-store-mandantennr', current);
            return current;
        }
        return sessionStorage.getItem('tecis-store-mandantennr');
    }

    function decodeMandantenNr(mandantennr) {
        if (!mandantennr) return null;
        try {
            const decoded = atob(mandantennr);
            return /^\d+$/.test(decoded) ? decoded : null;
        } catch (err) {
            console.warn('Could not decode mandantennr.', err);
            return null;
        }
    }

    function pickPersonalDataCandidate(data) {
        if (!data || typeof data !== 'object') return {};
        const directCandidates = [
            data.personalien,
            data.person,
            data.kunde,
            data.kundenDaten,
            data.mandant,
            data.versicherungsNehmer,
            data.haushalt?.personalien,
            data.haushalt?.person,
            data.haushalt?.kunde
        ];
        for (const candidate of directCandidates) {
            if (candidate && typeof candidate === 'object') return candidate;
        }
        const arrayCandidates = [
            data.resultData,
            data.personen,
            data.kunden,
            data.mandanten,
            data.haushalt?.personen,
            data.haushalt?.kunden,
            data.haushalt?.mandanten
        ];
        for (const candidate of arrayCandidates) {
            if (Array.isArray(candidate) && candidate.length && typeof candidate[0] === 'object') {
                return candidate[0];
            }
        }
        return data;
    }

    async function fetchFrontendPersonalData(mandantennr) {
        if (!mandantennr) return {};
        try {
            const url = 'https://bm.bp.vertrieb-plattform.de/api/service/haushalt?mandantenNr=' + encodeURIComponent(mandantennr);
            const data = await fetchJson(url);
            const candidate = pickPersonalDataCandidate(data);
            console.log('PDF Store BM 2.0: Haushalt/Personendaten geladen.', candidate);
            return candidate || {};
        } catch (err) {
            console.warn('PDF Store BM 2.0: Personendaten konnten nicht geladen werden.', err);
            return {};
        }
    }

    function findButtonByLabel(labelText) {
        return Array.from(document.querySelectorAll('button')).find(button => {
            const label = button.querySelector('[data-slot="label"]') || button;
            return label.textContent.trim() === labelText;
        });
    }

    function normalizeLabel(value) {
        return String(value || '').replace(/\s+/g, ' ').trim();
    }

    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function waitForElement(selector, { timeoutMs = 10000, visible = false } = {}) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const timer = setInterval(() => {
                const el = document.querySelector(selector);
                const isVisible = !visible || (el && el.getClientRects().length > 0);
                if (el && isVisible) {
                    clearInterval(timer);
                    resolve(el);
                    return;
                }
                if (Date.now() - start > timeoutMs) {
                    clearInterval(timer);
                    reject(new Error(`Timeout waiting for ${selector}`));
                }
            }, 100);
        });
    }

    function waitForPredicate(predicate, { timeoutMs = 10000, intervalMs = 100, label = 'condition' } = {}) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const timer = setInterval(() => {
                try {
                    const result = predicate();
                    if (result) {
                        clearInterval(timer);
                        resolve(result);
                        return;
                    }
                } catch (err) {
                    // Keep polling; transient DOM states are expected in the Nuxt wizard.
                }
                if (Date.now() - start > timeoutMs) {
                    clearInterval(timer);
                    reject(new Error(`Timeout waiting for ${label}`));
                }
            }, intervalMs);
        });
    }

    function setNativeValue(input, value) {
        const proto = Object.getPrototypeOf(input);
        const desc = Object.getOwnPropertyDescriptor(proto, 'value') ||
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        if (desc && desc.set) {
            desc.set.call(input, value);
        } else {
            input.value = value;
        }
        input._value = value;
        input.setAttribute('value', value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function getNextFirstOfMonthMoreThanTenDaysOut(baseDate = new Date()) {
        const threshold = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + 10);
        let candidate = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
        if (candidate <= threshold) {
            candidate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
        }
        while (candidate <= threshold) {
            candidate = new Date(candidate.getFullYear(), candidate.getMonth() + 1, 1);
        }
        const yyyy = String(candidate.getFullYear());
        const month = candidate.getMonth() + 1;
        const day = candidate.getDate();
        const mm = String(month).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        return {
            date: candidate,
            yyyy,
            mm,
            dd,
            visibleMonth: String(month),
            visibleDay: String(day),
            iso: `${yyyy}-${mm}-${dd}`,
            display: `${day}.${month}.${yyyy}`
        };
    }

    function dispatchEditableInput(target, value, inputType = 'insertText') {
        target.dispatchEvent(new InputEvent('beforeinput', {
            bubbles: true,
            cancelable: true,
            inputType,
            data: value
        }));
        if (inputType === 'deleteContentBackward') {
            target.textContent = '';
        } else if (document.execCommand) {
            document.execCommand('insertText', false, value);
        } else {
            target.textContent = (target.textContent || '') + value;
        }
        target.dispatchEvent(new InputEvent('input', {
            bubbles: true,
            inputType,
            data: value
        }));
    }

    async function typeIntoContentEditableSegment(segment, value) {
        if (!segment) return;
        segment.focus();
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(segment);
        selection.removeAllRanges();
        selection.addRange(range);
        segment.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Backspace', code: 'Backspace' }));
        dispatchEditableInput(segment, '', 'deleteContentBackward');
        segment.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Backspace', code: 'Backspace' }));
        for (const char of String(value)) {
            const digitCode = /^\d$/.test(char) ? 'Digit' + char : '';
            segment.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: char, code: digitCode }));
            dispatchEditableInput(segment, char, 'insertText');
            segment.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: char, code: digitCode }));
            await wait(15);
        }
        if (segment.textContent !== value) {
            segment.textContent = value;
            segment.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                inputType: 'insertReplacementText',
                data: value
            }));
        }
        segment.removeAttribute('data-placeholder');
        segment.setAttribute('aria-valuenow', value);
        segment.setAttribute('aria-valuetext', value);
        segment.dispatchEvent(new Event('change', { bubbles: true }));
        segment.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab', code: 'Tab' }));
        segment.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Tab', code: 'Tab' }));
        segment.blur();
        segment.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    }

    function isVisibleElement(el) {
        return !!(el && el.getClientRects().length > 0);
    }

    function findBeginnDateTrigger(dateGroup) {
        const scope = dateGroup?.closest('.flex, [data-slot="field"], [data-slot="item"], label')?.parentElement ||
            dateGroup?.parentElement ||
            document;
        return scope.querySelector('[aria-haspopup="dialog"][aria-controls], [class*="i-custom:calendar"]') ||
            document.querySelector('[aria-haspopup="dialog"][aria-controls][id*="popover-trigger"], [class*="i-custom:calendar"]');
    }

    function getOpenDatePopover(trigger) {
        const controls = trigger?.getAttribute('aria-controls');
        if (controls) {
            const controlled = document.getElementById(controls);
            if (isVisibleElement(controlled)) return controlled;
        }
        return Array.from(document.querySelectorAll('[id^="reka-popover-content"], [data-radix-popper-content-wrapper], [role="dialog"][data-state="open"]'))
            .find(el => isVisibleElement(el) && normalizeLabel(el.textContent));
    }

    function isDisabledChoice(el) {
        return !!(el.disabled ||
            el.getAttribute('aria-disabled') === 'true' ||
            el.hasAttribute('disabled') ||
            el.hasAttribute('data-disabled') ||
            el.closest('[aria-disabled="true"], [disabled], [data-disabled]'));
    }

    function findCalendarDayButton(root, dateParts) {
        if (!root) return null;
        const day = String(dateParts.date.getDate());
        const candidates = Array.from(root.querySelectorAll('button, [role="button"], [role="gridcell"], [data-slot*="cell"], [data-reka-calendar-cell-trigger]'))
            .filter(el => isVisibleElement(el) && !isDisabledChoice(el));
        return candidates.find(el => {
            const valueAttrs = [
                el.getAttribute('data-value'),
                el.getAttribute('data-date'),
                el.getAttribute('aria-label'),
                el.getAttribute('title')
            ].filter(Boolean).join(' ');
            if (valueAttrs.includes(dateParts.iso) || valueAttrs.includes(dateParts.display)) return true;
            const text = normalizeLabel(el.textContent);
            return text === day;
        });
    }

    function findCalendarNextButton(root) {
        const controls = Array.from(root.querySelectorAll('button, [role="button"], [aria-label], [title]'))
            .filter(el => isVisibleElement(el) && !isDisabledChoice(el));
        return controls.find(el => {
            const label = normalizeLabel([
                el.getAttribute('aria-label'),
                el.getAttribute('title'),
                el.textContent,
                el.className
            ].filter(Boolean).join(' ')).toLowerCase();
            return /next|weiter|näch|naech|folgend|vorwärts|vorwaerts|right|arrow-right|chevron-right|small-arrow-right/.test(label);
        }) || controls[controls.length - 1] || null;
    }

    function isBeginnDateAccepted(dateParts) {
        const dateGroup = document.querySelector('.custom-date-input');
        const dateInput = document.querySelector('input[name="beginn"]');
        return dateInput?.value === dateParts.iso && dateGroup?.getAttribute('aria-invalid') === 'false';
    }

    async function setBeginnDateViaCalendar(dateParts) {
        const dateGroup = document.querySelector('.custom-date-input');
        const dateInput = document.querySelector('input[name="beginn"]');
        const trigger = findBeginnDateTrigger(dateGroup);
        if (!trigger) return false;
        dispatchActivationEvents(trigger);
        let popover = await waitForPredicate(() => getOpenDatePopover(trigger), {
            timeoutMs: 1500,
            intervalMs: 50,
            label: 'open Beginn calendar'
        }).catch(() => null);
        if (!popover) return false;

        let targetDay = findCalendarDayButton(popover, dateParts);
        for (let i = 0; !targetDay && i < 14; i++) {
            const nextButton = findCalendarNextButton(popover);
            if (!nextButton) break;
            dispatchActivationEvents(nextButton);
            await wait(100);
            popover = getOpenDatePopover(trigger) || popover;
            targetDay = findCalendarDayButton(popover, dateParts);
        }
        if (!targetDay) return false;
        dispatchActivationEvents(targetDay);
        await waitForPredicate(() => dateInput?.value === dateParts.iso || isBeginnDateAccepted(dateParts), {
            timeoutMs: 1500,
            intervalMs: 50,
            label: 'Beginn calendar selection'
        }).catch(() => null);
        dateGroup?.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        return isBeginnDateAccepted(dateParts) || dateInput?.value === dateParts.iso;
    }

    async function setBeginnDateViaSegments(dateParts) {
        const dateGroup = document.querySelector('.custom-date-input');
        const dateInput = document.querySelector('input[name="beginn"]');
        const daySegment = document.querySelector('[data-segment="day"], [data-reka-date-field-segment="day"]');
        const monthSegment = document.querySelector('[data-segment="month"], [data-reka-date-field-segment="month"]');
        const yearSegment = document.querySelector('[data-segment="year"], [data-reka-date-field-segment="year"]');

        dateGroup?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        dateGroup?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await typeIntoContentEditableSegment(daySegment, dateParts.visibleDay);
        await wait(50);
        await typeIntoContentEditableSegment(monthSegment, dateParts.visibleMonth);
        await wait(50);
        await typeIntoContentEditableSegment(yearSegment, dateParts.yyyy);
        await wait(50);
        if (dateInput) {
            setNativeValue(dateInput, dateParts.iso);
        }
        dateGroup?.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: dateParts.display }));
        dateGroup?.dispatchEvent(new Event('change', { bubbles: true }));
        dateGroup?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', code: 'Enter' }));
        dateGroup?.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter', code: 'Enter' }));
        dateGroup?.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        if (dateInput) {
            dateInput.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        }
        await wait(150);
    }

    async function setBeginnDateField(dateParts) {
        const calendarAccepted = await setBeginnDateViaCalendar(dateParts).catch(err => {
            console.warn('PDF Store BM 2.0: Beginn-Kalenderauswahl fehlgeschlagen, nutze Segment-Fallback.', err);
            return false;
        });
        if (!calendarAccepted) {
            await setBeginnDateViaSegments(dateParts);
        }
        const dateInput = document.querySelector('input[name="beginn"]');
        const daySegment = document.querySelector('[data-segment="day"], [data-reka-date-field-segment="day"]');
        const monthSegment = document.querySelector('[data-segment="month"], [data-reka-date-field-segment="month"]');
        const yearSegment = document.querySelector('[data-segment="year"], [data-reka-date-field-segment="year"]');
        console.log('PDF Store BM 2.0: Beginn gesetzt', {
            iso: dateInput?.value,
            display: `${daySegment?.textContent}.${monthSegment?.textContent}.${yearSegment?.textContent}`,
            via: calendarAccepted ? 'calendar' : 'segments'
        });
    }

    function findRadioByLabel(label, root = document) {
        const targetLabel = normalizeLabel(label);
        if (!targetLabel) return null;
        return Array.from(root.querySelectorAll('[role="radio"]')).find(radio => {
            const aria = normalizeLabel(radio.getAttribute('aria-label'));
            let labelText = '';
            if (radio.id) {
                labelText = normalizeLabel(root.querySelector(`label[for="${CSS.escape(radio.id)}"]`)?.textContent || document.querySelector(`label[for="${CSS.escape(radio.id)}"]`)?.textContent);
            }
            const rowText = normalizeLabel(radio.closest('[data-slot="item"]')?.textContent);
            return aria === targetLabel || labelText === targetLabel || rowText === targetLabel;
        });
    }

    function findTextElementByExactLabel(label, root = document) {
        const targetLabel = normalizeLabel(label);
        if (!targetLabel) return null;
        const selectors = [
            'label',
            '[data-slot="label"]',
            '[role="option"]',
            '[data-slot="item"]',
            'button',
            'span'
        ];
        for (const selector of selectors) {
            const match = Array.from(root.querySelectorAll(selector)).find(el => normalizeLabel(el.textContent) === targetLabel);
            if (match) return match;
        }
        return null;
    }

    function findActivatableForTextElement(el) {
        if (!el) return null;
        if (el.htmlFor) {
            const forTarget = document.getElementById(el.htmlFor);
            if (forTarget) return forTarget;
        }
        const item = el.closest('[data-slot="item"]');
        return item?.querySelector('[role="radio"], button, [role="option"]') ||
            el.closest('button,[role="radio"],[role="option"]') ||
            el;
    }

    function findAccordionTriggerByLabel(label) {
        const targetLabel = normalizeLabel(label);
        return Array.from(document.querySelectorAll('[data-slot="header"] button[data-slot="trigger"], button[data-slot="trigger"]')).find(button => {
            return normalizeLabel(button.querySelector('[data-slot="label"]')?.textContent || button.textContent) === targetLabel;
        });
    }

    function getAccordionContentForTrigger(trigger) {
        const controls = trigger?.getAttribute('aria-controls');
        if (controls) {
            const controlled = document.getElementById(controls);
            if (controlled) return controlled;
        }
        const item = trigger?.closest('[data-slot="item"]');
        return item?.querySelector('[data-slot="content"], [role="region"]') ||
            trigger?.parentElement?.nextElementSibling ||
            null;
    }

    function dispatchActivationEvents(el) {
        el.scrollIntoView({ block: 'center', inline: 'nearest' });
        el.focus?.();
        el.click();
    }

    function isRadioChecked(radio) {
        return radio.getAttribute('aria-checked') === 'true' || radio.getAttribute('data-state') === 'checked';
    }

    async function clickRadioByLabel(label, { required = true, root = document } = {}) {
        const targetLabel = normalizeLabel(label);
        if (!targetLabel) return false;
        const radio = await waitForPredicate(() => findRadioByLabel(targetLabel, root) || findActivatableForTextElement(findTextElementByExactLabel(targetLabel, root)), {
            timeoutMs: 1500,
            label: `selection ${targetLabel}`
        }).catch(err => {
            if (required) throw err;
            return null;
        });
        if (!radio) return false;
        dispatchActivationEvents(radio);
        await waitForPredicate(() => isRadioChecked(radio), {
            timeoutMs: 1500,
            intervalMs: 100,
            label: `checked radio ${targetLabel}`
        });
        console.log('PDF Store BM 2.0: Auswahl gesetzt', targetLabel, {
            checked: radio.getAttribute('aria-checked'),
            state: radio.getAttribute('data-state')
        });
        return true;
    }

    async function selectSonstigeFallback() {
        const sonstigeTrigger = await waitForPredicate(() => findAccordionTriggerByLabel('Sonstige'), {
            timeoutMs: 1500,
            label: 'Sonstige accordion trigger'
        });
        if (sonstigeTrigger.getAttribute('aria-expanded') !== 'true') {
            dispatchActivationEvents(sonstigeTrigger);
            await wait(150);
        }
        const content = await waitForPredicate(() => {
            const region = getAccordionContentForTrigger(sonstigeTrigger);
            return region && !region.hidden ? region : null;
        }, {
            timeoutMs: 1500,
            label: 'Sonstige accordion content'
        });
        await clickRadioByLabel('Sonstige', { required: true, root: content });
        console.log('PDF Store BM 2.0: Fallback Sonstige gewählt.');
        return true;
    }

    async function selectWizardClassificationOrFallback({ art, kategorisierung, gespraechsnotizName }) {
        if (!art || !kategorisierung) {
            await selectSonstigeFallback();
            return;
        }
        try {
            await clickRadioByLabel(art);
            await clickRadioByLabel(kategorisierung);
            if (gespraechsnotizName) {
                await waitForPredicate(() => normalizeLabel(document.body.textContent).includes(gespraechsnotizName), {
                    timeoutMs: 1500,
                    label: `rendered product ${gespraechsnotizName}`
                });
                await clickRadioByLabel(gespraechsnotizName, { required: true });
            }
        } catch (err) {
            console.warn('PDF Store BM 2.0: Wizard-Auswahl unvollständig, fallback auf Sonstige.', {
                art,
                kategorisierung,
                gespraechsnotizName,
                error: err
            });
            await selectSonstigeFallback();
        }
    }

    function makeTemplateFilename(template) {
        const filenameBase = (template.name || template.button_name || 'Antrag').replace(/[\\/:*?"<>|]+/g, '_');
        return `${filenameBase}.pdf`;
    }

    async function openNewVorgangWizard() {
        if (!location.href.includes('/bm-frontend/eigenevorgaenge')) {
            history.pushState({}, '', '/bm-frontend/eigenevorgaenge');
            window.dispatchEvent(new PopStateEvent('popstate'));
            await wait(150);
        }
        const button = findButtonByLabel('Neuer Vorgang');
        if (!button) throw new Error('Der Button "Neuer Vorgang" wurde nicht gefunden.');
        button.click();
        await waitForPredicate(() => normalizeLabel(document.body.textContent).includes('Vorgang anlegen'), {
            timeoutMs: 1500,
            label: 'Vorgang anlegen view'
        });
    }

    async function fillFrontendWizard(template, pdfBlob) {
        const art = normalizeLabel(template.art);
        const kategorisierung = normalizeLabel(template.kategorisierung);
        const gespraechsnotizName = normalizeLabel(template.gespraechsnotiz_name);

        await openNewVorgangWizard();
        await selectWizardClassificationOrFallback({ art, kategorisierung, gespraechsnotizName });

        const weiter = await waitForPredicate(() => {
            const button = document.querySelector('#weiter') || findButtonByLabel('Weiter');
            return button && !button.disabled ? button : null;
        }, { timeoutMs: 1500, label: 'enabled Weiter button' });
        weiter.click();

        const uploadInput = await waitForElement('#assetsFieldHandle', { timeoutMs: 1500 });
        const titleInput = document.querySelector('input[name="vorgangBezeichnung"]');
        if (titleInput) {
            setNativeValue(titleInput, template.name || template.button_name || 'Antrag');
        }

        await setBeginnDateField(getNextFirstOfMonthMoreThanTenDaysOut());

        const file = new File([pdfBlob], makeTemplateFilename(template), { type: 'application/pdf' });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        uploadInput.files = dataTransfer.files;
        uploadInput.dispatchEvent(new Event('input', { bubbles: true }));
        uploadInput.dispatchEvent(new Event('change', { bubbles: true }));

        const anlegen = await waitForPredicate(() => {
            const anlegenButton = document.querySelector('#anlegen') || findButtonByLabel('Anlegen');
            return anlegenButton && !anlegenButton.disabled ? anlegenButton : null;
        }, { timeoutMs: 1500, label: 'enabled Anlegen button after date/file autofill' }).catch(err => {
            console.warn('PDF Store BM 2.0: Anlegen blieb nach Beginn-/PDF-Autofill deaktiviert. Date validation may not have accepted the value.', err);
            return null;
        });
        if (anlegen) {
            dispatchActivationEvents(anlegen);
            console.log('PDF Store BM 2.0: Vorgang angelegt.');
        }
        return { file, submitted: !!anlegen };
    }

    async function initFrontendStore() {
        addCss(`
            .tecis-store-launcher {
                position: fixed;
                right: 24px;
                bottom: 88px;
                z-index: 2147483000;
                border: 0;
                border-radius: 999px;
                background: #163b5c;
                color: white;
                min-width: 44px;
                height: 44px;
                padding: 0 16px;
                box-shadow: 0 14px 34px rgba(16, 24, 40, .22);
                cursor: pointer;
                font: 600 14px/1.2 system-ui, -apple-system, Segoe UI, sans-serif;
            }
            .tecis-store-overlay {
                position: fixed;
                inset: 0;
                z-index: 2147483001;
                background: rgba(15, 23, 42, .28);
                display: none;
                align-items: flex-start;
                justify-content: flex-end;
                padding: 72px 28px 28px;
                box-sizing: border-box;
            }
            .tecis-store-overlay[data-open="true"] { display: flex; }
            .tecis-store-panel {
                width: min(520px, calc(100vw - 32px));
                max-height: calc(100vh - 112px);
                overflow: hidden;
                display: flex;
                flex-direction: column;
                background: #fff;
                color: #172033;
                border: 1px solid rgba(15, 23, 42, .12);
                border-radius: 8px;
                box-shadow: 0 24px 80px rgba(15, 23, 42, .24);
                font: 14px/1.45 system-ui, -apple-system, Segoe UI, sans-serif;
            }
            .tecis-store-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
                padding: 18px 20px;
                border-bottom: 1px solid #e5e7eb;
            }
            .tecis-store-title { margin: 0; font-size: 18px; font-weight: 700; }
            .tecis-store-close {
                border: 0;
                background: transparent;
                color: #334155;
                cursor: pointer;
                font-size: 24px;
                line-height: 1;
                padding: 2px 6px;
            }
            .tecis-store-body {
                overflow: auto;
                padding: 14px 20px 20px;
            }
            .tecis-store-search {
                width: 100%;
                height: 38px;
                box-sizing: border-box;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                background: #fff;
                color: #0f172a;
                padding: 0 11px;
                margin: 0 0 14px;
                font: 14px/1.2 system-ui, -apple-system, Segoe UI, sans-serif;
                outline: none;
            }
            .tecis-store-search:focus {
                border-color: #163b5c;
                box-shadow: 0 0 0 2px rgba(22, 59, 92, .15);
            }
            .tecis-store-status {
                margin: 0 0 10px;
                color: #475569;
                font-size: 13px;
            }
            .tecis-store-list {
                display: grid;
                gap: 10px;
            }
            .tecis-store-card {
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 12px;
                display: grid;
                gap: 10px;
                background: #fff;
            }
            .tecis-store-card-title {
                font-weight: 650;
                color: #0f172a;
            }
            .tecis-store-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }
            .tecis-store-action {
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                background: #fff;
                color: #0f172a;
                cursor: pointer;
                padding: 7px 10px;
                font-weight: 600;
            }
            .tecis-store-action[data-primary="true"] {
                border-color: #163b5c;
                background: #163b5c;
                color: #fff;
            }
            .tecis-store-action:disabled {
                opacity: .6;
                cursor: wait;
            }
            .tecis-store-empty {
                color: #64748b;
                border: 1px dashed #cbd5e1;
                border-radius: 8px;
                padding: 14px;
                text-align: center;
            }
        `);

        const mandantennr = getMandantenNrFromUrlOrStorage();
        const customerID = decodeMandantenNr(mandantennr);
        let personalData = {};
        let templates = [];
        let statusText = 'Lade PDF-Templates...';

        const launcher = document.createElement('button');
        launcher.type = 'button';
        launcher.className = 'tecis-store-launcher';
        launcher.textContent = 'PDF Store';

        const overlay = document.createElement('div');
        overlay.className = 'tecis-store-overlay';
        overlay.innerHTML = `
            <section class="tecis-store-panel" role="dialog" aria-modal="true" aria-label="PDF Store">
                <div class="tecis-store-header">
                    <h2 class="tecis-store-title">PDF Store</h2>
                    <button type="button" class="tecis-store-close" aria-label="Schließen">×</button>
                </div>
                <div class="tecis-store-body">
                    <p class="tecis-store-status"></p>
                    <input type="search" class="tecis-store-search" placeholder="PDF-Templates suchen" aria-label="PDF-Templates suchen">
                    <div class="tecis-store-list"></div>
                </div>
            </section>
        `;

        document.body.appendChild(launcher);
        document.body.appendChild(overlay);

        const searchEl = overlay.querySelector('.tecis-store-search');
        const statusEl = overlay.querySelector('.tecis-store-status');
        const listEl = overlay.querySelector('.tecis-store-list');

        function matchesTemplateSearch(template, query) {
            if (!query) return true;
            const haystack = [
                template.button_name,
                template.name,
                template.gespraechsnotiz_name,
                template.kategorisierung,
                template.art,
                template.id
            ].map(value => normalizeLabel(value).toLowerCase()).join(' ');
            return haystack.includes(query);
        }

        function render() {
            statusEl.textContent = statusText;
            listEl.innerHTML = '';
            const query = normalizeLabel(searchEl.value).toLowerCase();
            const visibleTemplates = templates.filter(template => matchesTemplateSearch(template, query));
            if (!visibleTemplates.length && templates.length) {
                const empty = document.createElement('div');
                empty.className = 'tecis-store-empty';
                empty.textContent = 'Keine passenden PDF-Templates gefunden.';
                listEl.appendChild(empty);
                return;
            }
            visibleTemplates.forEach(template => {
                const card = document.createElement('div');
                card.className = 'tecis-store-card';
                card.innerHTML = `
                    <div class="tecis-store-card-title"></div>
                    <div class="tecis-store-actions">
                        <button type="button" class="tecis-store-action" data-primary="true" data-action="autofill">Vorgang + PDF anlegen</button>
                        <button type="button" class="tecis-store-action" data-action="download">PDF herunterladen</button>
                    </div>
                `;
                card.querySelector('.tecis-store-card-title').textContent = template.button_name || template.name || `Template ${template.id}`;
                card.querySelector('[data-action="autofill"]').addEventListener('click', async (event) => {
                    const button = event.currentTarget;
                    button.disabled = true;
                    button.textContent = 'Öffne Wizard...';
                    try {
                        const pdfBlob = await fetchTemplatePdfBlob(template, personalData);
                        overlay.dataset.open = 'false';
                        const result = await fillFrontendWizard(template, pdfBlob);
                        if (!result.submitted) {
                            alert('PDF wurde eingesetzt. Bitte Pflichtfelder prüfen; "Anlegen" ist noch deaktiviert.');
                        }
                    } catch (err) {
                        console.error('Could not prepare BM 2.0 Vorgang.', err);
                        alert('Vorgang konnte nicht automatisch vorbereitet werden. Details stehen in der Konsole.');
                    } finally {
                        button.disabled = false;
                        button.textContent = 'Vorgang + PDF anlegen';
                    }
                });
                card.querySelector('[data-action="download"]').addEventListener('click', async (event) => {
                    const button = event.currentTarget;
                    button.disabled = true;
                    button.textContent = 'Bereite vor...';
                    try {
                        const pdfBlob = await fetchTemplatePdfBlob(template, personalData);
                        downloadBlob(pdfBlob, makeTemplateFilename(template));
                    } catch (err) {
                        console.error('Could not prepare PDF.', err);
                        alert('PDF konnte nicht vorbereitet werden. Details stehen in der Konsole.');
                    } finally {
                        button.disabled = false;
                        button.textContent = 'PDF herunterladen';
                    }
                });
                listEl.appendChild(card);
            });
        }

        launcher.addEventListener('click', () => {
            overlay.dataset.open = 'true';
            render();
        });
        overlay.querySelector('.tecis-store-close').addEventListener('click', () => {
            overlay.dataset.open = 'false';
        });
        searchEl.addEventListener('input', render);
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) overlay.dataset.open = 'false';
        });

        try {
            templates = await fetchPdfTemplates();
            personalData = await fetchFrontendPersonalData(mandantennr);
            statusText = customerID
                ? `Bereit. Mandant ${customerID} erkannt. Der Store wählt Art/Kategorie/Produkt und setzt die PDF im Upload-Feld ein.`
                : 'Bereit. Mandantennummer nicht erkannt; PDF-Felder ohne CRM-Daten werden leer gelassen.';
        } catch (err) {
            console.error('Failed to fetch PDF templates:', err);
            statusText = 'PDF-Templates konnten nicht geladen werden.';
        }
        render();
    }

    if (location.href.includes('/bm-frontend/')) {
        await initFrontendStore();
        return;
    }

    function waitForHeaderMatch(selector, expectedText, timeout = 600000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            let intervalId;
            const observer = new MutationObserver(() => check());

            const cleanup = () => {
                observer.disconnect();
                if (intervalId) {
                    clearInterval(intervalId);
                }
            };

            const check = () => {
                const header = document.querySelector(selector);
                if (header && header.textContent.includes(expectedText)) {
                    cleanup();
                    resolve(header);
                    return;
                }
                if (Date.now() - startTime > timeout) {
                    cleanup();
                    reject(new Error(`Header did not contain "${expectedText}" within timeout.`));
                }
            };

            observer.observe(document.documentElement, {
                childList: true,
                subtree: true,
                characterData: true
            });
            intervalId = setInterval(check, 1000);
            check();
        });
    }

    // Wait for the header that should contain "Eigene Vorgänge"
    try {
        await waitForHeaderMatch('#page\\:center\\:content > h1', 'Eigene Vorgänge');
    } catch (error) {
        console.warn(error.message);
        return;
    }

    // --- Step A: Fetch available PDF templates from your server ---
    let pdfTemplates = [];
    try {
        pdfTemplates = await fetchPdfTemplates();
    } catch (err) {
        console.error('Failed to fetch PDF templates:', err);
        return;
    }

    let customerID;
    document.querySelectorAll('.navigation_item_double').forEach(el => {
        const text = el.innerText.trim();
        if (/^\(\d+\)$/.test(text)) { // matches something like "(147566674)"
            customerID = text.slice(1, -1);
        }
    });
    const beraterID = document.querySelector("#page\\:center\\:exitForm\\:beraterInfoLink").innerText.slice(-6,);

    // --- Step B: Fetch live personal data from the CRM API ---
    const personalDataUrl = 'https://www.crm.vertrieb-plattform.de/kundendetails-personalien/api/personalien/person/' + customerID + '?betreuerNr=' + beraterID;
    let personalData = {};
    try {
        const personalDataJson = await fetchJson(personalDataUrl);
        if (personalDataJson && Array.isArray(personalDataJson.resultData) && personalDataJson.resultData.length > 0) {
            personalData = personalDataJson.resultData[0];
        } else {
            throw new Error('Invalid personal data format.');
        }
    } catch (err) {
        console.error('Failed to fetch personal data:', err);
        return;
    }

    // --- Locate the DOM element where the new buttons will be added ---
    const titleButtons = document.querySelector('#page\\:center\\:contentForm\\:titleButtons');
    if (!titleButtons) {
        console.error('Could not find the titleButtons element.');
        return;
    }

    // Create a container for our new PDF buttons
    const container = document.createElement('span');
    container.style.display = 'block';
    titleButtons.appendChild(container);

    // Helper: Create a button for each PDF template
    pdfTemplates.forEach(template => {
        const btn = document.createElement('button');
        btn.id = `pdf-button-${template.id}`;
        btn.className = 'ui-button ui-widget ui-state-default ui-corner-all ui-button-text-only';
        btn.style.marginRight = '5px';
        btn.innerHTML = `<span class="ui-button-text ui-c">${template.button_name}</span>`;
        container.appendChild(btn);

        btn.addEventListener('click', async function(event) {
            event.preventDefault();

            // --- A helper to perform an action with retries ---
            async function performAction(action, {
                retries = 3,
                delayMs = 500,
                backoffFactor = 1
            } = {}) {
                for (let attempt = 0; attempt < retries; attempt++) {
                    try {
                        await action();
                        return true;
                    } catch (error) {
                        console.error(`Attempt ${attempt + 1} failed:`, error);
                        if (attempt < retries - 1) {
                            const waitMs = Math.round(delayMs * (backoffFactor ** attempt));
                            await new Promise(resolve => setTimeout(resolve, waitMs));
                        } else {
                            console.error("All retries failed.");
                            return false;
                        }
                    }
                }
            }

            async function performActionWithResult(action, {
                retries = 3,
                delayMs = 500,
                backoffFactor = 1
            } = {}) {
                for (let attempt = 0; attempt < retries; attempt++) {
                    try {
                        return await action();
                    } catch (error) {
                        console.error(`Attempt ${attempt + 1} failed:`, error);
                        if (attempt < retries - 1) {
                            const waitMs = Math.round(delayMs * (backoffFactor ** attempt));
                            await new Promise(resolve => setTimeout(resolve, waitMs));
                        } else {
                            console.error("All retries failed.");
                            return null;
                        }
                    }
                }
                return null;
            }

            // --- Sequential UI interactions ---
            async function sequentialExecution() {
                const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

                // Step 1: Click the "add Vorgang" button
                await performAction(async () => {
                    document.querySelector("#page\\:center\\:contentForm\\:addVorgang > span").click();
                    await wait(200);
                });

                // Step 2: Select the "Änderung/Erhöhung" menu item
                await performAction(async () => {
                    const menuItem = Array.from(document.querySelectorAll("span.ui-menuitem-text"))
                        .find(el => el.textContent.trim() === "Änderung/Erhöhung");
                    if (!menuItem) throw new Error('Menu item "Änderung/Erhöhung" not found.');
                    menuItem.click();
                    await wait(400);
                });

                // Step 3: Automatically handle the checkbox (simulate a click)
                if(template.gespraechsnotiz_name == null) {
                    await performAction(async () => {
                        const chkboxSelector = "#dialogForm0\\:chkbxNoGespraechsnotiz > div.ui-chkbox-box.ui-widget.ui-corner-all.ui-state-default";
                        const chkbox = document.querySelector(chkboxSelector);
                        if (!chkbox) throw new Error("Checkbox element not found.");
                        chkbox.click();
                        await wait(100);
                    });
                }
                else {
                    // Tampermonkey userscript body (run-at document-idle or after page is up)
                    (function() {
                        // Helper: escape JSF colons in CSS selectors
                        const esc = id => id.replace(/:/g, '\\:');

                        // Wait for an element to become present + (optionally) visible
                        function waitFor(sel, {visible=false, timeout=5000} = {}) {
                            return new Promise((resolve, reject) => {
                                const start = performance.now();
                                const tm = setInterval(() => {
                                    const el = document.querySelector(sel);
                                    if (el && (!visible || getComputedStyle(el).display !== 'none')) {
                                        clearInterval(tm); resolve(el);
                                    } else if (performance.now() - start > timeout) {
                                        clearInterval(tm); reject(new Error('Timeout waiting for ' + sel));
                                    }
                                }, 50);
                            });
                        }

                        async function selectMenuItemByText({buttonId, menuId, labelText}) {
                            // 1) open the menu
                            const btn = await waitFor('#' + esc(buttonId), {visible:true});
                            btn.click();

                            // 2) wait until menu is visible
                            const menu = await waitFor('#' + esc(menuId), {visible:true});

                            // 3) find the <span class="ui-menuitem-text"> with the label
                            const items = menu.querySelectorAll('li.ui-menuitem a.ui-menuitem-link .ui-menuitem-text');
                            const targetSpan = Array.from(items).find(s => s.textContent.trim() === labelText);
                            if (!targetSpan) throw new Error('Menu item not found: ' + labelText);

                            // 4) click it (on the A or the span is fine)
                            targetSpan.click();
                        }

                        // Example call: adapt the label to what you actually need
                        selectMenuItemByText({
                            buttonId: 'dialogForm0:gn_auswahl_button',
                            menuId:   'dialogForm0:gn_menu',
                            labelText: template.gespraechsnotiz_name // <- exact visible label
                        }).catch(console.error);

                    })();

                }

                // Step 4: Set the title field with the template name
                await performAction(async () => {
                    const titleInput = document.querySelector("#dialogForm0\\:bezeichnung_input");
                    if (!titleInput) throw new Error("Title input element not found.");
                    titleInput.value = template.name;
                    await wait(100);
                });

                // Step 5: Fetch and process the PDF file upload
                const uploadPrepared = await performAction(async () => {
                    const fileInput = document.querySelector("#dialogForm0\\:fileUpload_anschreibenantrag_input");
                    if (!fileInput) throw new Error("File input element not found.");

                    const waitFor = async (predicate, {
                        timeoutMs = 8000,
                        intervalMs = 100
                    } = {}) => {
                        const start = Date.now();
                        while (Date.now() - start < timeoutMs) {
                            if (predicate()) return;
                            await wait(intervalMs);
                        }
                        throw new Error('Timeout while waiting for condition.');
                    };

                    // Convert the stored Base64 PDF into a Blob
                    function base64ToBlob(base64, contentType = 'application/pdf') {
                        const byteCharacters = atob(base64);
                        const byteNumbers = new Array(byteCharacters.length);
                        for (let i = 0; i < byteCharacters.length; i++) {
                            byteNumbers[i] = byteCharacters.charCodeAt(i);
                        }
                        const byteArray = new Uint8Array(byteNumbers);
                        return new Blob([byteArray], { type: contentType });
                    }
                    const fetchPdfBlob = async () => {
                        const pdfData = await fetchJson(template.pdf_url);
                        if (pdfData.status !== 'success' || !pdfData.pdf) {
                            throw new Error(pdfData.message || 'Error fetching PDF file');
                        }
                        return base64ToBlob(pdfData.pdf, 'application/pdf');
                    };

                    let pdfBlob = await performActionWithResult(fetchPdfBlob, {
                        retries: 4,
                        delayMs: 700,
                        backoffFactor: 1.5
                    });
                    if (!pdfBlob) {
                        throw new Error('Could not load PDF after retries.');
                    }

                    // Use PDFLib to fill in the PDF fields based on the template's field mappings
                    try {
                        const existingPdfBytes = await pdfBlob.arrayBuffer();
                        const pdfDoc = await PDFDocument.load(existingPdfBytes);
                        const form = pdfDoc.getForm();

                        // Debug: Log all fields found in the PDF
                        const fields = form.getFields();
                        console.log("Found PDF fields:");
                        fields.forEach(field => console.log(`- ${field.getName()}`));

                        // Use the field_mappings from the template
                        const mappings = template.field_mappings || {};
                        for (const [pdfFieldName, dataKey] of Object.entries(mappings)) {
                            try {
                                let finalValue;

                                // Special virtual data key for today's date in DD.MM.YYYY format.
                                if (dataKey === '$HEUTE') {
                                    const today = new Date();
                                    const dd = String(today.getDate()).padStart(2, '0');
                                    const mm = String(today.getMonth() + 1).padStart(2, '0');
                                    const yyyy = today.getFullYear();
                                    finalValue = `${dd}.${mm}.${yyyy}`;
                                // First, check if the dataKey from the server is a key in our local concat map.
                                } else if (concatenationMap.hasOwnProperty(dataKey)) {
                                    // It is! Perform the concatenation.
                                    const ruleParts = concatenationMap[dataKey];
                                    const resolvedParts = ruleParts.map(part => {
                                        if (typeof part === 'string' && part.startsWith('$')) {
                                            return resolveJsonPath(personalData, part) || '';
                                        }
                                        return part; // It's a literal string
                                    });
                                    finalValue = resolvedParts.join('');
                                } else {
                                    // It's not a concat rule, so treat it as a normal data path.
                                    finalValue = resolveJsonPath(personalData, dataKey) || "";
                                }

                                const textField = form.getTextField(pdfFieldName);
                                textField.setText(String(finalValue));

                            } catch (e) {
                                console.warn(`Field "${pdfFieldName}" with rule "${dataKey}" could not be set.`, e);
                            }
                        }

                        // Save the filled PDF and update pdfBlob
                        const newPdfBytes = await pdfDoc.save();
                        pdfBlob = new Blob([newPdfBytes], { type: 'application/pdf' });
                        console.log("PDF fields have been filled.");
                    } catch (err) {
                        console.warn("PDFLib processing failed. Uploading original PDF.", err);
                    }

                    // Create a File object from the Blob and attach it to the file input
                    const file = new File([pdfBlob], "Antrag.pdf", { type: pdfBlob.type });
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    fileInput.files = dataTransfer.files;
                    fileInput.dispatchEvent(new Event("change", { bubbles: true }));

                    await waitFor(() => fileInput.files && fileInput.files.length > 0);
                    if (fileInput.files[0].size === 0) {
                        throw new Error('Prepared file has size 0 bytes.');
                    }
                }, {
                    retries: 3,
                    delayMs: 1000,
                    backoffFactor: 1.5
                });

                if (!uploadPrepared) {
                    alert("PDF konnte nach mehreren Versuchen nicht vorbereitet werden. Bitte erneut versuchen.");
                }
            }

            sequentialExecution().catch(console.error);
        });
    });

    // --- Enhanced JSONPath Resolver ---
    // This helper tokenizes the JSONPath string (splitting on dots not within brackets)
    // and supports filter expressions like: [?( @.prop==value )]
    function tokenizePath(path) {
        // Remove leading "$" and optional dot.
        if (path.startsWith('$')) {
            path = path.substring(1);
        }
        if (path.startsWith('.')) {
            path = path.substring(1);
        }
        const tokens = [];
        let current = "";
        let inBracket = false;
        let bracketCount = 0;
        for (let char of path) {
            if (char === '[') {
                inBracket = true;
                bracketCount++;
                current += char;
            } else if (char === ']') {
                current += char;
                bracketCount--;
                if (bracketCount === 0) {
                    inBracket = false;
                }
            } else if (char === '.' && !inBracket) {
                tokens.push(current);
                current = "";
            } else {
                current += char;
            }
        }
        if (current) {
            tokens.push(current);
        }
        return tokens;
    }

    // The new resolveJsonPath now supports filter expressions that include nested dot notation.
    function resolveJsonPath(obj, path) {
        if (!path) return undefined;
        // If the path does not start with '$', assume it's a direct property name.
        if (!path.startsWith('$')) {
            return obj[path];
        }
        const tokens = tokenizePath(path);
        let current = obj;
        for (let token of tokens) {
            if (token === "") continue;

            // Check for filter expression of the form: property[?(@.prop operator value)]
            const filterMatch = token.match(/^(.*?)\[\?\(@\.(.*?)\s*(==|!=|>|>=|<|<=)\s*(.*?)\)\]$/);
            if (filterMatch) {
                const prop = filterMatch[1];
                const filterProp = filterMatch[2];
                const operator = filterMatch[3];
                let compValue = filterMatch[4];
                // Remove any surrounding quotes from the comparison value.
                compValue = compValue.replace(/^['"]|['"]$/g, '');
                if (compValue === 'true') compValue = true; // Handle boolean true
                if (compValue === 'false') compValue = false; // Handle boolean false

                current = current[prop];
                if (!Array.isArray(current)) return undefined;
                const filtered = current.filter(item => {
                    const left = item[filterProp];
                    switch (operator) {
                        case '==': return left == compValue;
                        case '!=': return left != compValue;
                        case '>':  return left > compValue;
                        case '>=': return left >= compValue;
                        case '<':  return left < compValue;
                        case '<=': return left <= compValue;
                        default: return false;
                    }
                });
                if (filtered.length === 0) return undefined;
                current = (filtered.length === 1) ? filtered[0] : filtered;
                continue;
            }

            // Check for array index token e.g., "adressen[0]"
            const arrayMatch = token.match(/^(.*?)\[(\d+)\]$/);
            if (arrayMatch) {
                const prop = arrayMatch[1];
                const index = parseInt(arrayMatch[2], 10);
                current = current[prop];
                if (!Array.isArray(current)) return undefined;
                current = current[index];
                continue;
            }

            // Regular property access.
            current = current[token];
            if (current === undefined) return undefined;
        }
        return current;
    }


}

function fetchJson(url, { method = 'GET', headers = {}, body = null } = {}) {
  const gmRequest = (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest : GM_xmlhttpRequest;
  return new Promise((resolve, reject) => {
    gmRequest({
      method,
      url,
      headers,
      data: body,
      onload: (response) => {
        try {
          resolve(JSON.parse(response.responseText));
        } catch (error) {
          reject(error);
        }
      },
      onerror: reject,
    });
  });
}

function addCss(cssText) {
  if (typeof GM_addStyle === 'function') {
    GM_addStyle(cssText);
    return;
  }
  const style = document.createElement('style');
  style.textContent = cssText;
  document.head.appendChild(style);
}

initDokumenteDatenbank({ fetchJson, addCss });
})();
