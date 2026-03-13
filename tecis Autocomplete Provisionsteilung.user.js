// ==UserScript==
// @name         tecis BM Provisionsverteilungs Autocomplete
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Autocomplete und Quick-Buttons für Provisionsdialog
// @author       Malte Kretzschmar mit Genini
// @match        https://bm.bp.vertrieb-plattform.de/bm/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const PARTNER_DATA = [
        { vp: "794378", name: "Erik Jacques" }, { vp: "794155", name: "Dennis Philipps" },
        { vp: "768180", name: "Johannes Huber" }, { vp: "799968", name: "Binoj Puthuvaparambil" },
        { vp: "795565", name: "Tobias Wessel" }, { vp: "769331", name: "Gina Meria Konietzko" },
        { vp: "770627", name: "Carsten Teschner" }, { vp: "756410", name: "Michael Kokalj" },
        { vp: "775726", name: "Malte Kretzschmar" }, { vp: "774992", name: "Fynn Kretzschmar" },
        { vp: "769267", name: "Eike Kretzschmar" }, { vp: "766151", name: "Henning Benfer" },
        { vp: "749250", name: "Thomas Schleiermacher" }, { vp: "746442", name: "Daniel Konrad" },
        { vp: "773658", name: "Adrian Stefan Habersetzer" }, { vp: "763339", name: "Stella Wolf" },
        { vp: "763189", name: "Dewei Zheng" }, { vp: "745645", name: "Jan Luca Willms" },
        { vp: "749545", name: "Marko Yi Wei Chen" }, { vp: "739827", name: "Mikayel Martikyan" },
        { vp: "758298", name: "Philipp Bronckhorst" }, { vp: "751463", name: "Thilo Urban" },
        { vp: "779810 ", name: "Nawied Hamdani-Foyan" }
    ];

    // Hilfsfunktion zum Setzen von Werten in PrimeFaces/JSF-Inputs
    function setInputValue(inputEl, value) {
        if (!inputEl) return;
        inputEl.value = value;
        // Trigger Events damit JSF/PrimeFaces merkt, dass sich was getan hat
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function setupAutocomplete(nameInput, vpInput) {
        if (!nameInput || nameInput.dataset.helperActive) return;
        nameInput.dataset.helperActive = "true";

        const datalistId = "partnerList_" + Math.random().toString(36).substr(2, 9);
        const dl = document.createElement('datalist');
        dl.id = datalistId;
        PARTNER_DATA.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.name;
            opt.textContent = p.vp;
            dl.appendChild(opt);
        });
        document.body.appendChild(dl);
        nameInput.setAttribute('list', datalistId);

        nameInput.addEventListener('input', (e) => {
            const selected = PARTNER_DATA.find(p => p.name === e.target.value);
            if (selected && vpInput) {
                setInputValue(vpInput, selected.vp);
            }
        });
    }

    function injectQuickButtons(container, targetPairs) {
        if (container.querySelector('.quick-partner-bar')) return;

        const bar = document.createElement('div');
        bar.className = 'quick-partner-bar';
        bar.style = "padding: 10px; background: #f4f4f4; border-bottom: 1px solid #ccc; display: flex; flex-wrap: wrap; gap: 5px;";

        PARTNER_DATA.forEach(p => {
            const btn = document.createElement('button');
            btn.innerText = p.name.split(' ')[0]; // Vorname als Label
            btn.title = `${p.name} (${p.vp})`;
            btn.type = "button";
            btn.style = "cursor: pointer; padding: 2px 8px; font-size: 11px; border: 1px solid #999; border-radius: 3px; background: #fff;";

            btn.onclick = (e) => {
                e.preventDefault();
                // Fülle das erste freie Paar oder das aktuell fokussierte
                const activeEl = document.activeElement;
                let pair = targetPairs[0]; // Standard: Vertriebspartner

                // Wenn Fokus in einem Splitt-Feld ist, nimm das entsprechende Paar
                targetPairs.forEach(tp => {
                    if (activeEl === tp.name || activeEl === tp.vp) pair = tp;
                });

                setInputValue(pair.name, p.name);
                setInputValue(pair.vp, p.vp);
            };
            bar.appendChild(btn);
        });

        container.prepend(bar);
    }

    function initHelper() {
        const dialog = document.getElementById('ajaxDialog0');
        if (!dialog || dialog.style.visibility === 'hidden') return;

        // IDs aus deinem HTML extrahieren (ACHTUNG: PrimeFaces IDs ändern sich oft am Ende)
        // Wir nutzen Selektoren, die auf den ID-Endungen basieren
        const getEl = (suffix) => dialog.querySelector(`[id$=':${suffix}']`);

        const pairs = [
            { name: getEl('j_idt2085'), vp: getEl('j_idt2081') }, // Vertriebspartner
            { name: getEl('j_idt2101'), vp: getEl('j_idt2097') }, // Verkaufsbegleiter
            { name: getEl('j_idt2116'), vp: getEl('j_idt2112') }  // 1. Splitt Partner
        ];

        // Autocomplete für alle Paare aktivieren
        pairs.forEach(pair => {
            if (pair.name && pair.vp) setupAutocomplete(pair.name, pair.vp);
        });

        // Quick Buttons oben einfügen
        const content = dialog.querySelector('.ui-dialog-content');
        if (content) injectQuickButtons(content, pairs);
    }

    // Observer, um auf das Erscheinen des Dialogs zu reagieren (AJAX-sicher)
    const observer = new MutationObserver(() => {
        initHelper();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();