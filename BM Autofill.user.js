// ==UserScript==
// @name         BP Editor Autofill (wibiid)
// @namespace    https://malte.dev/
// @version      1.1
// @updateURL    https://mopoliti.de/Userscripts/BM%20Autofill.user.js
// @description  Autofill fields in BP editor using API data when ?autofill=true is present
// @author       You
// @match        https://bm.bp.vertrieb-plattform.de/edocbox/editor/ui/?documentid=*
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @connect      bm.bp.vertrieb-plattform.de
// @connect      startkonzept.bp.vertrieb-plattform.de
// ==/UserScript==

(function () {
    'use strict';

    // ------- Small utilities -------
    const qs = new URLSearchParams(window.location.search);
    const isAutoFill = (qs.get('autofill') || '').toLowerCase() === 'true';
    if (!isAutoFill) return;

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
                (typeof GM_xmlhttpRequest !== 'undefined' ? GM_xmlhttpRequest : null);

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
        // turn arr[0].x into arr.0.x
        const norm = path.replace(/\[(\d+)\]/g, '.$1').replace(/^\./, '');
        return norm.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
    }

    async function run() {
        try {
            // 1) Decode wibiid from URL
            const wibiidB64 = qs.get('wibiid') || '';
            const wibiid = decodeBase64Url(wibiidB64).trim();

            // 2) Load the document JSON the page loads:
            const docUrl = 'https://mopoliti.de/tecis/Store/AV-Gespr%C3%A4chsnotiz.json';
            const pageData = await gmFetchJson(docUrl, { withCredentials: true });
            if (!pageData || !Array.isArray(pageData.pages)) {
                throw new Error('Unerwartetes Dokument-JSON: allJson.pages[] fehlt oder ist leer.');
            }

            // 3) EED Autofill Helper (mit Auto-Scroll & resolvierter URL/Needle)
            (function(){
                // -------- Robust structure handling ---------------------------------------
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

                function findJsonField(allJson, fieldId, valueForRadio){
                    const pages = getAllPages(allJson);
                    let best = null;
                    for (const page of pages){
                        for (const f of asArray(page.fields)){
                            if (!f || f.id !== fieldId) continue;
                            const type = (f.t || '').toLowerCase();
                            if (type === 'radio' && valueForRadio != null){
                                if (String(f.valchecked) === String(valueForRadio)) return {page, field: f};
                                best = best || {page, field: f}; // fallback if exact value not found
                            } else {
                                return {page, field: f};
                            }
                        }
                    }
                    if (best) return best;
                    throw new Error(`Field id "${fieldId}" not found in any page`);
                }

                // -------- DOM page lookup + auto-scroll -----------------------------------
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

                async function revealPage(pageNumber, maxSteps=50){
                    let el = getEedPageByNumber(pageNumber);
                    if (el) return el;

                    const scroller = getScrollContainer();

                    for (let step=0; step<maxSteps; step++){
                        const info = renderedPagesInfo();

                        // Falls noch gar keine Seiten sichtbar: kleinen Initial-Scroll nach unten
                        if (!info.items.length){
                            scroller.scrollBy({top: 400, left: 0, behavior: 'auto'});
                            await sleep(60);
                            el = getEedPageByNumber(pageNumber);
                            if (el) return el;
                            continue;
                        }

                        // Prüfen, ob Ziel inzwischen gerendert ist
                        el = getEedPageByNumber(pageNumber);
                        if (el) return el;

                        // Richtung explizit wählen (recycelte Seiten):
                        const {min, max, medianHeight} = info;
                        let dir = 0;
                        if (min != null && max != null) {
                            if (pageNumber > max) dir = +1;      // weiter unten -> nach unten scrollen
                            else if (pageNumber < min) dir = -1; // weiter oben   -> nach oben scrollen
                            else dir = 0;                        // liegt zwischen min/max: kleiner Nudge
                        }

                        const delta = (dir === 0) ? (medianHeight * 0.6) : (dir * medianHeight * 0.95);
                        scroller.scrollBy({top: delta, behavior: 'auto'});
                        await sleep(70);
                    }
                    throw new Error(`Could not reveal eed-page ${pageNumber} by scrolling`);
                }

                // -------- Positioning & matching ------------------------------------------
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

                function coordsMatch(el, target, tol=1.8){
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

                    for (let tries=0; tries<8; tries++){
                        const matches = getFormfields(pageEl).filter(ff => coordsMatch(ff, target));
                        if (matches.length) return {node: matches[0], pageEl};
                        await sleep(50);
                    }
                    throw new Error(`Formfield at (${target.left.toFixed(1)},${target.top.toFixed(1)}) not found on page ${pageJson.page}`);
                }

                // -------- Element action helpers ------------------------------------------
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

                // -------- Öffentliche API --------------------------------------------------
                // 1) Kern-Setter mit bereits aufgelöstem Wert
                async function setFieldByIdResolvedValue(allJson, fieldId, value){
                    const {page, field} = findJsonField(allJson, fieldId, value);
                    const {node} = await findDomNodeForField(page, field);

                    const type = (field.t || '').toLowerCase();
                    if (type === 'text')     return setText(node, value);
                    if (type === 'checkbox') return setCheckbox(node, !!value);
                    if (type === 'radio')    return setRadio(node);

                    throw new Error(`Unsupported field type "${field.t}" for id "${fieldId}"`);
                }

                // 2) Signatur wie von dir gewünscht: (allJson, fieldId, url, needle)
                window.setFieldById = async function(allJson, fieldId, url, needle){
                    const json = await gmFetchJson(url, { withCredentials: true });
                    const value = getByPath(json, needle);
                    return setFieldByIdResolvedValue(allJson, fieldId, value);
                };

                console.log('%c[EED helper] Ready: setFieldById(allJson, fieldId, url, needle)','color:#0a0;font-weight:bold;');
            })();

            // 4) Mappings
            const apiBase = 'https://startkonzept.bp.vertrieb-plattform.de/api';
            const tasks = [
                {
                    field: 'FinanzenHH_Vermoegen_Liquides',
                    url: `${apiBase}/haushalt/${encodeURIComponent(wibiid)}/clusters?clusterType=AvVermoegenUndVerbindlichkeiten&clusterId=9c635702-2ea2-4190-942a-2cea750c46e1`,
                    needle: 'clusterDto.liquidesVermoegen'
                },
            ];

            // 5) Erste Ausführung: gewünschte 1s-Verzögerung bevor Daten geladen werden
            await sleep(1000);

            // 6) Execute mappings
            for (const t of tasks) {
                try {
                    const fn = (typeof window.setFieldById === 'function')
                        ? window.setFieldById
                        : null;

                    if (!fn) {
                        console.warn('Skipping task because setFieldById is not available:', t);
                        continue;
                    }
                    await fn(pageData, t.field, t.url, t.needle);
                } catch (err) {
                    console.error(`Failed to set field "${t.field}" from ${t.url} (${t.needle}):`, err);
                }
            }

            // 7) Zusätzlich: Wert laden und anzeigen
            const liquidesUrl = `${apiBase}/haushalt/${encodeURIComponent(wibiid)}/clusters?clusterType=AvVermoegenUndVerbindlichkeiten&clusterId=9c635702-2ea2-4190-942a-2cea750c46e1`;
            const liquidesJson = await gmFetchJson(liquidesUrl, { withCredentials: true });
            const liquidesVermoegen = getByPath(liquidesJson, 'clusterDto.liquidesVermoegen');
            alert(typeof liquidesVermoegen !== 'undefined' ? String(liquidesVermoegen)
                : 'Hinweis: clusterDto.liquidesVermoegen nicht gefunden.');

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
