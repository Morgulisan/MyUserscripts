// ==UserScript==
// @name         tecis tIS Restprovisionshaftungsanzeige
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  Zeigt im tIS die noch zu verdiendende Provision an (Vereinfachte annahme 1/60)
// @author       Malte Kretzschmar
// @match        https://reporting.slotbasis.crm.vertrieb-plattform.de/reporting/commission/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- Start of Script ---
    console.log("Commission Table Enhancer script started.");

    // Find the main commission table. This selector is based on the HTML structure provided.
    const commissionTable = document.querySelector('table > tbody > tr > td > table[width="100%"]');

    if (!commissionTable) {
        console.error("Error: Could not find the commission table. The script will not run. Please check the table selector if the website structure has changed.");
        return; // Stop the script if the table isn't found
    }

    console.log("Successfully found the commission table:", commissionTable);

    // Find the header row to add the new column titles
    const headerRow = commissionTable.querySelector('.tableHeader');
    if (headerRow) {
        console.log("Found header row:", headerRow);

        // Find the "Provision (netto)" header cell, which will be our anchor for adding new columns
        const provisionNettoHeader = Array.from(headerRow.cells).find(cell => cell.textContent.trim() === 'Provision (netto)');

        if (provisionNettoHeader) {
            console.log("Found 'Provision (netto)' header. Adding new headers.");

            // Create new header cells
            const offeneProvisionHeader = document.createElement('td');
            offeneProvisionHeader.textContent = 'Offene Provision';

            const offenesVolumenHeader = document.createElement('td');
            offenesVolumenHeader.textContent = 'Offenes Volumen';

            const verdientBisHeader = document.createElement('td');
            verdientBisHeader.textContent = 'Verdient bis';

            // Insert new headers after the "Provision (netto)" header
            // We insert them one by one, and each new one pushes the previous one to the right.
            provisionNettoHeader.insertAdjacentElement('afterend', verdientBisHeader);
            provisionNettoHeader.insertAdjacentElement('afterend', offenesVolumenHeader);
            provisionNettoHeader.insertAdjacentElement('afterend', offeneProvisionHeader);

            console.log("Successfully added new headers to the table.");
        } else {
            console.error("Could not find the 'Provision (netto)' header cell in the header row.");
        }
    } else {
        console.error("Could not find the header row with class 'tableHeader'.");
    }

    // Process each data row in the table
    const dataRows = commissionTable.querySelectorAll('.tableRowOdd, .tableRowEven');
    console.log(`Found ${dataRows.length} data rows to process.`);

    if (dataRows.length === 0) {
        console.warn("No data rows with classes '.tableRowOdd' or '.tableRowEven' were found.");
    }

    dataRows.forEach((row, index) => {
        console.log(`--- Processing Row ${index + 1} ---`);
        const cells = row.cells;
        const provisionNettoCell = cells[7]; // This is the anchor cell for inserting the new data cells

        // Skip rows that don't have the expected number of columns to prevent errors
        if (cells.length < 8) {
            console.warn("Skipping row because it does not have enough cells:", row);
            return; // continue to next iteration of forEach
        }

        const abrechnungsdatumCell = cells[0];
        const ermVolumenCell = cells[3];
        const provisionBruttoCell = cells[5];

        if (abrechnungsdatumCell && ermVolumenCell && provisionBruttoCell && provisionNettoCell) {
            // --- 1. Extract and Parse Data ---
            const abrechnungsdatumText = abrechnungsdatumCell.textContent.trim();
            const [day, month, year] = abrechnungsdatumText.split('.').map(Number);
            const abrechnungsdatum = new Date(year, month - 1, day);

            // This complex ".replace" chain handles German number formatting (e.g., "2.370,84 €")
            const ermVolumenText = ermVolumenCell.textContent.trim();
            const ermVolumen = parseFloat(ermVolumenText.replace('€', '').replace(/\./g, '').replace(',', '.').trim());

            const provisionBruttoText = provisionBruttoCell.textContent.trim();
            const provisionBrutto = parseFloat(provisionBruttoText.replace('€', '').replace(/\./g, '').replace(',', '.').trim());
            console.log(`Parsed Data: Date=${abrechnungsdatum.toLocaleDateString()}, Volumen=${ermVolumen}, Provision=${provisionBrutto}`);


            // --- 2. Perform Calculations ---
            const startDate = new Date(abrechnungsdatum);
            startDate.setMonth(startDate.getMonth() + 1); // Vesting starts 1 month after the date

            const today = new Date();
            const monthsPassed = (today.getFullYear() - startDate.getFullYear()) * 12 + (today.getMonth() - startDate.getMonth());
            const monthsRemaining = Math.max(0, 60 - monthsPassed);

            const offeneProvision = (provisionBrutto / 60) * monthsRemaining;
            const offenesVolumen = (ermVolumen / 60) * monthsRemaining;

            const verdientBisDate = new Date(abrechnungsdatum);
            verdientBisDate.setMonth(verdientBisDate.getMonth() + 60); // 60 months after the Abrechnungsdatum
            const verdientBisString = verdientBisDate.toLocaleDateString('de-DE', {
                day: '2-digit', month: '2-digit', year: 'numeric'
            });
            console.log(`Calculations: Months Remaining=${monthsRemaining}, Offene Provision=${offeneProvision.toFixed(2)}`);


            // --- 3. Create and Append New Cells to the Row ---
            const offeneProvisionCell = document.createElement('td');
            offeneProvisionCell.textContent = offeneProvision.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
            offeneProvisionCell.style.textAlign = 'right';

            const offenesVolumenCell = document.createElement('td');
            offenesVolumenCell.textContent = offenesVolumen.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
            offenesVolumenCell.style.textAlign = 'right';

            const verdientBisCell = document.createElement('td');
            verdientBisCell.textContent = verdientBisString;

            // Insert new cells after the "Provision (netto)" cell
            provisionNettoCell.insertAdjacentElement('afterend', verdientBisCell);
            provisionNettoCell.insertAdjacentElement('afterend', offenesVolumenCell);
            provisionNettoCell.insertAdjacentElement('afterend', offeneProvisionCell);

            console.log("Successfully created and appended new cells for this row.");
        } else {
            console.warn("Could not find all required data cells in this row:", row);
        }
    });

    console.log("--- Script finished processing all rows. ---");

})(); // --- End of Script ---