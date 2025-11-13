// ==UserScript==
// @name         tecis tiS Autoselect TopList
// @namespace    http://tampermonkey.net/
// @version      0.4
// @updateURL    https://mopoliti.de/Userscripts/tecis%20Autoselect%20TopList.user.js
// @description  Add Buttons to autoselect the correct Top-List
// @author       Malte Kretzschmar
// @match        https://vertrieb.tecis.de:11059/gr/reporting/ur/home.do
// @match        https://reporting.slotbasis.crm.vertrieb-plattform.de/reporting/ur/home.do
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tecis.de
// @grant        none
// ==/UserScript==

(function () {
    'use strict';



    window.addEventListener("load",function (e) {

            let selectables = [
                {name: "UBR Voss", value: 1300},
                {name: "Team Schumacher", value: 611},
                {name: "tecis gesamt", value: 0},
            ];

            const targetUmsatz = document.querySelector("#reporting_main_content > table > tbody > tr > td:nth-child(4) > table > tbody > tr:nth-child(3) > td:nth-child(1) > table > tbody > tr:nth-child(6) > td:nth-child(2) > select");
            const targetVP = document.querySelector("#reporting_main_content > table > tbody > tr > td:nth-child(4) > table > tbody > tr:nth-child(3) > td:nth-child(1) > table > tbody > tr:nth-child(17) > td:nth-child(2) > select");
            const ButtonTargetHeader = document.querySelector("#reporting_main_content > table > tbody > tr > td:nth-child(4) > table > tbody > tr:nth-child(3) > td:nth-child(1) > table > tbody > tr:nth-child(2) > td");


            targetUmsatz.value = selectables[0].value;
            targetVP.value = selectables[0].value;


            for(let i = 0; i < selectables.length; i++){
                let btn = document.createElement("button");
                btn.innerHTML = selectables[i].name;
                btn.onclick = () => {
                   targetUmsatz.value = selectables[i].value;
                   targetVP.value = selectables[i].value;
                }
                ButtonTargetHeader.appendChild(btn);
            }

        });

})();