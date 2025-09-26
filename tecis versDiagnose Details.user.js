// ==UserScript==
// @name         tecis versDiagnose Details
// @namespace    http://tampermonkey.net/
// @version      1
// @updateURL    https://mopoliti.de/Userscripts/tecis%20versDiagnose%20Details.user.js
// @description  try to take over the world!
// @author       Malte
// @match        https://tecis.versdiagnose.de/~riskassessment/assessment_results.do
// @icon         https://www.google.com/s2/favicons?sz=64&domain=versdiagnose.de
// @grant        none
// ==/UserScript==

(function() {
    'use strict';


// Parse the string into an HTML document
    var parser = new DOMParser();


    function replace() {
        let buttons = document.querySelector("#assessment-results-table-target > div:nth-child(2) > div > div").getElementsByTagName("button");
        if(buttons.length > 0){
            buttons[0].click();
            setTimeout(()=>{
                //copy Content
                let save = document.querySelector("#summary_section > div.row.hidden-print > div.col-xs-12.col-md-8").innerHTML;
                //close Modal
                document.querySelector("#vis > div.modal.js-modal-lg.in > div > div > div.modal-header > button").click();

                // Parse the string into an HTML document
                let doc = parser.parseFromString(save, 'text/html').body.firstChild;

                buttons[0].parentNode.replaceChild(doc , buttons[0]);
                setTimeout(replace,200);
            }, 800);
        }
    }

    replace();
})();