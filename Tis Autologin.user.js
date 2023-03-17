// ==UserScript==
// @name         Tecis Tis autologin
// @namespace    https://stay.app/
// @version      0.1
// @description  Beim ersten aufruf des tis wird automatisch auf die Startseite weitergeleitet
// @author       Malte
// @match        https://vertrieb.tecis.de:11059/pkmslogin.form
// @grant        none
// @run-at       document-start
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