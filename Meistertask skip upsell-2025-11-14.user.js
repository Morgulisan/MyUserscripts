// ==UserScript==
// @name         Meistertask skip upsell
// @namespace    http://tampermonkey.net/
// @version      2025-11-14
// @description  Meistertask leitet auf "Jetzt zahlen" beim ersten aufruf weiter, von dort leiten wir einfach weg aufs Dashboard
// @author       Malte Kretzschmar
// @match        https://www.meistertask.com/pages/de/version1
// @match        https://www.meistertask.com/de
// @icon         https://www.google.com/s2/favicons?sz=64&domain=meistertask.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    window.location.replace("https://www.meistertask.com/app/dashboard");
})();