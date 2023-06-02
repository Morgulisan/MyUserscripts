// ==UserScript==
// @name         Add Copy Buttons to CRM
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  In der Personalien Ansicht werden alle einträge mit einem Copy-knopf versehen, nachdem Strg oder WindowsTaste gedrückt wurden
// @author       Malte Kretzschmar
// @match        https://vertrieb.tecis.de/betreuung/crm/hauptnavigation/*+kundendetails
// @grant        none
// ==/UserScript==
(function() {
    'use strict';

    document.addEventListener('keydown', function(event) {
        if (event.ctrlKey || event.metaKey) {
            let elements = document.getElementsByClassName("sldo-cl-c-form-control");

            for (let i = 0; i < elements.length; i++) {
                let div = elements[i].querySelector("div");
                let link = elements[i].querySelector("a");
                let text;

                if (link) {
                    text = link.querySelector(".sldo-cl-c-link__content").textContent.trim();
                } else if (div) {
                    text = div.textContent.trim();
                }

                if (text) {
                    let button = document.createElement("button");
                    button.innerHTML = "&#128203;";
                    button.style.float = "left";
                    button.onclick = (function(t) {
                        return function() {
                            navigator.clipboard.writeText(t);
                        };
                    })(text);

                    if (link) {
                        link.parentNode.insertBefore(button, link.nextSibling);
                    } else if (div) {
                        div.parentNode.insertBefore(button, div.nextSibling);
                    }
                }
            }
        }
    });
})();