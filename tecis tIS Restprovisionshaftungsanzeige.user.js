// ==UserScript==
// @name         tecis tIS Restprovisionshaftungsanzeige
// @namespace    http://tampermonkey.net/
// @version      0.4
// @description  Zeigt im tIS die noch zu verdiendende Provision an (Vereinfachte annahme 1/60)
// @author       Malte Kretzschmar
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tecis.de
// @match        https://reporting.slotbasis.crm.vertrieb-plattform.de/reporting/commission/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- Start of Script ---
    console.log("Commission Table Enhancer script started (v0.5).");

    const commissionTable = document.querySelector('table > tbody > tr > td > table[width="100%"]');

    if (!commissionTable) {
        console.error("Error: Could not find the commission table.");
        return;
    }
    console.log("Successfully found the commission table:", commissionTable);

    // --- 1. Add New Headers to the Table ---
    const headerRow = commissionTable.querySelector('.tableHeader');
    if (headerRow) {
        const provisionNettoHeader = Array.from(headerRow.cells).find(cell => cell.textContent.trim() === 'Provision (netto)');
        if (provisionNettoHeader) {
            const offeneProvisionHeader = document.createElement('td');
            offeneProvisionHeader.textContent = 'Offene Provision';
            const offenesVolumenHeader = document.createElement('td');
            offenesVolumenHeader.textContent = 'Offenes Volumen';
            const verdientBisHeader = document.createElement('td');
            verdientBisHeader.textContent = 'Verdient bis';

            provisionNettoHeader.insertAdjacentElement('afterend', verdientBisHeader);
            provisionNettoHeader.insertAdjacentElement('afterend', offenesVolumenHeader);
            provisionNettoHeader.insertAdjacentElement('afterend', offeneProvisionHeader);
            console.log("Successfully added new headers.");
        } else {
            console.error("Could not find 'Provision (netto)' header cell.");
        }
    } else {
        console.error("Could not find the header row.");
    }

    // --- Helper function to parse data from a table row ---
    const parseRowData = (row) => {
        if (!row || row.cells.length < 8) return null;
        const cells = row.cells;
        try {
            const abrechnungsdatumText = cells[0].textContent.trim();
            const [day, month, year] = abrechnungsdatumText.split('.').map(Number);
            const abrechnungsdatum = new Date(year, month - 1, day);

            // Handle German number formats (e.g., -4.791,91)
            const ermVolumen = parseFloat(cells[3].textContent.trim().replace('€', '').replace(/\./g, '').replace(',', '.'));
            const provisionBrutto = parseFloat(cells[5].textContent.trim().replace('€', '').replace(/\./g, '').replace(',', '.'));

            if (isNaN(ermVolumen) || isNaN(provisionBrutto) || isNaN(abrechnungsdatum.getTime())) {
                console.warn("Invalid data in row, skipping parse:", row);
                return null;
            }
            return { abrechnungsdatum, ermVolumen, provisionBrutto };
        } catch (e) {
            console.warn("Could not parse row:", row, e);
            return null;
        }
    };

    // --- Helper function to append the new cells to a row ---
    const appendCalculatedCells = (row, offeneProvision, offenesVolumen, verdientBisString) => {
        const provisionNettoCell = row.cells[7];
        if (!provisionNettoCell) return;

        const offeneProvisionCell = document.createElement('td');
        offeneProvisionCell.textContent = offeneProvision.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
        offeneProvisionCell.style.textAlign = 'right';

        const offenesVolumenCell = document.createElement('td');
        offenesVolumenCell.textContent = offenesVolumen.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
        offenesVolumenCell.style.textAlign = 'right';

        const verdientBisCell = document.createElement('td');
        verdientBisCell.textContent = verdientBisString;

        provisionNettoCell.insertAdjacentElement('afterend', verdientBisCell);
        provisionNettoCell.insertAdjacentElement('afterend', offenesVolumenCell);
        provisionNettoCell.insertAdjacentElement('afterend', offeneProvisionCell);
    };

    // --- 2. Process Data Rows ---
    const dataRows = Array.from(commissionTable.querySelectorAll('.tableRowOdd, .tableRowEven'));
    console.log(`Found ${dataRows.length} data rows to process.`);

    for (let i = 0; i < dataRows.length; i++) {
        const currentRow = dataRows[i];

        if (currentRow.dataset.isHandled) {
            console.log(`--- Skipping Row ${i + 1} as it was handled as part of a storno ---`);
            continue;
        }
        console.log(`--- Processing Row ${i + 1} ---`);
        const currentData = parseRowData(currentRow);
        if (!currentData) continue;

        let isStornoPair = false;
        if (i + 1 < dataRows.length) {
            const nextRow = dataRows[i + 1];
            const nextData = parseRowData(nextRow);

            // *** FIX: Check for exact opposite values, regardless of which is positive or negative ***
            // Using a small tolerance (0.01) for floating point comparisons
            const isMatchingPair = nextData &&
                Math.abs(currentData.provisionBrutto + nextData.provisionBrutto) < 0.01 &&
                Math.abs(currentData.ermVolumen + nextData.ermVolumen) < 0.01;

            if (isMatchingPair) {
                console.log(`Found a storno pair: Row ${i + 1} and Row ${i + 2}.`);
                isStornoPair = true;

                // *** FIX: Use the LATER of the two dates as the cancellation date ***
                const finalDate = currentData.abrechnungsdatum > nextData.abrechnungsdatum ? currentData.abrechnungsdatum : nextData.abrechnungsdatum;
                const stornoDateString = finalDate.toLocaleDateString('de-DE', {
                    day: '2-digit', month: '2-digit', year: 'numeric'
                });

                // Set both rows of the pair to have 0 open commission and the same end date
                appendCalculatedCells(currentRow, 0, 0, stornoDateString);
                appendCalculatedCells(nextRow, 0, 0, stornoDateString);
                nextRow.dataset.isHandled = true; // Mark the next row to be skipped
            }
        }

        // --- If it's not part of a storno pair, process as a normal row ---
        if (!isStornoPair) {
            const startDate = new Date(currentData.abrechnungsdatum);
            startDate.setMonth(startDate.getMonth() + 1);

            const today = new Date();
            const monthsPassed = (today.getFullYear() - startDate.getFullYear()) * 12 + (today.getMonth() - startDate.getMonth());
            const monthsRemaining = Math.max(0, 60 - monthsPassed);

            // Handle negative provisions correctly in the standard calculation
            const offeneProvision = (currentData.provisionBrutto / 60) * monthsRemaining;
            const offenesVolumen = (currentData.ermVolumen / 60) * monthsRemaining;

            const verdientBisDate = new Date(currentData.abrechnungsdatum);
            verdientBisDate.setMonth(verdientBisDate.getMonth() + 60);
            const verdientBisString = verdientBisDate.toLocaleDateString('de-DE', {
                day: '2-digit', month: '2-digit', year: 'numeric'
            });

            console.log(`Normal row calculation: Months Remaining=${monthsRemaining}, Offene Provision=${offeneProvision.toFixed(2)}`);
            appendCalculatedCells(currentRow, offeneProvision, offenesVolumen, verdientBisString);
        }
    }

    console.log("--- Script finished processing all rows. ---");

})();