// ==UserScript==
// @name         tecis Log Depotbestand
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Depotbestand Logging
// @author       Malte
// @match        https://tecis.bp.fundsaccess.eu/fpt/tecis/newsBpMysql.do?method=view*
// @match        https://tecis.bp.fundsaccess.eu/*/login?*
// @match        https://tecis.bp.fundsaccess.eu/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tecis.de
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const currentURL = window.location.href;

    // Helper function to see if a stored object is recent (<= 10 seconds old)
    function isRecent(storedObj) {
        if (!storedObj || !storedObj.timestamp) return false;
        return (Date.now() - storedObj.timestamp) <= 15 * 1000; // 10 seconds
    }

    /**
     * Scenario 1: We are on the page that has the Depotwert
     * URL: https://tecis.bp.fundsaccess.eu/fpt/tecis/newsBpMysql.do?method=view
     */
    if (currentURL.includes("https://tecis.bp.fundsaccess.eu/fpt/tecis/newsBpMysql.do?method=view")) {
        // Poll for the presence of required elements
        function waitForElements(selectors, callback) {
            const missing = selectors.filter(sel => !document.querySelector(sel));
            if (missing.length === 0) {
                callback();
            } else {
                setTimeout(() => waitForElements(selectors, callback), 500);
            }
        }

        // We need the Depotwert cell
        const selectorsNeeded = [
            "#ReportTable > table:nth-child(1) > tbody > tr:nth-child(2) > td:nth-child(2)" // Depotwert
        ];

        function mainLogic() {
            // 4. Select the Depotwert cell
            const rawDepotText = document.querySelector("#ReportTable > table:nth-child(1) > tbody > tr:nth-child(2) > td:nth-child(2)")?.innerText.trim() || "";

            // 5. Remove any non-numeric characters except digits, comma, and period
            let numericText = rawDepotText.replace(/[^0-9,\.]/g, "");

            // 6. Convert from EU format (1.234.567,89) to a standard JS parseable format (1234567.89)
            numericText = numericText.replace(/\./g, "").replace(",", ".");

            // 7. Convert to a Number
            const amount = parseFloat(numericText) || 0;

            // TODO: Save to GM
            GM_setValue("depotwert", {
                value: amount,
                timestamp: Date.now()
            });
        }

        waitForElements(selectorsNeeded, mainLogic);
    }

    /**
     * Scenario 2: We are on the page that shows the user ID:
     * URL: https://tecis.bp.fundsaccess.eu/#/fpt
     */
    else if (currentURL.includes("https://tecis.bp.fundsaccess.eu/#/fpt") || currentURL.includes("https://tecis.bp.fundsaccess.eu/#/login")) {
        const userElem = document.querySelector("body > app > header > div.login-info.visible-mdGt > span > a");
        const rawUserText = userElem?.innerText.trim() || "";
        // "Benutzer: 775726" => "775726"
        const userId = rawUserText.replace("Benutzer:", "").trim();
        if(userId.length >= 5 && userId.length <= 7){

            // TODO: Save to GM
            GM_setValue("userId", {
                value: userId,
                timestamp: Date.now()
            });

        }
    }

    /**
     * After loading either scenario, check if we have both 'userId' and 'depotwert'
     * in storage from within the last 10 seconds. If yes, call the API.
     *
     * Since scripts can run on multiple page loads, we do this check every time
     * the script is evaluated.
     */
    (function checkAndCallAPI() {
        const storedUser = GM_getValue("userId", null);
        const storedDepot = GM_getValue("depotwert", null);

        if (isRecent(storedUser) && isRecent(storedDepot)) {
            const { value: userId } = storedUser;
            const { value: amount } = storedDepot;

            const apiUrl = `https://mopoliti.de/tecis/Depotbestand.php?Benutzer=${userId}&Depotwert=${amount}`;
            console.log("Calling API:", apiUrl);

            // 9. Perform the fetch call
            fetch(apiUrl)
                .then(response => response.text())
                .then(data => {
                    console.log("Response data:", data);
                    // Handle the response as needed
                })
                .catch(error => {
                    console.error("Fetch error:", error);
                });
        }
    })();

})();
