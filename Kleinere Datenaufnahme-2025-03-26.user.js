// ==UserScript==
// @name         Kleinere Datenaufnahme
// @namespace    http://tampermonkey.net/
// @version      2025-03-26
// @updateURL    https://mopoliti.de/Userscripts/Kleinere%20Datenaufnahme-2025-03-26.user.js
// @description  Reduziert den Rand in der Smartkonzept Datenaufnahme
// @author       Malte Kretzschmar
// @icon         https://www.google.com/s2/favicons?sz=64&domain=vertrieb-plattform.de
// @match        https://startkonzept.bp.vertrieb-plattform.de/datenerfassung/*
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';
    GM_addStyle(`
        .cluster-field[data-v-8873119e] {
            padding: 5px !important;
        }
    `);

    // Your code here...
})();