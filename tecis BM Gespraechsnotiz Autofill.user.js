// ==UserScript==
// @name         tecis BM Gesprächsnotiz Autofill
// @namespace    http://tampermonkey.net/
// @version      2.0.4
// @description  Befüllt die Gesprächsnotiz wenn ?autofill=true gesetzt ist und fügt einen Autofill button in der BM hinzu
// @author       Malte Kretzschmar
// @match        https://bm.bp.vertrieb-plattform.de/bm/?wibiid=*
// @match        https://bm.bp.vertrieb-plattform.de/edocbox/editor/ui/?documentid=*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @connect      bm.bp.vertrieb-plattform.de
// @connect      startkonzept.bp.vertrieb-plattform.de
// @connect      mopoliti.de
// @downloadURL  https://mopoliti.de/Userscripts/tecis%20BM%20Gespraechsnotiz%20Autofill.user.js
// @updateURL    https://mopoliti.de/Userscripts/tecis%20BM%20Gespraechsnotiz%20Autofill.user.js
// @homepageURL  https://mopoliti.de/Userscripts/
// @supportURL   https://mopoliti.de/Userscripts/
// ==/UserScript==

// ===== Gesprächsnotiz: clone Bearbeiten with Autofill =====
(function () {
    "use strict";

    // -------- URL param helpers --------
    let addAutofillNextOpen = false; // one-shot flag for the next window.open()

    function getCurrentWibiid() {
        try { return new URL(location.href).searchParams.get("wibiid"); }
        catch { return null; }
    }

    function isNormalUrl(u) {
        return typeof u === "string" && !/^(?:javascript:|data:|blob:)/i.test(u);
    }

    function appendParams(u, { forceAutofill = false } = {}) {
        if (!isNormalUrl(u)) return u;
        let target;
        try { target = new URL(u, location.href); }
        catch { return u; }

        const wibiid = getCurrentWibiid();
        if (wibiid && !target.searchParams.has("wibiid")) {
            target.searchParams.set("wibiid", wibiid);
        }
        if (forceAutofill) {
            target.searchParams.set("autofill", "true");
        }
        return target.toString();
    }

    // -------- Intercept window.open (covers PrimeFaces flows) --------
    const _open = window.open;
    Object.defineProperty(window, "open", {
        configurable: true,
        writable: true,
        value: function (url, name, specs, replace) {
            if (typeof url === "string") {
                url = appendParams(url, { forceAutofill: addAutofillNextOpen });
            }
            // one-shot; reset immediately
            const ret = _open.call(this, url, name, specs, replace);
            addAutofillNextOpen = false;
            return ret;
        }
    });

    // Also catch plain links that open in a new tab (Ctrl/Meta/middle click)
    function handleLinkNewTab(ev) {
        const a = ev.target && ev.target.closest && ev.target.closest("a[href]");
        if (!a) return;

        const willOpenNewTab =
            a.target === "_blank" || ev.ctrlKey || ev.metaKey || ev.button === 1;

        if (!willOpenNewTab) return;

        // If this click originated from our Autofill button, set autofill for this navigation
        if (ev.target && ev.target.closest && ev.target.closest(".autofill-button")) {
            addAutofillNextOpen = true;
        }

        const href = a.getAttribute("href");
        if (!href) return;

        const newHref = appendParams(href, { forceAutofill: addAutofillNextOpen });
        if (newHref !== href) a.setAttribute("href", newHref);

        // one-shot
        addAutofillNextOpen = false;
    }
    window.addEventListener("click", handleLinkNewTab, true);
    window.addEventListener("auxclick", handleLinkNewTab, true);

    // -------- DOM patcher: find Gesprächsnotiz rows & clone the button --------
    function isGesprächsnotizRow(row) {
        try {
            const first = row.querySelector(".first, #page\\:center\\:contentForm\\:nbVorgList\\:0\\:j_idt376\\:1\\:dfirst");
            return first && first.textContent.trim() === "Gesprächsnotiz";
        } catch { return false; }
    }

    function enhanceRow(row) {
        if (row.dataset.autofillAugmented === "1") return; // already done

        // Find the Bearbeiten button (PrimeFaces uses this class in your snippet)
        const editBtn = row.querySelector("button.edit-document-button");
        if (!editBtn) return;

        // Avoid doubling if an autofill twin already exists
        if (row.querySelector(".autofill-button")) return;

        // Clone it
        const autofillBtn = editBtn.cloneNode(true);

        // Make it visually/semantically distinct
        autofillBtn.classList.add("autofill-button");
        autofillBtn.title = "Bearbeiten (Autofill)";
        // Update the label text in its span
        const labelSpan = autofillBtn.querySelector(".ui-button-text, span.ui-button-text");
        if (labelSpan) labelSpan.textContent = "Autofill";

        // Make the id/name unique (optional; helps avoid duplicate ids)
        if (autofillBtn.id) autofillBtn.id += "_autofill";
        if (autofillBtn.name) autofillBtn.name += "_autofill";

        // Add a pre-click hook that sets the one-shot autofill flag,
        // then lets the original inline onclick (PrimeFaces.ab(...);return false;) run.
        autofillBtn.addEventListener("click", function () {
            addAutofillNextOpen = true; // ensure the *next* window.open / link uses autofill=true
            // Do not preventDefault: we want the original onclick to execute
        }, { capture: true });

        // Insert right after the original Bearbeiten button
        editBtn.parentElement.insertBefore(autofillBtn, editBtn.nextSibling);

        row.dataset.autofillAugmented = "1";
    }

    function scan() {
        // Rows often look like: <div class="dokumentRow ..."> ... <div class="first">Gesprächsnotiz</div> ... <div class="third">[buttons]</div> ...
        const rows = document.querySelectorAll("div.dokumentRow, div.bm_docRow1, div[id*='panelDokumente']");
        rows.forEach(row => {
            if (isGesprächsnotizRow(row)) enhanceRow(row);
        });
    }

    // Initial + observe JSF/PrimeFaces ajax updates
    const mo = new MutationObserver(() => scan());
    mo.observe(document.documentElement, { subtree: true, childList: true });
    // Run once when DOM is ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", scan);
    } else {
        scan();
    }
})();

