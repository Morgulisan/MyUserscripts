// ==UserScript==
// @name         tecis Async Login
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Verhindert weiterleitungen auf komische Seiten nach dem login auf vertrieb.tecis.de
// @author       Malte Kretzschmar
// @match        https://vertrieb.tecis.de/dana-na/auth/url_46/welcome.cgi
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tecis.de
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    document.addEventListener('submit', (e) => {
    // Store reference to form to make later code easier to read
    const form = e.target;

    // Post data using the Fetch API
    fetch(form.action, {
        method: form.method,
        body: new FormData(form),
    }).then(function(){window.location.replace("https://vertrieb.tecis.de/");});

    // Prevent the default form submit
    e.preventDefault();
});

})();