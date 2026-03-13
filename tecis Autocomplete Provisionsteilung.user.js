// ==UserScript==
// @name         tecis BM Provisionsverteilungs Autocomplete
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Autocomplete für Provisionsdialog
// @author       Malte Kretzschmar mit Gemini
// @match        https://bm.bp.vertrieb-plattform.de/bm/*
// @grant        none
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tecis.de
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
        { vp: "779810",  name: "Nawied Hamdani-Foyan" }
    ];

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

        nameInput.addEventListener('input', async (e) => {
            const selected = PARTNER_DATA.find(p => p.name === e.target.value);

            if (selected && vpInput) {
                // Verhindern, dass mehrfache Events gleichzeitig feuern
                if (nameInput.dataset.isUpdating === 'true') return;
                nameInput.dataset.isUpdating = 'true';

                // 1. Tippen in das VP-Feld simulieren
                vpInput.focus();
                vpInput.value = '';
                for (let char of selected.vp) {
                    vpInput.value += char;
                    vpInput.dispatchEvent(new Event('input', { bubbles: true }));
                    // Kurze Pause zwischen den Tastenschlägen simulieren
                    await new Promise(r => setTimeout(r, 20));
                }

                // 2. Das Change-Event für VP auslösen -> Sendet die VP-Nummer ans Backend
                vpInput.dispatchEvent(new Event('change', { bubbles: true }));
                vpInput.blur();

                // 3. WARTEN auf das Backend (PrimeFaces Race-Condition vermeiden)
                // Wenn wir beide Felder gleichzeitig an den Server schicken, überschreibt das System das jeweils andere Feld.
                setTimeout(() => {
                    // DOM könnte durch das AJAX-Update neu geladen worden sein, wir holen uns das Element neu
                    const currentNameInput = document.getElementById(nameInput.id);
                    if (currentNameInput) {
                        currentNameInput.focus();
                        currentNameInput.value = selected.name;
                        currentNameInput.dispatchEvent(new Event('input', { bubbles: true }));

                        // Das Change-Event für den Namen auslösen -> Sendet den Namen ans Backend
                        currentNameInput.dispatchEvent(new Event('change', { bubbles: true }));
                        currentNameInput.blur();
                        currentNameInput.dataset.isUpdating = 'false';
                    }
                }, 800); // 800 Millisekunden Puffer, damit die erste AJAX-Abfrage sicher durch ist
            }
        });
    }

    function initHelper() {
        const dialog = document.getElementById('ajaxDialog0');
        if (!dialog || dialog.style.visibility === 'hidden') return;

        // Wir nutzen Selektoren, die auf den ID-Endungen basieren
        const getEl = (suffix) => dialog.querySelector(`[id$=':${suffix}']`);

        const pairs = [
            { name: getEl('j_idt2085'), vp: getEl('j_idt2081') }, // Vertriebspartner
            { name: getEl('j_idt2101'), vp: getEl('j_idt2097') }, // Verkaufsbegleiter
            { name: getEl('j_idt2116'), vp: getEl('j_idt2112') }  // 1. Splitt Partner
        ];

        // Autocomplete für alle gefundenen Paare aktivieren
        pairs.forEach(pair => {
            if (pair.name && pair.vp) {
                setupAutocomplete(pair.name, pair.vp);
            }
        });
    }

    // Observer reagiert, sobald der Dialog aufpoppt (oder AJAX das DOM erneuert)
    const observer = new MutationObserver(() => {
        initHelper();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();