// ===== BP Editor Autofill (wibiid) =====
(function () {
    'use strict';

    // ------- Small utilities -------
    const qs = new URLSearchParams(window.location.search);
    const isAutoFill = (qs.get('autofill') || '').toLowerCase() === 'true';
    if(!isAutoFill) return;

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    function decodeBase64Url(b64) {
        if (!b64) return '';
        b64 = b64.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        try {
            return decodeURIComponent(Array.prototype.map.call(atob(b64), c =>
                '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
            ).join(''));
        } catch (e) {
            try { return atob(b64); } catch { return ''; }
        }
    }

    // Use GM.xmlHttpRequest if available; fallback to same-origin fetch
    function gmFetchJson(url, { method = 'GET', headers = {}, body = null, withCredentials = true } = {}) {
        return new Promise((resolve, reject) => {
            const xhrFn = (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest :
                (typeof GM_xmlHttpRequest !== 'undefined' ? GM_xmlHttpRequest : null);

            if (xhrFn) {
                xhrFn({
                    method,
                    url,
                    headers,
                    data: body,
                    responseType: 'json',
                    timeout: 60_000,
                    withCredentials,
                    onload: (res) => {
                        try {
                            if (res.status >= 200 && res.status < 300) {
                                const data = (res.response && typeof res.response === 'object')
                                    ? res.response
                                    : JSON.parse(res.responseText || '{}');
                                resolve(data);
                            } else {
                                reject(new Error(`HTTP ${res.status} for ${url}`));
                            }
                        } catch (err) { reject(err); }
                    },
                    onerror: () => reject(new Error(`Network error for ${url}`)),
                    ontimeout: () => reject(new Error(`Timeout for ${url}`))
                });
            } else {
                fetch(url, {
                    method,
                    headers,
                    body,
                    credentials: withCredentials ? 'include' : 'same-origin'
                }).then(async (r) => {
                    if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
                    resolve(await r.json());
                }).catch(reject);
            }
        });
    }

    // ---- JSON path helper (e.g. "clusterDto.liquidesVermoegen" or "arr[0].x") ----
    function getByPath(obj, path) {
        if (!path) return undefined;
        const norm = path.replace(/\[(\d+)\]/g, '.$1').replace(/^\./, '');
        return norm.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
    }

    // 3) EED Autofill Helper (mit Auto-Scroll & resolvierter URL/Needle)
    (function(){
        function asArray(x){
            if (Array.isArray(x)) return x;
            if (!x) return [];
            if (typeof x === 'object') return Object.values(x);
            return [];
        }

        function getAllPages(allJson){
            const pages = asArray(allJson && allJson.pages);
            if (!pages.length) throw new Error('allJson.pages[] missing or empty');
            return pages;
        }

        function translatFacts(apiValue){
            switch (apiValue){
                //Anzahl an Geschäften
                case 'Keine': return '0';
                case 'Anzahl_1_5': return '1';
                case 'Anzahl_6_10': return '2';
                case 'Anzahl_mehr': return '3';
                //gegenwert
                case "Wert_1_3000": return '1';
                case "Wert_3001_5000": return '2';
                case "Wert_5001_10000": return '3';
                case "Wert_mehr": return '4';
            }
        }
        // ---------------------------------------------------------------------------

        function findJsonField(allJson, fieldId, valueForRadio, position){
            const pages = getAllPages(allJson);
            let candidates = [];

            for (const page of pages){
                for (const f of asArray(page.fields)){
                    if (!f || f.id !== fieldId) continue;

                    // Logic for specific radio values (legacy support)
                    const type = (f.t || '').toLowerCase();
                    if (type === 'radio' && valueForRadio != null && !position){
                        if (String(f.valchecked) === String(translatFacts(valueForRadio))) return {page, field: f};
                    }

                    candidates.push({page, field: f});
                }
            }

            if (!candidates.length) throw new Error(`Field id "${fieldId}" not found in any page`);

            // Check for spatial requirements
            if (position === 'left') {
                candidates.sort((a, b) => (a.field.x || 0) - (b.field.x || 0));
                return candidates[0];
            }
            if (position === 'right') {
                candidates.sort((a, b) => (b.field.x || 0) - (a.field.x || 0));
                return candidates[0];
            }

            // Default (first found)
            return candidates[0];
        }

        function getEedPageByNumber(pageNumber) {
            const pages = Array.from(document.querySelectorAll('eed-page'));
            for (const p of pages) {
                const num = p.querySelector('eed-page-number .page-number');
                if (num && num.textContent.trim() === String(pageNumber)) return p;
            }
            return null;
        }

        function getScrollContainer(){
            const anyPage = document.querySelector('eed-page');
            let el = anyPage ? anyPage.parentElement : null;
            while (el){
                const style = getComputedStyle(el);
                if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
                    return el;
                }
                el = el.parentElement;
            }
            return document.scrollingElement || document.documentElement || document.body;
        }

        function median(arr){ const s=[...arr].sort((a,b)=>a-b); const m=Math.floor(s.length/2); return s.length? (s.length%2? s[m] : (s[m-1]+s[m])/2) : 800; }

        function renderedPagesInfo(){
            const items = [];
            document.querySelectorAll('eed-page').forEach(p=>{
                const numTxt = p.querySelector('eed-page-number .page-number')?.textContent?.trim();
                if (!numTxt) return;
                const num = Number(numTxt);
                const rect = p.getBoundingClientRect();
                items.push({num, rect, el: p});
            });
            items.sort((a,b)=>a.rect.top - b.rect.top);
            const nums = items.map(i=>i.num);
            return {
                items,
                nums,
                min: nums.length ? Math.min(...nums) : null,
                max: nums.length ? Math.max(...nums) : null,
                medianHeight: items.length ? median(items.map(i=>i.rect.height)) : 800
            };
        }

        async function revealPage(pageNumber, maxSteps=120){
            let el = getEedPageByNumber(pageNumber);
            if (el) return el;

            const scroller = getScrollContainer();

            for (let step=0; step<maxSteps; step++){
                const info = renderedPagesInfo();

                if (!info.items.length){
                    scroller.scrollBy({top: 400, left: 0, behavior: 'auto'});
                    await sleep(30);
                    el = getEedPageByNumber(pageNumber);
                    if (el) return el;
                    continue;
                }

                el = getEedPageByNumber(pageNumber);
                if (el) return el;

                const {min, max, medianHeight} = info;
                let dir = 0;
                if (min != null && max != null) {
                    if (pageNumber > max) dir = +1;
                    else if (pageNumber < min) dir = -1;
                    else dir = 0;
                }

                const delta = (dir === 0) ? (medianHeight * 0.6) : (dir * medianHeight * 0.95);
                scroller.scrollBy({top: delta, behavior: 'auto'});
                await sleep(70);
            }
            throw new Error(`Could not reveal eed-page ${pageNumber} by scrolling`);
        }

        function parsePx(v){
            return typeof v === 'string' ? parseFloat(v.replace('px','')) : (v || 0);
        }

        function getPageScale(pageEl, jsonPageWidth) {
            const pageBox = pageEl.querySelector('.page');
            if (!pageBox) throw new Error('No .page element found inside eed-page');
            const cssW = parsePx(pageBox.style.width) || pageBox.getBoundingClientRect().width;
            return cssW / (jsonPageWidth || 1200);
        }

        function computeTargetRect(fieldEntry, scale){
            return {
                left: (fieldEntry.x || 0) * scale,
                top:  (fieldEntry.y || 0) * scale,
                w:    (fieldEntry.w || 0) * scale,
                h:    (fieldEntry.h || 0) * scale
            };
        }

        function coordsMatch(el, target, tol=3.8){
            const left = parsePx(el.style.left);
            const top  = parsePx(el.style.top);
            const w    = parsePx(el.style.width);
            const h    = parsePx(el.style.height);
            return Math.abs(left-target.left)<=tol && Math.abs(top-target.top)<=tol &&
                Math.abs(w-target.w)<=tol   && Math.abs(h-target.h)<=tol;
        }

        function getFormfields(pageEl){
            return Array.from(pageEl.querySelectorAll('.formfield'));
        }

        async function findDomNodeForField(pageJson, fieldEntry){
            const pageEl = await revealPage(pageJson.page);
            pageEl.scrollIntoView({block: 'center'});
            await sleep(40);

            const scale = getPageScale(pageEl, pageJson.width);
            const target = computeTargetRect(fieldEntry, scale);

            for (let tries=0; tries<50; tries++){
                const matches = getFormfields(pageEl).filter(ff => coordsMatch(ff, target));
                if (matches.length) return {node: matches[0], pageEl};
                await sleep(50);
            }
            throw new Error(`Formfield at (${target.left.toFixed(1)},${target.top.toFixed(1)}) not found on page ${pageJson.page}`);
        }

        async function getActionElement(wrapperEl){
            let input = wrapperEl.querySelector('.frame input.input');
            if (input) return {kind:'text', el: input};

            const mat = wrapperEl.querySelector('mat-checkbox');
            if (mat) {
                const isRadioStyle = mat.classList.contains('radio');
                const inp = mat.querySelector('input[type="checkbox"]');
                return {kind: isRadioStyle ? 'radio' : 'checkbox', el: mat, inp};
            }

            input = wrapperEl.querySelector('input');
            if (input) return {kind: input.type==='checkbox' ? 'checkbox' : 'text', el: input};

            throw new Error('No actionable input element found inside .formfield');
        }

        function setNativeInputValue(input, value){
            const proto = Object.getPrototypeOf(input) || HTMLInputElement.prototype;
            const desc  = Object.getOwnPropertyDescriptor(proto, 'value') ||
                Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
            if (desc && desc.set) desc.set.call(input, value);
            else input.value = value;
        }

        function clickMaterial(matEl){
            const input = matEl.querySelector('input[type="checkbox"]');
            if (input) { input.click(); return; }
            const label = matEl.querySelector('label');
            if (label) { label.click(); return; }
            const inner = matEl.querySelector('.mat-checkbox-inner-container');
            if (inner) { inner.click(); return; }
            matEl.click();
        }

        async function withTemporarilyEnabled(inputEl, fn){
            const wasDisabled = !!inputEl.disabled;
            if (wasDisabled) inputEl.disabled = false;
            try { return await fn(); }
            finally { if (wasDisabled) inputEl.disabled = true; }
        }

        async function setText(wrapperEl, value){
            const {el: input} = await getActionElement(wrapperEl);
            await withTemporarilyEnabled(input, async () => {
                input.focus();
                setNativeInputValue(input, value == null ? '' : String(value));
                input.dispatchEvent(new Event('input',  {bubbles:true}));
                input.dispatchEvent(new Event('change', {bubbles:true}));
                input.dispatchEvent(new Event('blur',   {bubbles:true}));
            });
        }

        async function setCheckbox(wrapperEl, want){
            const action = await getActionElement(wrapperEl);
            if (action.kind !== 'checkbox') throw new Error('Target is not a checkbox');

            const getState = () => {
                if (action.inp) {
                    const aria = action.inp.getAttribute('aria-checked');
                    if (aria === 'true' || aria === 'false') return aria === 'true';
                    return !!action.inp.checked;
                }
                const aria = wrapperEl.querySelector('input[type="checkbox"]')?.getAttribute('aria-checked');
                if (aria === 'true' || aria === 'false') return aria === 'true';
                const cb = wrapperEl.querySelector('input[type="checkbox"]');
                return !!(cb && cb.checked);
            };

            want = !!want;
            for (let i=0; i<2 && getState() !== want; i++){
                clickMaterial(action.el || wrapperEl);
                await sleep(14);
            }
            const inp = action.inp || wrapperEl.querySelector('input[type="checkbox"]');
            if (inp){
                inp.dispatchEvent(new Event('change', {bubbles:true}));
                inp.dispatchEvent(new Event('blur',   {bubbles:true}));
            }
        }

        async function setRadio(wrapperEl){
            const action = await getActionElement(wrapperEl);
            if (action.kind !== 'radio') throw new Error('Target is not a radio');
            clickMaterial(action.el || wrapperEl);
            const inp = action.inp || wrapperEl.querySelector('input[type="checkbox"]');
            if (inp){
                inp.dispatchEvent(new Event('change', {bubbles:true}));
                inp.dispatchEvent(new Event('blur',   {bubbles:true}));
            }
            await sleep(10);
        }

        // Updated signature to accept position
        window.setFieldByIdResolvedValue = async function(allJson, fieldId, value, position){
            const {page, field} = findJsonField(allJson, fieldId, value, position);
            const {node} = await findDomNodeForField(page, field);

            const type = (field.t || '').toLowerCase();
            if (type === 'text')     return setText(node, value);
            if (type === 'checkbox') return setCheckbox(node, !!value);
            if (type === 'radio')    return setRadio(node);

            throw new Error(`Unsupported field type "${field.t}" for id "${fieldId}"`);
        };

        window.setFieldById = async function(allJson, fieldId, url, needle, position){
            const json = await gmFetchJson(url, { withCredentials: true });
            const value = getByPath(json, needle);
            return window.setFieldByIdResolvedValue(allJson, fieldId, value, position);
        };

        console.log('%c[EED helper] Ready: setFieldById(allJson, fieldId, url, needle, position)','color:#0a0;font-weight:bold;');
    })();

    if (!isAutoFill) return;

    async function run() {
        try {
            // 1) Decode wibiid from URL
            const wibiidB64 = qs.get('wibiid') || '';
            const wibiid = decodeBase64Url(wibiidB64).trim();

            // 2) Load the document JSON the page loads:
            const docUrl = 'https://mopoliti.de/tecis/Store/AVGespraechsnotiz.php';
            const pageData = await gmFetchJson(docUrl, { withCredentials: true });
            if (!pageData || !Array.isArray(pageData.pages)) {
                throw new Error('Unerwartetes Dokument-JSON: allJson.pages[] fehlt oder ist leer.');
            }

            // 4) Mappings
            const apiBase = 'https://startkonzept.bp.vertrieb-plattform.de/api';


            console.log(`${apiBase}/haushalt/${encodeURIComponent(wibiid)}/clusters?clusterType=AvKenntnisseUndErfahrungen&clusterId=9c635702-2ea2-4190-942a-2cea750c46e1`);
            const tasks = [
                // --- NEW SPATIAL FIELDS ---
                {
                    field: 'FinanzenHH_Aenderungen_Radio',
                    staticValue: true,
                    position: 'left'
                },
                {
                    field: 'pep',
                    staticValue: true,
                    position: 'left'
                },
                // --- EXISTING FIELDS ---
                {
                    field: 'Profilierung_Kenntnisse_Chbx_Geldmarktfonds',
                    url: `${apiBase}/haushalt/${encodeURIComponent(wibiid)}/clusters?clusterType=AvKenntnisseUndErfahrungen&clusterId=9c635702-2ea2-4190-942a-2cea750c46e1`,
                    needle: 'clusterDto.kunde.geldmarktfonds'
                },
                {
                    field: 'Profilierung_Kenntnisse_Chbx_Rentenfonds',
                    url: `${apiBase}/haushalt/${encodeURIComponent(wibiid)}/clusters?clusterType=AvKenntnisseUndErfahrungen&clusterId=9c635702-2ea2-4190-942a-2cea750c46e1`,
                    needle: 'clusterDto.kunde.rentenfonds'
                },
                {
                    field: 'Profilierung_Kenntnisse_Chbx_Aktienfonds',
                    url: `${apiBase}/haushalt/${encodeURIComponent(wibiid)}/clusters?clusterType=AvKenntnisseUndErfahrungen&clusterId=9c635702-2ea2-4190-942a-2cea750c46e1`,
                    needle: 'clusterDto.kunde.aktienfonds'
                },
                {
                    field: 'Profilierung_Kenntnisse_Chbx_Immofonds',
                    url: `${apiBase}/haushalt/${encodeURIComponent(wibiid)}/clusters?clusterType=AvKenntnisseUndErfahrungen&clusterId=9c635702-2ea2-4190-942a-2cea750c46e1`,
                    needle: 'clusterDto.kunde.immobilienfonds'
                },
                {
                    field: 'Profilierung_Kenntnisse_Chbx_GemischteFonds',
                    url: `${apiBase}/haushalt/${encodeURIComponent(wibiid)}/clusters?clusterType=AvKenntnisseUndErfahrungen&clusterId=9c635702-2ea2-4190-942a-2cea750c46e1`,
                    needle: 'clusterDto.kunde.gemischtefonds'
                },
                {
                    field: 'Profilierung_Kenntnisse_Chbx_Hedgefonds',
                    url: `${apiBase}/haushalt/${encodeURIComponent(wibiid)}/clusters?clusterType=AvKenntnisseUndErfahrungen&clusterId=9c635702-2ea2-4190-942a-2cea750c46e1`,
                    needle: 'clusterDto.kunde.hedgefonds'
                },
                {
                    field: 'Profilierung_Kenntnisse_Chbx_RVoderLV',
                    url: `${apiBase}/haushalt/${encodeURIComponent(wibiid)}/clusters?clusterType=AvKenntnisseUndErfahrungen&clusterId=9c635702-2ea2-4190-942a-2cea750c46e1`,
                    needle: 'clusterDto.kunde.versicherungen'
                },
                {
                    field: 'Profilierung_Kenntnisse_Chbx_Keine',
                    url: `${apiBase}/haushalt/${encodeURIComponent(wibiid)}/clusters?clusterType=AvKenntnisseUndErfahrungen&clusterId=9c635702-2ea2-4190-942a-2cea750c46e1`,
                    needle: 'clusterDto.kunde.keine'
                },
                {
                    field: 'Profilierung_Kenntnisse_Radio_AnzGesch',
                    url: `${apiBase}/haushalt/${encodeURIComponent(wibiid)}/clusters?clusterType=AvKenntnisseUndErfahrungen&clusterId=9c635702-2ea2-4190-942a-2cea750c46e1`,
                    needle: 'clusterDto.kunde.transaktionenAnzahl',
                    value: 1,
                },
                {
                    field: 'Profilierung_Kenntnisse_Radio_TransWert',
                    url: `${apiBase}/haushalt/${encodeURIComponent(wibiid)}/clusters?clusterType=AvKenntnisseUndErfahrungen&clusterId=9c635702-2ea2-4190-942a-2cea750c46e1`,
                    needle: 'clusterDto.kunde.transaktionenWert',
                    value: 1,
                },
                {
                    field: 'Nachhaltigkeit_Beruecksichtigung',
                    staticValue: true, // Assuming check
                    position: 'right'
                },
                {
                    field: 'FinanzenHH_Einkommen_Monat',
                    url: `${apiBase}/haushalt/${encodeURIComponent(wibiid)}/clusters?clusterType=AvLaufendeEinnahmenUndAusgaben&clusterId=9c635702-2ea2-4190-942a-2cea750c46e1`,
                    needle: 'clusterDto.monatlicheNettoeinnahmen',
                },
                {
                    field: 'FinanzenHH_Ausgaben_Monat',
                    url: `${apiBase}/haushalt/${encodeURIComponent(wibiid)}/clusters?clusterType=AvLaufendeEinnahmenUndAusgaben&clusterId=9c635702-2ea2-4190-942a-2cea750c46e1`,
                    needle: 'clusterDto.monatlicheAusgaben',
                },
                {
                    field: 'FinanzenHH_Ueberschuss_Monat',
                    // Skipped here, handled in calculation block below
                    skip: true
                },
                {
                    field: 'FinanzenHH_Vermoegen_Liquides',
                    url: `${apiBase}/haushalt/${encodeURIComponent(wibiid)}/clusters?clusterType=AvVermoegenUndVerbindlichkeiten&clusterId=9c635702-2ea2-4190-942a-2cea750c46e1`,
                    needle: 'clusterDto.liquidesVermoegen'
                },
                {
                    field: 'FinanzenHH_Vermoegen_Immo',
                    url: `${apiBase}/haushalt/${encodeURIComponent(wibiid)}/clusters?clusterType=AvVermoegenUndVerbindlichkeiten&clusterId=9c635702-2ea2-4190-942a-2cea750c46e1`,
                    needle: 'clusterDto.immobilienVermoegen'
                },
                {
                    field: 'FinanzenHH_Vermoegen_Kapitalanlagen',
                    url: `${apiBase}/haushalt/${encodeURIComponent(wibiid)}/clusters?clusterType=AvVermoegenUndVerbindlichkeiten&clusterId=9c635702-2ea2-4190-942a-2cea750c46e1`,
                    needle: 'clusterDto.kapitalanlagenVermoegen'
                },
                {
                    field: 'FinanzenHH_Verbindlichkeiten',
                    url: `${apiBase}/haushalt/${encodeURIComponent(wibiid)}/clusters?clusterType=AvVermoegenUndVerbindlichkeiten&clusterId=9c635702-2ea2-4190-942a-2cea750c46e1`,
                    needle: 'clusterDto.verbindlichkeiten'
                }
            ];

            // --- LOGGING NON-AUTOFILLED FIELDS ---
            const allFieldIds = [];
            (pageData.pages || []).forEach(p => {
                const fields = Array.isArray(p.fields) ? p.fields : Object.values(p.fields || {});
                fields.forEach(f => { if (f && f.id) allFieldIds.push(f.id); });
            });

            const filledIds = new Set(tasks.map(t => t.field));
            const notFilled = allFieldIds.filter(id => !filledIds.has(id));

            console.group("Fields NOT Autofilled");
            console.log("Total fields found:", allFieldIds.length);
            console.log("Total fields filled:", filledIds.size);
            console.log("List of unfilled fields:", notFilled);
            console.groupEnd();
            // -------------------------------------

            // 5) gewünschte 1s-VerzögerungO
            await sleep(1000);

            // 6) Execute mappings
            for (const t of tasks) {
                try {
                    if (t.skip) continue;

                    // Allow static values (no API call)
                    if (t.staticValue !== undefined) {
                        await window.setFieldByIdResolvedValue(pageData, t.field, t.staticValue, t.position);
                        continue;
                    }

                    const fn = (typeof window.setFieldById === 'function') ? window.setFieldById : null;
                    if (!fn) {
                        console.warn('Skipping task because setFieldById is not available:', t);
                        continue;
                    }
                    // Pass position to API-based tasks too
                    await fn(pageData, t.field, t.url, t.needle, t.position);
                } catch (err) {
                    console.error(`Failed to set field "${t.field}" from ${t.url} (${t.needle}):`, err);
                }
            }

            // 7) Special Calculation: Ueberschuss
            try {
                const finUrl = `${apiBase}/haushalt/${encodeURIComponent(wibiid)}/clusters?clusterType=AvLaufendeEinnahmenUndAusgaben&clusterId=9c635702-2ea2-4190-942a-2cea750c46e1`;
                const finJson = await gmFetchJson(finUrl, { withCredentials: true });
                const inc = parseFloat(getByPath(finJson, 'clusterDto.monatlicheNettoeinnahmen')) || 0;
                const exp = parseFloat(getByPath(finJson, 'clusterDto.monatlicheAusgaben')) || 0;
                const diff = inc - exp;
                await window.setFieldByIdResolvedValue(pageData, 'FinanzenHH_Ueberschuss_Monat', diff);
                console.log(`Calculated Ueberschuss: ${inc} - ${exp} = ${diff}`);
            } catch (calcErr) {
                console.error("Calculation for FinanzenHH_Ueberschuss_Monat failed:", calcErr);
            }

        } catch (e) {
            console.error('Autofill script error:', e);
            alert('Autofill Fehler: ' + (e && e.message ? e.message : e));
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
        run();
    }
})();