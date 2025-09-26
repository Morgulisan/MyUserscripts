// ==UserScript==
// @name         Close Adblocker Ads
// @namespace    http://tampermonkey.net/
// @version      2
// @updateURL    https://mopoliti.de/Userscripts/Close%20Adblocker%20Ads.user.js
// @description  closes the Adblocker ads - adblocker blocker
// @author       Malte Kretzschmar
// @match        https://adblockplus.org/de/update*
// @match        https://adblockplus.org/en/update*
// @match        https://adblockplus.org/update?*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=adblockplus.org
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    window.close()
})();