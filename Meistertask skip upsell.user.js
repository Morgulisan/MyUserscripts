// ==UserScript==
// @name         Meistertask skip upsell
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Meistertask leitet auf "Jetzt zahlen" beim ersten aufruf weiter, von dort leiten wir einfach weg aufs Dashboard
// @author       Malte Kretzschmar
// @run-at       document-start
// @match        https://www.meistertask.com/pages/de/version1
// @match        https://www.meistertask.com/de
// @match        https://accounts.meister.co/payments/mt/en/pricing
// @icon         https://www.google.com/s2/favicons?sz=64&domain=meistertask.com
// @updateURL    https://mopoliti.de/Userscripts/Meistertask%20skip%20upsell.user.js
// @downloadURL  https://mopoliti.de/Userscripts/Meistertask%20skip%20upsell.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    window.location.replace("https://www.meistertask.com/app/dashboard");
})();