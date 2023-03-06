// ==UserScript==
// @name         Autosave Steam-Game-key
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Clicks redeem on steam keys to auto-redeem a bunch.
// @author       You
// @match        https://store.steampowered.com/account/registerkey*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=steampowered.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function delay(time) {
        return new Promise(resolve => setTimeout(resolve, time));
    }


    delay(1000).then(() => document.querySelector("#accept_ssa").click());

    delay(2000).then(() => document.querySelector("#register_btn > span").click());

    // Your code here...
})();