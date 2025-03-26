// ==UserScript==
// @name         Kleinere Datenaufnahme
// @namespace    http://tampermonkey.net/
// @version      2025-03-26
// @description  try to take over the world!
// @author       You
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