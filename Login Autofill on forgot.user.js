// ==UserScript==
// @name         Login Autofill on forgot
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Autofill email if provided as parameter
// @author       Malte Kretzschmar
// @match        https://auth.tesla.com/user/password/forgot*
// @icon         https://www.google.com/s2/favicons?domain=tesla.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    window.addEventListener("load",function (e) {
    const urlParams = new URLSearchParams(window.location.search);
    document.querySelector('#form-input-identity').value = urlParams.get('form-input-identity');});
    // Your code here...
})();