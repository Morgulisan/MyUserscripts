// ==UserScript==
// @name         PDF NeedAppearances Fixer for Vertrieb-Plattform (v5 - Safari Fix)
// @namespace    http://tampermonkey.net/
// @version      5.2
// @description  Fängt PDF-Downloads von crm.vertrieb-plattform.de ab, entfernt das verbotene Flag „NeedAppearances=true“ und stellt die korrigierte Datei zum Download bereit.
// @author       Malte Kretzschmar
// @match        https://www.crm.vertrieb-plattform.de/betreuung/crm/*
// @require      https://mopoliti.de/Userscripts/libraries/pdf-lib.js
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tecis.de
// @downloadURL  https://mopoliti.de/Userscripts/PDF%20Fixer%20Beratungsmappenf%C3%A4higes%20PDF.user.js
// @updateURL    https://mopoliti.de/Userscripts/PDF%20Fixer%20Beratungsmappenf%C3%A4higes%20PDF.user.js
// @homepageURL  https://mopoliti.de/Userscripts/
// @supportURL   https://mopoliti.de/Userscripts/
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @connect      crm.vertrieb-plattform.de
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    console.log('PDF NeedAppearances Fixer v5 (Safari Fix) script is active.');

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
            const catalog = pdfDoc.catalog;
            const acroFormName = PDFLib.PDFName.of('AcroForm');

            if (catalog.has(acroFormName)) {
                const acroForm = catalog.lookup(acroFormName, PDFLib.PDFDict);
                const needAppearancesName = PDFLib.PDFName.of('NeedAppearances');
                if (acroForm && acroForm.has(needAppearancesName)) {
                    acroForm.delete(needAppearancesName);
                    console.log('Successfully removed "NeedAppearances=true" flag.');
                } else {
                    console.log('PDF has a form, but no "NeedAppearances" flag. No changes made.');
                }
            } else {
                console.log('PDF does not contain an AcroForm dictionary. No changes needed.');
            }

            const fixedPdfBytes = await pdfDoc.save();
            console.log('PDF has been processed and saved in memory.');
            return fixedPdfBytes;
        } catch (error) {
            console.error('Failed to process the PDF:', error);
            return null;
        }
    }

    // --- Interception Logic for window.open ---
    const originalWindowOpen = unsafeWindow.open;

    unsafeWindow.open = function(url, target, features) {
        if (typeof url === 'string' && url.toLowerCase().includes('.pdf')) {
            console.log('Intercepted window.open for a PDF:', url);

            // *** THE SAFARI FIX IS HERE ***
            // Create a full, absolute URL object. This resolves relative paths
            // (e.g., "/activity/api/...") against the current page's origin.
            // This is crucial for Safari's stricter security model.
            const absoluteUrl = new URL(url, window.location.origin);
            console.log(`Resolved URL to absolute for request: ${absoluteUrl.href}`);

            GM_xmlhttpRequest({
                method: 'GET',
                url: absoluteUrl.href, // Always use the absolute URL for the request
                responseType: 'arraybuffer',
                onload: async function(response) {
                    if (response.status >= 200 && response.status < 300) {
                        console.log('Original PDF downloaded successfully.');
                        const originalBuffer = response.response;
                        const fixedBuffer = await fixPdfNeedAppearances(originalBuffer);

                        if (fixedBuffer) {
                            let fileName = "downloaded.pdf";
                            const urlParams = absoluteUrl.searchParams;
                            if (urlParams.has('fileName')) {
                                fileName = urlParams.get('fileName');
                            } else {
                                const path = absoluteUrl.pathname;
                                fileName = path.substring(path.lastIndexOf('/') + 1);
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