// ==UserScript==
// @name         tecis PrefillForm Store
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Dynamically load PDF templates from a server and Fills them up
// @author       Malte Kretzschmar
// @match        https://bm.bp.vertrieb-plattform.de/bm/*
// @grant        GM_xmlhttpRequest
// @connect      mopoliti.de
// @connect      www.crm.vertrieb-plattform.de
// @require      https://cdn.jsdelivr.net/npm/pdf-lib/dist/pdf-lib.min.js
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tecis.de
// ==/UserScript==

(async function() {
    'use strict';
    const { PDFDocument } = PDFLib;

    // Utility: Wait for an element to appear in the DOM
    async function waitForElement(selector, timeout = 100000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            const element = document.querySelector(selector);
            if (element) return element;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error(`Element not found for selector: ${selector}`);
    }

    // GM_xmlhttpRequest-based fetch function that returns a Promise
    function gmFetch(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: url,
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        resolve(data);
                    } catch (e) {
                        reject(e);
                    }
                },
                onerror: function(err) {
                    reject(err);
                }
            });
        });
    }

    // Wait for the header that should contain "Eigene Vorgänge"
    try {
        const header = await waitForElement('#page\\:center\\:content > h1');
        if (!header.textContent.includes('Eigene Vorgänge')) {
            console.log('Header does not contain "Eigene Vorgänge". Script not executed.');
            return;
        }
    } catch (error) {
        console.error(error.message);
        return;
    }

    // --- Step A: Fetch available PDF templates from your server ---
    const pdfTemplatesUrl = 'https://mopoliti.de/tecis/Store/get_pdf_templates.php';
    let pdfTemplates = [];
    try {
        const data = await gmFetch(pdfTemplatesUrl);
        if (data.status === 'success' && Array.isArray(data.templates)) {
            pdfTemplates = data.templates;
        } else {
            throw new Error(data.message || 'Error retrieving PDF templates');
        }
    } catch (err) {
        console.error('Failed to fetch PDF templates:', err);
        return;
    }

    const customerID = document.querySelector("#page\\:center\\:navigationForm\\:j_idt33\\:j_idt37\\:2\\:j_idt40 > div.navigation_item_double").innerText.slice(1,-1);
    const beraterID = document.querySelector("#page\\:center\\:exitForm\\:beraterInfoLink").innerText.slice(-6,);

    // --- Step B: Fetch live personal data from the CRM API ---
    const personalDataUrl = 'https://www.crm.vertrieb-plattform.de/kundendetails-personalien/api/personalien/person/'+ customerID + '?betreuerNr=' + beraterID;
    let personalData = {};
    try {
        const personalDataJson = await gmFetch(personalDataUrl);
        if (personalDataJson && Array.isArray(personalDataJson.resultData) && personalDataJson.resultData.length > 0) {
            personalData = personalDataJson.resultData[0];
        } else {
            throw new Error('Invalid personal data format.');
        }
    } catch (err) {
        console.error('Failed to fetch personal data:', err);
        return;
    }

    // --- Locate the DOM element where the new buttons will be added ---
    const titleButtons = document.querySelector('#page\\:center\\:contentForm\\:titleButtons');
    if (!titleButtons) {
        console.error('Could not find the titleButtons element.');
        return;
    }

    // Create a container for our new PDF buttons
    const container = document.createElement('span');
    titleButtons.appendChild(container);

    // Helper: Create a button for each PDF template
    pdfTemplates.forEach(template => {
        const btn = document.createElement('button');
        btn.id = `pdf-button-${template.id}`;
        btn.className = 'ui-button ui-widget ui-state-default ui-corner-all ui-button-text-only';
        btn.style.marginRight = '5px';
        btn.innerHTML = `<span class="ui-button-text ui-c">${template.button_name}</span>`;
        container.appendChild(btn);

        btn.addEventListener('click', async function(event) {
            event.preventDefault();

            // --- A helper to perform an action with retries ---
            async function performAction(action, retries = 3) {
                for (let attempt = 0; attempt < retries; attempt++) {
                    try {
                        await action();
                        return true;
                    } catch (error) {
                        console.error(`Attempt ${attempt + 1} failed:`, error);
                        if (attempt < retries - 1) {
                            await new Promise(resolve => setTimeout(resolve, 500));
                        } else {
                            console.error("All retries failed.");
                            return false;
                        }
                    }
                }
            }

            // --- Sequential UI interactions ---
            async function sequentialExecution() {
                const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

                // Step 1: Click the "add Vorgang" button
                await performAction(async () => {
                    document.querySelector("#page\\:center\\:contentForm\\:addVorgang > span").click();
                    await wait(200);
                });

                // Step 2: Select the "Änderung/Erhöhung" menu item
                await performAction(async () => {
                    const menuItem = Array.from(document.querySelectorAll("span.ui-menuitem-text"))
                        .find(el => el.textContent.trim() === "Änderung/Erhöhung");
                    if (!menuItem) throw new Error('Menu item "Änderung/Erhöhung" not found.');
                    menuItem.click();
                    await wait(400);
                });

                // Step 3: Automatically handle the checkbox (simulate a click)
                await performAction(async () => {
                    const chkboxSelector = "#dialogForm0\\:chkbxNoGespraechsnotiz > div.ui-chkbox-box.ui-widget.ui-corner-all.ui-state-default";
                    const chkbox = document.querySelector(chkboxSelector);
                    if (!chkbox) throw new Error("Checkbox element not found.");
                    // Simply click the checkbox (as in the original static script)
                    chkbox.click();
                    await wait(100);
                });

                // Step 4: Set the title field (dialogForm0:bezeichnung_input) with the template name
                await performAction(async () => {
                    const titleInput = document.querySelector("#dialogForm0\\:bezeichnung_input");
                    if (!titleInput) throw new Error("Title input element not found.");
                    titleInput.value = template.name;
                    await wait(100);
                });

                // Step 5: Process the PDF file upload
                await performAction(async () => {
                    const fileInput = document.querySelector("#dialogForm0\\:fileUpload_anschreibenantrag_input");
                    if (!fileInput) throw new Error("File input element not found.");

                    // Convert the stored Base64 PDF into a Blob
                    const pdfBase64 = template.pdf; // from the PHP response
                    function base64ToBlob(base64, contentType = 'application/pdf') {
                        const byteCharacters = atob(base64);
                        const byteNumbers = new Array(byteCharacters.length);
                        for (let i = 0; i < byteCharacters.length; i++) {
                            byteNumbers[i] = byteCharacters.charCodeAt(i);
                        }
                        const byteArray = new Uint8Array(byteNumbers);
                        return new Blob([byteArray], { type: contentType });
                    }
                    let pdfBlob = base64ToBlob(pdfBase64, 'application/pdf');

                    // Use PDFLib to fill in the PDF fields based on the template's field mappings
                    try {
                        // Convert the Blob into an ArrayBuffer
                        const existingPdfBytes = await pdfBlob.arrayBuffer();
                        const pdfDoc = await PDFDocument.load(existingPdfBytes);
                        const form = pdfDoc.getForm();

                        // Log all fields found in the PDF (for debugging)
                        const fields = form.getFields();
                        console.log("Found PDF fields:");
                        fields.forEach(field => console.log(`- ${field.getName()}`));

                        // Use the field_mappings from the template.
                        // Example: { "Name": "nachname", "Vorname": "vorname", ... }
                        const mappings = template.field_mappings || {};
                        for (const [pdfFieldName, dataKey] of Object.entries(mappings)) {
                            try {
                                // Use resolveJsonPath to support nested JSON keys (or direct property names)
                                const value = resolveJsonPath(personalData, dataKey) || "";
                                // Find the text field in the PDF by name:
                                const textField = form.getTextField(pdfFieldName);
                                textField.setText(String(value));
                            } catch (e) {
                                console.warn(`Field "${pdfFieldName}" not found in the PDF or could not be set.`, e);
                            }
                        }

                        // Save the filled PDF and update pdfBlob
                        const newPdfBytes = await pdfDoc.save();
                        pdfBlob = new Blob([newPdfBytes], { type: 'application/pdf' });
                        console.log("PDF fields have been filled.");
                    } catch (err) {
                        console.warn("PDFLib processing failed. Uploading original PDF.", err);
                    }

                    // Create a File object from the Blob and attach it to the file input
                    const file = new File([pdfBlob], "Antrag.pdf", { type: pdfBlob.type });
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    fileInput.files = dataTransfer.files;
                    fileInput.dispatchEvent(new Event("change"));
                    await wait(200);
                });
            }

            // Execute the sequence; log errors if any
            sequentialExecution().catch(console.error);
        });
    });

    // Simple JSONPath resolver for limited functionality.
    // Supports paths like $.adressen[0].strasseHausnummer.strasse
    function resolveJsonPath(obj, path) {
        try {
            if (!path.startsWith('$')) {
                // Not a JSONPath; treat as a direct property.
                return obj[path];
            }
            // Remove the leading '$' and any dot that immediately follows.
            path = path.replace(/^\$\.*?/, '');
            // Split the path into tokens by dot.
            const tokens = path.split('.').filter(token => token);
            let current = obj;
            for (let token of tokens) {
                // Check if the token contains a filter expression like:
                // "legitimationen[?(@.dokumentTyp==6)]"
                const filterMatch = token.match(/(.*?)\[\?\(@\.(.*?)\s*([=!><]=?)\s*(.*?)\)\]/);
                if (filterMatch) {
                    const arrayProp = filterMatch[1]; // e.g. "legitimationen"
                    const left = filterMatch[2];        // e.g. "dokumentTyp"
                    const operator = filterMatch[3];    // e.g. "=="
                    let right = filterMatch[4];         // e.g. "6"
                    // Remove any surrounding quotes from the right-hand side.
                    right = right.replace(/^['"]|['"]$/g, '');
                    // Navigate to the array.
                    current = current[arrayProp];
                    if (!Array.isArray(current)) return undefined;
                    // Filter the array based on the condition.
                    let filtered = current.filter(item => {
                        const itemValue = item[left];
                        switch (operator) {
                            case '==': return itemValue == right;
                            case '!=': return itemValue != right;
                            case '>':  return itemValue > right;
                            case '>=': return itemValue >= right;
                            case '<':  return itemValue < right;
                            case '<=': return itemValue <= right;
                            default: return false;
                        }
                    });
                    // If no matches were found, return undefined.
                    if (filtered.length === 0) return undefined;
                    // If the filter returns a single match, use that object for further resolution.
                    current = filtered.length === 1 ? filtered[0] : filtered;
                } else {
                    // Handle tokens with an array index, e.g., "adressen[0]"
                    const arrayMatch = token.match(/(.*?)\[(\d+)\]$/);
                    if (arrayMatch) {
                        const prop = arrayMatch[1];
                        const index = parseInt(arrayMatch[2], 10);
                        current = current[prop];
                        if (!Array.isArray(current)) return undefined;
                        current = current[index];
                    } else {
                        // Regular object property.
                        current = current[token];
                    }
                }
                if (current === undefined) return undefined;
            }
            return current;
        } catch (e) {
            console.error('Error resolving JSONPath', path, e);
            return undefined;
        }
    }

})();
