// ==UserScript==
// @name         tecis CRM Copy Buttons
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  In der Personalien Ansicht werden alle einträge mit einem Koppier knopf versehen nachdem Strg oder WindowsTaste gedrückt wurden
// @author       Malte Kretzschmar
// @match        https://vertrieb.tecis.de/betreuung/crm/hauptnavigation/*+kundendetails
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tecis.de
// @grant        none
// ==/UserScript==
(function() {
    'use strict';

    document.addEventListener('keydown', function(event) {
        if (event.ctrlKey || event.metaKey) {
            var existingElements = document.getElementsByClassName('70749810-e903-11ed-a05b-0242ac120003');

            while(existingElements[0]) {
                existingElements[0].parentNode.removeChild(existingElements[0]);
            }

            var elements = document.getElementsByClassName("sldo-cl-c-form-control");

            for (var i = 0; i < elements.length; i++) {
                var div = elements[i].querySelector("div");
                var span = elements[i].querySelector("span");
                var link = elements[i].querySelector("a");
                var text;

                if (link) {
                    text = link.querySelector(".sldo-cl-c-link__content").textContent.trim();
                } else if (div) {
                    text = div.textContent.trim();
                }
                else if(span){
                    text = span.textContent.trim();
                }

                if (text) {
                    var button = document.createElement("button");
                    button.classList.add("70749810-e903-11ed-a05b-0242ac120003")
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
                    } else if (span) {
                        span.parentNode.insertBefore(button, span.nextSibling);
                    }
                }
            }
        }
    });
})();