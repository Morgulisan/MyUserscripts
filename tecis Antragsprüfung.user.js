// ==UserScript==
// @name         tecis Antragsprüfung
// @namespace    http://tampermonkey.net/
// @version      2024-03-13
// @description  Markiert alle Umsatzsteuerpflichtigen Umsätze als geprüft.
// @author       Malte Kretzschmar
// @match        https://vertrieb.tecis.de:11059/ka/kapruefung/antragpruefung.faces
// @match        https://vertrieb.tecis.de:11059/ka/kapruefung/start.faces
// @match        https://antragspruefung.slotbasis.crm.vertrieb-plattform.de/kapruefung/start.faces
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tecis.de
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let invest = ["CARMIGNAC GESTION","Universal Investment Gesellschaft mbH","Sarasin Wertpapierhandelsbank AG","Amundi Asset Management (PLC)","Sparinvest", "JPMorgan Asset Management", "DWS Investment GmbH", "BlackRock", "AllianceBernstein", "Vontobel", "Pictet", "Comgest", "Schroder Investment", "Gutmann Kapitalanlageaktiengesellschaft", "Robeco", "Flossbach von Storch Invest S.A", "FundRock Management Company S.A.", "iShares - BlackRock (Public Limited)", "ODDO BHF Asset Management GmbH","Nordea Fonds Service GmbH"]; // column 6
    let immo = ["DOMCURA AG","Domicil Objekt GmbH & Co. KG"]; // column 6
    let Tarif = ["Multidepot","FodB Depoteröffnung", "Depot", "Gesetzliche Krankenversicherung"]; // column 7

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function fill(){
        let a = document.getElementsByClassName("rich-table-row");

        for (let i = 0; i < a.length; i++) {
            let column6Text = a[i].getElementsByTagName("td")[6].innerText.trim();
            let column7Text = a[i].getElementsByTagName("td")[7].innerText.trim();

            if (invest.includes(column6Text) || immo.includes(column6Text) || Tarif.includes(column7Text)) {
                a[i].getElementsByTagName("td")[11].getElementsByTagName("input")[0].click();
                await delay(400);
                a = document.getElementsByClassName("rich-table-row");
                i--;
            }
        }
    }

    console.log("Running");
    const observer = new MutationObserver((mutations, obs) => {
        const targetSpan = document.querySelector('.ueberschrift_1');
        console.log("searching");
        if (targetSpan) {
            const fillButton = document.createElement('button');
            fillButton.innerText = 'Investment geprüft';
            fillButton.type = 'button';
            fillButton.id = 'fillButton';
            fillButton.addEventListener('click', function() {
                fill();
            });
            targetSpan.parentNode.insertBefore(fillButton, targetSpan.nextSibling);
            obs.disconnect(); // Stop observing once button is added
            console.log("disconnected");
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });



})();