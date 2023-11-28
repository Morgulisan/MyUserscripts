// ==UserScript==
// @name         tecis Highlight in TopList
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  Highlights my team in the TopList Ranking with a background color
// @author       Malte Kretzschmar
// @match        https://vertrieb.tecis.de:11059/gr/reporting/ur/topvp.do
// @match        https://vertrieb.tecis.de:11059/gr/reporting/top/topanmeldungen.do
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tecis.de
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    window.addEventListener("load",function (e) {
        let team = [
            {name: "775726 Malte Kretzschmar", color: "#ffc107"},

            {name: "774992 Fynn Kretzschmar", color: "#60b3fc"},
            {name: "769267 Eike Kretzschmar", color: "rgb(96 179 252 / 50%)"},
            {name: "766151 Henning Benfer", color: "rgb(96 179 252 / 40%)"},
            {name: "755336 Berkant Dalmizirak", color: "rgb(96 179 252 / 50%)"},

            {name: "773658 Adrian Stefan Habersetzer", color: "rgb(67 204 84)"},
            {name: "757786 Jennifer Lübke", color: "rgb(67 204 84 / 50%)"},
            {name: "763339 Stella Wolf", color: "rgb(67 204 84 / 50%)"},

            {name: "763189 Dewei Zheng", color: "rgb(156 118 222)"},
            {name: "753487 Jack Li", color: "rgb(156 118 222 / 50%)"},

            {name: "758298 Philipp Bronckhorst", color: "rgb(255 186 79)"},
            {name: "751463 Thilo Urban", color: "rgb(255 186 79)"},
            {name: "751063 Jakob Lecki", color: "rgb(255 186 79)"},
            {name: "749237 Paul Kubini", color: "rgb(255 186 79 / 50%)"},

        ]

        Array.from(document.getElementsByTagName("td")).filter(a => {
            let found = team.map(b => {
                if (a.innerText === b.name) {
                    console.log(a);
                    console.log(b);
                    a.style.backgroundColor = b.color;
                }
            });
        });


        //Swap on same value for fair Partner comparison
        let rows = document.querySelector("#row > tbody").getElementsByTagName("tr");
        for (let i = 0, j = 1; i < rows.length - 1; i += j) {
            j = 1;
            let currentValue = rows[i].getElementsByTagName("td")[3].innerText;
            while (i+j < rows.length && rows[i + j].getElementsByTagName("td")[3].innerText === currentValue){
                let row = rows[i + j];
                let sibling = rows[i+1].previousElementSibling;
                let parent = row.parentNode;
                parent.insertBefore(row, sibling);
                j++;
            }
        }
    });
})();