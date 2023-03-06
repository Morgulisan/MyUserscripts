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

    let ladezeitInMs = 2000;
    let updateNachXSekunden = 6;

    let scores = {};

    window.addEventListener("load",function (e) {

    function inIframe () {
        try {
            return window.self !== window.top;
        } catch (e) {
            return true;
        }
    }

    setTimeout(async function (e) {


        if (inIframe()) {
            //alle ausklappen
            document.getElementById("_beraterhierarchieportlet_WAR_activityportlet_:hierarchie:table:j_idt55").click();
            await new Promise(r => setTimeout(r, 200));
            let timer = setTimeout(function () {
                document.getElementsByClassName("fa-refresh")[0].click();
            }, updateNachXSekunden * 1000);
            let message = {};
            message.command = "termine";
            message.value = document.querySelector("#termine-header").nextElementSibling.innerHTML;
            let new_scores = {};
            let berater = document.getElementsByClassName("sldo-ac-berater-name");
            for (let i = 0; i < berater.length; i++) {
                let b = berater[i].parentElement.parentElement.parentElement.parentElement.parentElement.parentElement;
                let name = b.getElementsByClassName("sldo-ac-berater-name")[0].innerText;
                let termine = b.getElementsByClassName("sldo-ac-png-Termine-icon")[0].innerText;
                scores[name] = {name: name, termine_neu: termine}
            }
            message.score = new_scores;
            message_broadcast(message);
        }

        const mainContentDiv = document.getElementById("main-content");

        // Create a new button element
        const button = document.createElement("button");
        button.textContent = "Terminier Dashboard";
        button.onclick = make_dashboard;
        mainContentDiv.appendChild(button);

        async function make_dashboard() {

            document.getElementById("_beraterhierarchieportlet_WAR_activityportlet_:hierarchie:table:j_idt55").click();
            await new Promise(r => setTimeout(r, 200));

            let berater = document.getElementsByClassName("sldo-ac-berater-name");
            for (let i = 0; i < berater.length; i++) {
                let b = berater[i].parentElement.parentElement.parentElement.parentElement.parentElement.parentElement;
                let name = b.getElementsByClassName("sldo-ac-berater-name")[0].innerText;
                let alt = b.getElementsByClassName("sldo-ac-png-Termine-icon")[0].innerText;
                scores[name] = {name: name, termine_alt: alt, termine_neu: alt}
            }

            document.getElementsByTagName("body")[0].innerHTML = '<style id="style"></style><h1>Gemeinsames Terminieren am ' + new Date().toLocaleDateString('de-DE') + '</h1><div id="content" style="display: flex;justify-content: space-evenly;"><div id="number"></div></div><div id="score"></div><div id="tec"></div>';
            document.getElementById("style").innerHTML = ' table {\n' +
                '            margin: 0 auto;\n' +
                '            width: 70%;\n' +
                '            border-collapse: collapse;\n' +
                '        }\n' +
                '        th, td {\n' +
                '            padding: 10px;\n' +
                '            text-align: left;\n' +
                '            vertical-align: top;\n' +
                '            border: 1px solid #009ee3;\n' +
                '        }\n' +
                '        th {\n' +
                '            background-color: #009ee3;\n' +
                '            color: #ffffff;\n' +
                '            font-weight: bold;\n' +
                '        }';
            $(window).on('storage', message_receive);
            let number = document.getElementById("number");
            let tec = document.getElementById("tec");
            number.style.fontSize = "50vh";
            number.style.color = "darkblue";
            number.style.lineHeight = " 1";
            tec.innerHTML = '<iframe src="https://vertrieb.tecis.de/group/tecis/betreuung/activity/,DanaInfo=.atfelwuuy1jvK49w7820yyTC1932Ib68+mein-team"></iframe>';
            tec.style.opacity = "1%";
            tec.style.height = "1px";
            tec.style.width = "1px";
        }

        // use local storage for messaging. Set message in local storage and clear it right away
        // This is a safe way how to communicate with other tabs while not leaving any traces
        function message_broadcast(message) {
            localStorage.setItem('message', JSON.stringify(message));
            localStorage.removeItem('message');
            console.log("sending Message");
        }


        // receive message
        function message_receive(ev) {
            if (ev.originalEvent.key != 'message') return; // ignore other keys
            let message = JSON.parse(ev.originalEvent.newValue);
            if (!message) return; // ignore empty msg or msg reset

            if (message.command == 'termine') {
                document.getElementById('number').innerText = message.value;
                Object.assign(scores, message.score);
                console.log("Terminstand: " + message.value);
                console.log("scores: " + JSON.stringify(scores));
                printHighscore();
            }
        }

        function printHighscore() {
            // Convert scores object to an array and sort it by descending order of termine_neu
            const scoreArray = Object.values(scores).sort((a, b) => b.termine_neu - a.termine_neu);
            // Generate a top five highscore table in HTML format
            let highscoreTableHTML = `
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>VP</th>
                    <th>Termine</th>
                  </tr>
                </thead>
                <tbody>
            `;
            for (let i = 0; i < 5; i++) {
                const score = scoreArray[i];
                highscoreTableHTML += `
                    <tr>
                      <td>${i + 1}</td>
                      <td>${score.name}</td>
                      <td>${score.termine_neu}</td>
                    </tr>
                  `;
            }
                        highscoreTableHTML += `
                </tbody>
              </table>
            `;
            // Display the top five highscore list in the #score div
            document.getElementById("score").innerHTML = highscoreTableHTML;
        }
    }, ladezeitInMs);
    });
})();