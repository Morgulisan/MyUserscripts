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
    console.log("Commission Table Enhancer script started (v0.4).");

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

            const ermVolumen = parseFloat(cells[3].textContent.trim().replace('€', '').replace(/\./g, '').replace(',', '.'));
            const provisionBrutto = parseFloat(cells[5].textContent.trim().replace('€', '').replace(/\./g, '').replace(',', '.'));

            if (isNaN(ermVolumen) || isNaN(provisionBrutto) || isNaN(abrechnungsdatum.getTime())) {
                return null; // Invalid data
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
    const dataRows = commissionTable.querySelectorAll('.tableRowOdd, .tableRowEven');
    console.log(`Found ${dataRows.length} data rows to process.`);

    for (let i = 0; i < dataRows.length; i++) {
        const currentRow = dataRows[i];

        // Skip this row if it was already handled as the second part of a cancellation pair
        if (currentRow.dataset.isHandled) {
            console.log(`--- Skipping Row ${i + 1} as it was handled as part of a storno ---`);
            continue;
        }
        console.log(`--- Processing Row ${i + 1} ---`);
        const currentData = parseRowData(currentRow);
        if (!currentData) continue;

        // --- Look ahead to the next row to check for a cancellation pair ---
        let isStornoPair = false;
        if (i + 1 < dataRows.length) {
            const nextRow = dataRows[i + 1];
            const nextData = parseRowData(nextRow);

            // Storno condition: next row's provision is the exact negative of the current row's
            if (nextData && currentData.provisionBrutto > 0 && Math.abs(currentData.provisionBrutto + nextData.provisionBrutto) < 0.01) {
                console.log(`Found a storno pair: Row ${i + 1} and Row ${i + 2}.`);
                isStornoPair = true;

                const stornoDate = nextData.abrechnungsdatum.toLocaleDateString('de-DE', {
                    day: '2-digit', month: '2-digit', year: 'numeric'
                });

                // Process both rows of the pair now
                appendCalculatedCells(currentRow, 0, 0, stornoDate);
                appendCalculatedCells(nextRow, 0, 0, stornoDate);
                nextRow.dataset.isHandled = true; // Mark the next row to be skipped in the loop
            }
        }

        // --- If it's not a storno, process as a normal row ---
        if (!isStornoPair) {
            const startDate = new Date(currentData.abrechnungsdatum);
            startDate.setMonth(startDate.getMonth() + 1); // Vesting starts 1 month after the date

            const today = new Date();
            const monthsPassed = (today.getFullYear() - startDate.getFullYear()) * 12 + (today.getMonth() - startDate.getMonth());
            const monthsRemaining = Math.max(0, 60 - monthsPassed);

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