// ==UserScript==
// @name         Close Adblocker Ads
// @namespace    http://tampermonkey.net/
// @version      2024-07-26
// @description  closes the Adblocker ads - adblocker blocker
// @author       Malte Kretzschmar
// @match        https://adblockplus.org/de/update*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=adblockplus.org
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    window.close()
    // Your code here...
})();