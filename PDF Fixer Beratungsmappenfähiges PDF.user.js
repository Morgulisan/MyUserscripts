// ==UserScript==
// @name         PDF Fixer Beratungsmappenfähiges PDF (v4 - Final)
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Fängt PDF-Downloads von crm.vertrieb-plattform.de ab, entfernt das verbotene Flag „NeedAppearances=true“ und stellt die korrigierte Datei zum Download bereit.
// @author       Malte Kretzschmar
// @match        https://www.crm.vertrieb-plattform.de/betreuung/crm/*
// @require      https://unpkg.com/pdf-lib/dist/pdf-lib.min.js
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @connect      crm.vertrieb-plattform.de
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    console.log('PDF NeedAppearances Fixer v4 script is active.');

    // --- Helper function to trigger a browser download ---
    function triggerDownload(fileName, data) {
        const blob = new Blob([data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log(`Download triggered for fixed file: ${fileName}`);
    }

    /**
     * This function takes an ArrayBuffer of a PDF file, loads it using pdf-lib,
     * correctly finds and removes the 'NeedAppearances' flag, and returns the new file.
     * @param {ArrayBuffer} arrayBuffer The raw data of the PDF file.
     * @returns {Promise<Uint8Array|null>} The corrected PDF data or null on failure.
     */
    async function fixPdfNeedAppearances(arrayBuffer) {
        try {
            console.log('Loading PDF into pdf-lib...');
            const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);

            // *** THE CORRECT FIX IS HERE ***
            // Instead of using the high-level getForm(), we access the low-level
            // document catalog directly. This is the root dictionary of the PDF.
            const catalog = pdfDoc.catalog;
            const acroFormName = PDFLib.PDFName.of('AcroForm');

            // Check if the catalog has a reference to an AcroForm dictionary.
            if (catalog.has(acroFormName)) {
                // If it does, get the actual AcroForm dictionary object.
                // .lookup() is the correct way to retrieve a dictionary reference.
                const acroForm = catalog.lookup(acroFormName, PDFLib.PDFDict);

                // Now that we have the correct PDFDict object, we can check for the flag.
                const needAppearancesName = PDFLib.PDFName.of('NeedAppearances');
                if (acroForm && acroForm.has(needAppearancesName)) {
                    // .delete() is the correct method on a PDFDict.
                    acroForm.delete(needAppearancesName);
                    console.log('Successfully removed "NeedAppearances=true" flag.');
                } else {
                    console.log('PDF has a form, but no "NeedAppearances" flag. No changes made.');
                }
            } else {
                console.log('PDF does not contain an AcroForm dictionary. No changes needed.');
            }

            // Save the document. If no changes were made, this just re-serializes the original.
            const fixedPdfBytes = await pdfDoc.save();
            console.log('PDF has been processed and saved in memory.');
            return fixedPdfBytes;
        } catch (error) {
            console.error('Failed to process the PDF:', error);
            return null;
        }
    }

    // --- Interception Logic for window.open (Unchanged) ---
    const originalWindowOpen = unsafeWindow.open;

    unsafeWindow.open = function(url, target, features) {
        // A more robust check for PDF URLs that may not have the extension at the very end
        if (typeof url === 'string' && url.toLowerCase().includes('.pdf')) {
            console.log('Intercepted window.open for a PDF:', url);

            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                responseType: 'arraybuffer',
                onload: async function(response) {
                    if (response.status >= 200 && response.status < 300) {
                        console.log('Original PDF downloaded successfully.');
                        const originalBuffer = response.response;
                        const fixedBuffer = await fixPdfNeedAppearances(originalBuffer);

                        if (fixedBuffer) {
                            let fileName = "downloaded.pdf";
                            try {
                                const urlObj = new URL(url, window.location.origin);
                                const urlParams = urlObj.searchParams;
                                if (urlParams.has('fileName')) {
                                    fileName = urlParams.get('fileName');
                                } else {
                                    const path = urlObj.pathname;
                                    fileName = path.substring(path.lastIndexOf('/') + 1);
                                }
                            } catch (e) {
                                console.warn("Could not parse URL to get filename, using fallback.");
                                const tempName = url.split('?')[0];
                                fileName = tempName.substring(tempName.lastIndexOf('/') + 1);
                            }
                            triggerDownload(fileName, fixedBuffer);
                        } else {
                            console.error('PDF fixing failed. Aborting download.');
                        }
                    } else {
                        console.error('Failed to download the original PDF. Status:', response.status);
                        originalWindowOpen(url, target, features);
                    }
                },
                onerror: function(error) {
                    console.error('Network error while downloading the original PDF:', error);
                    originalWindowOpen(url, target, features);
                }
            });

            return null;
        }
        return originalWindowOpen.apply(this, arguments);
    };

})();