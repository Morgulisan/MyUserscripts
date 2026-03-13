// ==UserScript==
// @name         tecis BM Provisionsverteilungs Autocomplete
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Autocomplete für Provisionsteiler Dialog in der BM
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

    // Globale Sperre, die auch AJAX-DOM-Updates überlebt
    let isUpdating = false;

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
            // Wenn gerade ein AJAX-Sync läuft, ignoriere weitere Eingaben
            if (isUpdating) return;

            const selected = PARTNER_DATA.find(p => p.name === e.target.value);
            if (!selected) return;

            // Sperre aktivieren
            isUpdating = true;

            // 1. VP Nummer füllen und Change auslösen (teilt dem Backend die VP mit)
            const currentVpInput = document.getElementById(vpInput.id);
            if (currentVpInput) {
                currentVpInput.value = selected.vp;
                currentVpInput.dispatchEvent(new Event('change', { bubbles: true }));
            }

            // 2. Warten, bis PrimeFaces das Backend-Update verarbeitet hat
            setTimeout(() => {
                // Feld neu suchen, da PrimeFaces das HTML evtl. ausgetauscht hat
                const currentNameInput = document.getElementById(nameInput.id);
                if (currentNameInput) {
                    currentNameInput.value = selected.name;
                    // WICHTIG: Nur 'change' triggern. 'input' würde wieder unsere Funktion auslösen!
                    currentNameInput.dispatchEvent(new Event('change', { bubbles: true }));
                }

                // Sperre nach einem kurzen Moment wieder aufheben
                setTimeout(() => {
                    isUpdating = false;
                }, 300);

            }, 800);
        });
    }

    function initHelper() {
        const dialog = document.getElementById('ajaxDialog0');
        if (!dialog || dialog.style.visibility === 'hidden') return;

        const getEl = (suffix) => dialog.querySelector(`[id$=':${suffix}']`);

        const pairs = [
            { name: getEl('j_idt2085'), vp: getEl('j_idt2081') }, // Vertriebspartner
            { name: getEl('j_idt2101'), vp: getEl('j_idt2097') }, // Verkaufsbegleiter
            { name: getEl('j_idt2116'), vp: getEl('j_idt2112') }  // 1. Splitt Partner
        ];

        pairs.forEach(pair => {
            if (pair.name && pair.vp) {
                setupAutocomplete(pair.name, pair.vp);
            }
        });
    }

    const observer = new MutationObserver(() => {
        initHelper();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();