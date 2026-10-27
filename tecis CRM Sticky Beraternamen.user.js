// ==UserScript==
// @name         tecis CRM Sticky Beraternamen
// @namespace    http://tampermonkey.net/
// @version      1.0
// @updateURL    https://mopoliti.de/Userscripts/tecis%20CRM%20Sticky%20Beraternamen.user.js
// @description  Fixiert die Berater- und Teamnamen beim horizontalen Scrollen der Teamterminübersicht.
// @author       Malte Kretzschmar
// @match        https://www.crm.vertrieb-plattform.de/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tecis.de
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // Der breite @match berücksichtigt auch die interne SPA-Navigation im CRM.
    const TARGET_PATH = '/betreuung/crm/hauptnavigation/aktivitaeten/teamterminuebersicht';
    const TABLE_CLASS = 'tecis-sticky-berater-table';

    const style = document.createElement('style');
    style.textContent = `
        table.${TABLE_CLASS} tr > :first-child {
            position: sticky !important;
            left: 0 !important;
            z-index: 5 !important;
            background-color: #fff !important;
            box-shadow: 3px 0 6px -3px rgba(0, 0, 0, 0.3);
        }

        table.${TABLE_CLASS} tr > th:first-child {
            z-index: 6 !important;
        }
    `;
    document.head.appendChild(style);

    function markAdvisorTables() {
        if (location.pathname !== TARGET_PATH) return;

        for (const table of document.querySelectorAll('table')) {
            if (table.classList.contains(TABLE_CLASS)) continue;

            const rows = Array.from(table.rows);
            const isHeaderTable = rows.some(row =>
                row.cells.length >= 10 &&
                /Berater\s*\/\s*Teams/i.test(row.cells[0]?.textContent || '')
            );
            const isAdvisorTable = rows.some(row =>
                row.cells.length >= 10 &&
                row.cells[0]?.tagName === 'TD' &&
                row.cells[0].querySelector('button')
            );

            // Die Terminübersicht verwendet separate Tabellen für Kopf- und Datenzeilen.
            if (isHeaderTable || isAdvisorTable) {
                table.classList.add(TABLE_CLASS);
            }
        }
    }

    let updateScheduled = false;

    function scheduleUpdate() {
        if (updateScheduled || location.pathname !== TARGET_PATH) return;
        updateScheduled = true;

        requestAnimationFrame(() => {
            updateScheduled = false;
            markAdvisorTables();
        });
    }

    // Teams aufklappen, Monat wechseln und Navigation ohne vollständigen Reload.
    const observer = new MutationObserver(scheduleUpdate);
    observer.observe(document.body, { childList: true, subtree: true });

    scheduleUpdate();
})();
