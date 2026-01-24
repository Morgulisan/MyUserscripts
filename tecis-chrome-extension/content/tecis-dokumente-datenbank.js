(async function() {
    'use strict';

    function addStyle(cssText) {
        const style = document.createElement('style');
        style.textContent = cssText;
        document.head.appendChild(style);
    }

    try {
        addStyle(`
        div.awd-content-fixed { top: 80px !important; }
        div.awd-concept-title-buttons { height: 85px !important; }
    `);
    } catch (e){

    }

    const { PDFDocument } = PDFLib;

    // --- ⬇️ EDIT THIS SECTION FOR CONCATENATION RULES ⬇️ ---
    // This map defines reusable concatenation rules. The server can refer to these
    // rules by their key (e.g., "concat_Name_Vorname").
    const concatenationMap = {
        // CORRECTED: Using a filter that checks for the primary address flag ("primaer": true)
        "concat_Strasse_Hausnummer" : ["$.adressen[?(@.primaer==true)].strasseHausnummer.strasse", " ", "$.adressen[?(@.primaer==true)].strasseHausnummer.hausNr"],
        "concat_PLZ_Ort" : ["$.adressen[?(@.primaer==true)].plzOrt.postleitzahl", " ", "$.adressen[?(@.primaer==true)].plzOrt.ort"],
        "concat_Name_Vorname": ["$.nachname",  ", ",  "$.vorname"],
        "concat_Vorname_Nachname": ["$.vorname",  " ",  "$.nachname"],
    };
    // --- ⬆️ END OF EDITABLE SECTION ⬆️ ---

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

    // Extension background fetch helper that returns JSON
    function extensionFetchJson(url, { method = "GET", headers = {}, body = null, withCredentials = true } = {}) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
                {
                    type: "fetchJson",
                    url,
                    options: {
                        method,
                        headers,
                        body,
                        credentials: withCredentials ? "include" : "omit"
                    }
                },
                (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }
                    if (!response) {
                        reject(new Error("No response from background"));
                        return;
                    }
                    if (response.error) {
                        reject(new Error(response.error));
                        return;
                    }
                    if (!response.ok) {
                        const err = new Error(`HTTP ${response.status} for ${url}`);
                        err.status = response.status;
                        err.data = response.data;
                        reject(err);
                        return;
                    }
                    resolve(response.data);
                }
            );
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
        const data = await extensionFetchJson(pdfTemplatesUrl);
        if (data.status === 'success' && Array.isArray(data.templates)) {
            pdfTemplates = data.templates;
        } else {
            throw new Error(data.message || 'Error retrieving PDF templates');
        }
    } catch (err) {
        console.error('Failed to fetch PDF templates:', err);
        return;
    }

    let customerID;
    document.querySelectorAll('.navigation_item_double').forEach(el => {
        const text = el.innerText.trim();
        if (/^\(\d+\)$/.test(text)) { // matches something like "(147566674)"
            customerID = text.slice(1, -1);
        }
    });
    const beraterID = document.querySelector("#page\\:center\\:exitForm\\:beraterInfoLink").innerText.slice(-6,);

    // --- Step B: Fetch live personal data from the CRM API ---
    const personalDataUrl = 'https://www.crm.vertrieb-plattform.de/kundendetails-personalien/api/personalien/person/' + customerID + '?betreuerNr=' + beraterID;
    let personalData = {};
    try {
        const personalDataJson = await extensionFetchJson(personalDataUrl);
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
    container.style.display = 'block';
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
                if(template.gespraechsnotiz_name == null) {
                    await performAction(async () => {
                        const chkboxSelector = "#dialogForm0\\:chkbxNoGespraechsnotiz > div.ui-chkbox-box.ui-widget.ui-corner-all.ui-state-default";
                        const chkbox = document.querySelector(chkboxSelector);
                        if (!chkbox) throw new Error("Checkbox element not found.");
                        chkbox.click();
                        await wait(100);
                    });
                }
                else {
                    // Tampermonkey userscript body (run-at document-idle or after page is up)
                    (function() {
                        // Helper: escape JSF colons in CSS selectors
                        const esc = id => id.replace(/:/g, '\\:');

                        // Wait for an element to become present + (optionally) visible
                        function waitFor(sel, {visible=false, timeout=5000} = {}) {
                            return new Promise((resolve, reject) => {
                                const start = performance.now();
                                const tm = setInterval(() => {
                                    const el = document.querySelector(sel);
                                    if (el && (!visible || getComputedStyle(el).display !== 'none')) {
                                        clearInterval(tm); resolve(el);
                                    } else if (performance.now() - start > timeout) {
                                        clearInterval(tm); reject(new Error('Timeout waiting for ' + sel));
                                    }
                                }, 50);
                            });
                        }

                        async function selectMenuItemByText({buttonId, menuId, labelText}) {
                            // 1) open the menu
                            const btn = await waitFor('#' + esc(buttonId), {visible:true});
                            btn.click();

                            // 2) wait until menu is visible
                            const menu = await waitFor('#' + esc(menuId), {visible:true});

                            // 3) find the <span class="ui-menuitem-text"> with the label
                            const items = menu.querySelectorAll('li.ui-menuitem a.ui-menuitem-link .ui-menuitem-text');
                            const targetSpan = Array.from(items).find(s => s.textContent.trim() === labelText);
                            if (!targetSpan) throw new Error('Menu item not found: ' + labelText);

                            // 4) click it (on the A or the span is fine)
                            targetSpan.click();
                        }

                        // Example call: adapt the label to what you actually need
                        selectMenuItemByText({
                            buttonId: 'dialogForm0:gn_auswahl_button',
                            menuId:   'dialogForm0:gn_menu',
                            labelText: template.gespraechsnotiz_name // <- exact visible label
                        }).catch(console.error);

                    })();

                }

                // Step 4: Set the title field with the template name
                await performAction(async () => {
                    const titleInput = document.querySelector("#dialogForm0\\:bezeichnung_input");
                    if (!titleInput) throw new Error("Title input element not found.");
                    titleInput.value = template.name;
                    await wait(100);
                });

                // Step 5: Fetch and process the PDF file upload
                await performAction(async () => {
                    const fileInput = document.querySelector("#dialogForm0\\:fileUpload_anschreibenantrag_input");
                    if (!fileInput) throw new Error("File input element not found.");

                    // *** NEW: Fetch the PDF file on demand ***
                    let pdfData;
                    try {
                        pdfData = await extensionFetchJson(template.pdf_url);
                        if (pdfData.status !== 'success' || !pdfData.pdf) {
                            throw new Error(pdfData.message || 'Error fetching PDF file');
                        }
                    } catch (err) {
                        console.error('Error fetching PDF file:', err);
                        return;
                    }
                    const pdfBase64 = pdfData.pdf;

                    // Convert the stored Base64 PDF into a Blob
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
                        const existingPdfBytes = await pdfBlob.arrayBuffer();
                        const pdfDoc = await PDFDocument.load(existingPdfBytes);
                        const form = pdfDoc.getForm();

                        // Debug: Log all fields found in the PDF
                        const fields = form.getFields();
                        console.log("Found PDF fields:");
                        fields.forEach(field => console.log(`- ${field.getName()}`));

                        // Use the field_mappings from the template
                        const mappings = template.field_mappings || {};
                        for (const [pdfFieldName, dataKey] of Object.entries(mappings)) {
                            try {
                                let finalValue;

                                // First, check if the dataKey from the server is a key in our local concat map.
                                if (concatenationMap.hasOwnProperty(dataKey)) {
                                    // It is! Perform the concatenation.
                                    const ruleParts = concatenationMap[dataKey];
                                    const resolvedParts = ruleParts.map(part => {
                                        if (typeof part === 'string' && part.startsWith('$')) {
                                            return resolveJsonPath(personalData, part) || '';
                                        }
                                        return part; // It's a literal string
                                    });
                                    finalValue = resolvedParts.join('');
                                } else {
                                    // It's not a concat rule, so treat it as a normal data path.
                                    finalValue = resolveJsonPath(personalData, dataKey) || "";
                                }

                                const textField = form.getTextField(pdfFieldName);
                                textField.setText(String(finalValue));

                            } catch (e) {
                                console.warn(`Field "${pdfFieldName}" with rule "${dataKey}" could not be set.`, e);
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

            sequentialExecution().catch(console.error);
        });
    });

    // --- Enhanced JSONPath Resolver ---
    // This helper tokenizes the JSONPath string (splitting on dots not within brackets)
    // and supports filter expressions like: [?( @.prop==value )]
    function tokenizePath(path) {
        // Remove leading "$" and optional dot.
        if (path.startsWith('$')) {
            path = path.substring(1);
        }
        if (path.startsWith('.')) {
            path = path.substring(1);
        }
        const tokens = [];
        let current = "";
        let inBracket = false;
        let bracketCount = 0;
        for (let char of path) {
            if (char === '[') {
                inBracket = true;
                bracketCount++;
                current += char;
            } else if (char === ']') {
                current += char;
                bracketCount--;
                if (bracketCount === 0) {
                    inBracket = false;
                }
            } else if (char === '.' && !inBracket) {
                tokens.push(current);
                current = "";
            } else {
                current += char;
            }
        }
        if (current) {
            tokens.push(current);
        }
        return tokens;
    }

    // The new resolveJsonPath now supports filter expressions that include nested dot notation.
    function resolveJsonPath(obj, path) {
        if (!path) return undefined;
        // If the path does not start with '$', assume it's a direct property name.
        if (!path.startsWith('$')) {
            return obj[path];
        }
        const tokens = tokenizePath(path);
        let current = obj;
        for (let token of tokens) {
            if (token === "") continue;

            // Check for filter expression of the form: property[?(@.prop operator value)]
            const filterMatch = token.match(/^(.*?)\[\?\(@\.(.*?)\s*(==|!=|>|>=|<|<=)\s*(.*?)\)\]$/);
            if (filterMatch) {
                const prop = filterMatch[1];
                const filterProp = filterMatch[2];
                const operator = filterMatch[3];
                let compValue = filterMatch[4];
                // Remove any surrounding quotes from the comparison value.
                compValue = compValue.replace(/^['"]|['"]$/g, '');
                if (compValue === 'true') compValue = true; // Handle boolean true
                if (compValue === 'false') compValue = false; // Handle boolean false

                current = current[prop];
                if (!Array.isArray(current)) return undefined;
                const filtered = current.filter(item => {
                    const left = item[filterProp];
                    switch (operator) {
                        case '==': return left == compValue;
                        case '!=': return left != compValue;
                        case '>':  return left > compValue;
                        case '>=': return left >= compValue;
                        case '<':  return left < compValue;
                        case '<=': return left <= compValue;
                        default: return false;
                    }
                });
                if (filtered.length === 0) return undefined;
                current = (filtered.length === 1) ? filtered[0] : filtered;
                continue;
            }

            // Check for array index token e.g., "adressen[0]"
            const arrayMatch = token.match(/^(.*?)\[(\d+)\]$/);
            if (arrayMatch) {
                const prop = arrayMatch[1];
                const index = parseInt(arrayMatch[2], 10);
                current = current[prop];
                if (!Array.isArray(current)) return undefined;
                current = current[index];
                continue;
            }

            // Regular property access.
            current = current[token];
            if (current === undefined) return undefined;
        }
        return current;
    }

})();
