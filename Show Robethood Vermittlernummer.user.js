// ==UserScript==
// @name         Show Robethood Vermittlernummer
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Shows my VermittlerNr. to find my self in the table
// @author       Malte Kretzschmar
// @match        https://airtable.com/shrWmRPoWo8rxbNr9/tblFnyRF9XAD04Ejz
// @icon         https://airtable.com/images/favicon/baymax/android-chrome-192x192.png?v=2
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    document.querySelector("#topbar > div.col-6.flex-none.flex.items-center.justify-center > div > div.truncate.line-height-4.strong").innerText = "Vermittler Nummer: 572";
    // Your code here...
})();