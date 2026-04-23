// ==UserScript==
// @name         tecis CRM Cross Selling Indicatoren
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Fügt farbige Bubbles basierend auf den Verträgen des Kunden in die Kopfleiste ein.
// @author       Malte Kretzschmar
// @match        https://www.crm.vertrieb-plattform.de/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    let currentKundenNr = null;
    let currentBetreuerNr = null;

    // Farbdefinitionen basierend auf deinem Beispiel
    const colors = {
        green: { bg: 'rgb(76, 175, 80)', color: '#FFFFFF' },
        yellow: { bg: 'rgb(255, 226, 69)', color: 'rgb(61, 61, 61)' },
        red: { bg: 'rgb(244, 67, 54)', color: '#FFFFFF' }
    };

    // 1. API-Requests abfangen, um Kundennummer und Betreuernummer zu extrahieren
    // XHR abfangen
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        this.addEventListener('load', function() {
            if (typeof url === 'string' && url.includes('/kundendetails/api/kundendetails/')) {
                extractIdsAndTrigger(url);
            }
        });
        origOpen.apply(this, arguments);
    };

    // Fetch abfangen
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
        if (url.includes('/kundendetails/api/kundendetails/')) {
            extractIdsAndTrigger(url);
        }
        return originalFetch.apply(this, args);
    };

    function extractIdsAndTrigger(url) {
        // Regex um die IDs aus der URL zu parsen: .../kundendetails/173643983?betreuerNr=775726
        const match = url.match(/\/kundendetails\/(\d+)\?betreuerNr=(\d+)/);
        if (match) {
            currentKundenNr = match[1];
            currentBetreuerNr = match[2];
            loadContractsAndRender();
        }
    }

    // 2. Verträge abrufen
    async function loadContractsAndRender() {
        if (!currentKundenNr || !currentBetreuerNr) return;

        try {
            const fetchUrl = `https://www.crm.vertrieb-plattform.de/kundendetails-dokumente/api/vertraege?kundenNr=${currentKundenNr}&betreuerNr=${currentBetreuerNr}`;
            const response = await window.fetch(fetchUrl, {
                credentials: 'same-origin',
                headers: { 'Accept': 'application/json' }
            });

            if (!response.ok) throw new Error("Netzwerkantwort war nicht ok");

            const data = await response.json();
            const vertraege = data.resultData || [];

            const config = calculateIndicators(vertraege);

            // Warten bis der Target-Button geladen ist
            waitForElement('button[title="Haushaltsfreigaben"]', 10000).then((targetButton) => {
                injectNodes(targetButton, config);
            }).catch(() => {
                console.log("CRM Script: Target-Button 'Haushaltsfreigaben' wurde nicht gefunden.");
            });

        } catch (error) {
            console.error("CRM Script Fehler beim Abrufen der Verträge:", error);
        }
    }

    // 3. Logik zur Auswertung der Sparten
    function calculateIndicators(vertraege) {
        // Nur eigenvermittelte Verträge berücksichtigen
        const eigen = vertraege.filter(v => v.eigenvermittelt === true);

        // Zählen der entsprechenden Produktkürzel
        const counts = {
            AV: eigen.filter(v => ['FRV', 'bAV', 'KRV'].includes(v.produktKuerzel)).length,
            IAA: eigen.filter(v => ['SBU', 'DD', 'IAA', 'RLV', 'PV'].includes(v.produktKuerzel)).length,
            KV: eigen.filter(v => ['GKV', 'PKV'].includes(v.produktKuerzel)).length,
            INV: eigen.filter(v => ['INV'].includes(v.produktKuerzel)).length,
            SACH: eigen.filter(v => ['PHV', 'RSV', 'KFZ', 'HRV', 'WGB'].includes(v.produktKuerzel)).length
        };

        return [
            // AV: grün >= 2, gelb == 1, rot == 0
            { label: 'AV', style: counts.AV >= 2 ? colors.green : (counts.AV === 1 ? colors.yellow : colors.red) },

            // IAA: grün >= 1, rot == 0
            { label: 'IAA', style: counts.IAA >= 1 ? colors.green : colors.red },

            // KV: grün >= 1, rot == 0
            { label: 'KV', style: counts.KV >= 1 ? colors.green : colors.red },

            // INV: grün >= 1, rot == 0
            { label: 'INV', style: counts.INV >= 1 ? colors.green : colors.red },

            // SACH: grün >= 2, gelb == 1, rot == 0
            { label: 'SACH', style: counts.SACH >= 2 ? colors.green : (counts.SACH === 1 ? colors.yellow : colors.red) }
        ];
    }

    // 4. UI Rendering (Erzeugen der Bubbles)
    function injectNodes(targetNode, config) {
        // Vorhandene Indikatoren entfernen, um Duplikate bei SPA Navigation zu verhindern
        const existing = document.getElementById('custom-contract-indicators');
        if (existing) existing.remove();

        // Container bauen
        const container = document.createElement('div');
        container.id = 'custom-contract-indicators';
        container.style.display = 'inline-flex';
        container.style.alignItems = 'center';
        container.style.gap = '8px';
        container.style.marginLeft = '12px';

        // Bubbles bauen
        config.forEach(ind => {
            const bubble = document.createElement('div');
            bubble.className = 'sldo-cl-c-colored-bubble sldo-cl-u-text-white';
            bubble.innerText = ind.label;

            // Styles aus deinem Beispiel anwenden
            Object.assign(bubble.style, {
                backgroundColor: ind.style.bg,
                color: ind.style.color,
                borderRadius: '50px',
                display: 'inline-block',
                fontFamily: 'Carlito, Helvetica, Arial, sans-serif',
                fontSize: '14px', // Leicht verkleinert für besseres Alignment
                fontWeight: '600',
                height: 'auto',
                lineHeight: 'normal',
                margin: '0',
                padding: '2px 10px',
                textAlign: 'center',
                boxSizing: 'border-box'
            });

            container.appendChild(bubble);
        });

        // Nach dem Haushaltsfreigaben-Button einfügen
        targetNode.parentNode.insertBefore(container, targetNode.nextSibling);
    }

    // 5. Hilfsfunktion: Warten, bis ein DOM Element existiert (z.B. für SPA Ladezeiten)
    function waitForElement(selector, timeout) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(selector)) {
                return resolve(document.querySelector(selector));
            }

            const observer = new MutationObserver(() => {
                if (document.querySelector(selector)) {
                    observer.disconnect();
                    resolve(document.querySelector(selector));
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });

            setTimeout(() => {
                observer.disconnect();
                reject(new Error("Timeout"));
            }, timeout);
        });
    }

})();