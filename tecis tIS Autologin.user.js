// ==UserScript==
// @name         tecis tIS autologin
// @namespace    https://stay.app/
// @version      0.1
// @description  Beim ersten Aufruf des tIS wird automatisch auf die Startseite weitergeleitet
// @author       Malte Kretzschmar
// @match        https://vertrieb.tecis.de:11059/pkmslogin.form
// @grant        none
// @run-at       document-start
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tecis.de
// ==/UserScript==

(function() {

    window.location.replace("https://vertrieb.tecis.de:11059/gr/reporting/vc/index.html");

    /*
    alert("test");
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const referer = urlParams.get(referer);

    alert(referer);*/
})();