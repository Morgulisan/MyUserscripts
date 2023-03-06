// ==UserScript==
// @name         Tecis Activity terminier Live Dashboard
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        https://vertrieb.tecis.de/group/tecis/betreuung/activity/,DanaInfo=.atfelwuuy1jvK49w7820yyTC1932Ib68+mein-team
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tecis.de
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
console.log("Running Dashboard Updater");

    let ladezeitInMs = 2500;
    let updateNachXSekunden = 6;

    window.addEventListener("load",function (e) {
    setTimeout(function(){
            window.location.reload(1);
        },updateNachXSekunden * 1000);
    setTimeout(function (e) {

        const mainContentDiv = document.getElementById("main-content");

        // Create a new button element
        const button = document.createElement("button");
        button.textContent = "Terminier Dashboard";
        button.onclick = make_dashboard;
        mainContentDiv.appendChild(button);

        function make_dashboard(){
            document.getElementsByTagName("body")[0].innerHTML = '<h1>Gemeinsames Terminieren am ' + new Date().toLocaleDateString('de-DE') + '</h1><div id="content" style="display: flex;justify-content: space-evenly;"><div id="number"></div></div>';
            $(window).on('storage', message_receive);
            document.getElementById("number").style.fontSize = "50vh";
            document.getElementById("number").style.color = "darkblue";
        }
        // use local storage for messaging. Set message in local storage and clear it right away
        // This is a safe way how to communicate with other tabs while not leaving any traces
        //
        function message_broadcast(message)
        {
            localStorage.setItem('message',JSON.stringify(message));
            localStorage.removeItem('message');
            console.log("sending Message");
        }


        // receive message
        //
        function message_receive(ev)
        {
            if (ev.originalEvent.key!='message') return; // ignore other keys
            var message=JSON.parse(ev.originalEvent.newValue);
            if (!message) return; // ignore empty msg or msg reset

            if (message.command == 'termine'){
              document.getElementById('number').innerText = message.value;
              console.log("Terminstand: " + message.value);
            }

            // etc.
        }
        let message = {};
        message.command = "termine";
        message.value = document.querySelector("#termine-header").nextElementSibling.innerHTML;
        message_broadcast(message);
    }, ladezeitInMs);
    });
    // Your code here...
})();