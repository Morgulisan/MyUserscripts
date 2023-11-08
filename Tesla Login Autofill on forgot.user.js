// ==UserScript==
// @name         Tesla Login Autofill on forgot
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  Autofill email if provided as parameter
// @author       Malte Kretzschmar
// @match        https://auth.tesla.com/*/user/password/forgot*
// @icon         https://www.google.com/s2/favicons?domain=tesla.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Function to handle autofill.
    function autofillEmail() {

        const urlParams = new URLSearchParams(window.location.search);
        const emailInput = document.querySelector('#form-input-identity');
        // If the input field exists and the parameter is provided, fill it.
        if (emailInput && urlParams.get('form-input-identity')) {
            emailInput.value = urlParams.get('form-input-identity');
        }
    }

    // Wait until the window is loaded, then introduce a delay.
    window.addEventListener("load", function() {
        setTimeout(autofillEmail, 1000); // Delay of 1000ms (1 second).
        setTimeout(autofillEmail, 2000); // Delay of 2000ms (2 seconds).
    });

    // Retry autofill upon user click anywhere on the document.
    // Adjust the selector as needed if a more specific element is preferred.
    document.addEventListener('click', function(e) {
        autofillEmail();
    });

})();
