// ==UserScript==
// @name         tecis Multi Cockpit Download
// @namespace    http://tampermonkey.net/
// @version      2024-01-03
// @updateURL    https://mopoliti.de/Userscripts/tecis%20Multi%20Cockpit%20Download.user.js
// @description  Download multiple Cockpits
// @author       Malte Kretzschmar
// @match        https://vertrieb.tecis.de:11059/gr/reporting/zeigeBeurteilungsbogenForm.do
// @match        https://www.tecis.de/gr/reporting/zeigeBeurteilungsbogenForm.do
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tecis.de
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

/**
document.querySelector("#reporting_main_content > table > tbody > tr > td:nth-child(4) > table > tbody > tr:nth-child(3) > td:nth-child(1) > form").target = "transFrame";

// Create the iframe element
var iframe = document.createElement('iframe');
iframe.style.display = 'none';
iframe.name = 'transFrame';
iframe.id = 'transFrame';

// Get the reference element where you want to insert the iframe as a sibling
var refElement = document.querySelector("#reporting_main_content > table > tbody > tr > td:nth-child(4) > table > tbody > tr:nth-child(3) > td:nth-child(1) > form");

// Insert the iframe as a sibling to the reference element
refElement.parentNode.insertBefore(iframe, refElement.nextSibling);
**/

let loc = document.querySelector("#reporting_main_content > table > tbody > tr > td:nth-child(4) > table > tbody > tr:nth-child(3) > td:nth-child(1) > div");
let area = document.createElement("textarea");
area.id = "listVPNRFranz";
area.style.height = "200px";
loc.appendChild(area);
let btn = document.createElement("button");
btn.innerHTML = "Start";
btn.onclick = () => {
    console.log(document.getElementById("listVPNRFranz").value);
    let list = document.getElementById("listVPNRFranz").value.split('\n');
    go(list);
    btn.disabled = true;
}
loc.appendChild(btn);

function go(list) {
    if(list.length > 0) {
        document.querySelector("#reporting_main_content > table > tbody > tr > td:nth-child(4) > table > tbody > tr:nth-child(3) > td:nth-child(1) > form > table > tbody > tr:nth-child(3) > td > input[type=text]").value = list.pop();
        document.querySelector("#reporting_main_content > table > tbody > tr > td:nth-child(4) > table > tbody > tr:nth-child(3) > td:nth-child(1) > form > table > tbody > tr:nth-child(4) > td > input[type=submit]").click();
        try {
            document.querySelector("#ajaxBusy").remove();
        } catch (e) {}
        setTimeout(go, 1500, list);
    }
    else {
        btn.disabled = false;
    }
}

})();