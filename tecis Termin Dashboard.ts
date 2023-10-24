const metadataBlock = `
// ==UserScript==
// @name         tecis TerminierDashboard
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        https://vertrieb.tecis.de/Terminieren
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tecis.de
// @grant        GM_xmlhttpRequest
// ==/UserScript==
`;

const loggedInUser = "775726";
const AllTimeHigh= 168;

class Dash {
    [key: string] : MitarbeiterRaw;
}
class MitarbeiterRaw {
    positionsBezeichnung: "T" | "BA" | "JB" | "SB" | "TL" | "RL" | "BM" | "RM" | "DM" | "GM" | "SC" | "SSC" | "SM" | "SSM" | "GSM";
    vorname: string;
    name: string;
    hvNr: number;
    direkterVorgesetzter: number;
    modus: "MA" | "FK";
    summeAllerTermine: number;
    summeAllerTermineOld?: number;
    summeTerminartenNachArt: Terminlage;
    summeTerminartenNachArtOld?: Terminlage;
    summeTermineTeam?: Terminlage;
    summeTermineTeamOld?: Terminlage;
}

class Terminlage {
    "1"?: number;
    "2"?: number;
    "3"?: number;
    "4"?: number;
    "5"?: number;

    sum(): number {
        let total = 0;
        for (let key in this) {
            if (this.hasOwnProperty(key) && typeof this[key] === 'number') {
                // @ts-ignore
                total += this[key]!;
            }
        }
        return total;
    }
}

enum TerminArt {
    S1 = 1,
    S2,
    Service,
    Recruiting,
    S3
}


(function () {
    'use strict';

    console.log(localStorage.getItem("message"));

    let Dashboard : Dash = {};
    let mvp = { t : 0, name: ""};

    async function fetchJSON(url: string): Promise<any> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return await response.json();
    }

    async function terminAbrufen(vpNr, setup = false) {
        try {
            const data: [MitarbeiterRaw] = await fetchJSON('https://vertrieb.tecis.de/api/hierarchie/,DanaInfo=.acsoBehzp3r39Kso78rvxTv.AEYGL-JKECAAhQDLFEWpIK,dom=1,CT=sxml+teamterminarten?hvNr=' + vpNr);
            for (let ma of data) {
                if (ma.modus === "MA") {
                    if (setup) {
                        Dashboard[ma.hvNr + "X"] = ma;
                        Dashboard[ma.hvNr + "X"].summeTerminartenNachArtOld = ma.summeTerminartenNachArt;
                        Dashboard[ma.hvNr + "X"].summeAllerTermineOld = ma.summeAllerTermine;
                    } else Dashboard[ma.hvNr + "X"].summeTerminartenNachArt = ma.summeTerminartenNachArt;
                    Dashboard[ma.hvNr + "X"].summeAllerTermine = ma.summeAllerTermine;
                    if(mvp.t < ma.summeAllerTermine){
                        mvp.t = ma.summeAllerTermine;
                        mvp.name = ma.vorname + " " + ma.name;
                    }
                } else if (ma.modus === "FK") {
                    if (!setup) {
                        Dashboard[ma.hvNr + "X"].summeTermineTeam = ma.summeTerminartenNachArt;
                    }
                    terminAbrufen(ma.hvNr, setup);
                }
            }
        } catch (error) {
            console.error('Failed to fetch JSON:', error);
        }

        localStorage.setItem('message', JSON.stringify(Dashboard));
    }

    function anzahlTermineBerechnen(): number {
        let total: number = 0;
        let totalByType: Terminlage = Object.assign(new Terminlage(), {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0});
        for (let ma in Dashboard) {
            total += Dashboard[ma].summeAllerTermine;
            if (Dashboard[ma].summeTerminartenNachArt.hasOwnProperty("1")) totalByType["1"] += Dashboard[ma].summeTerminartenNachArt["1"];
            if (Dashboard[ma].summeTerminartenNachArt.hasOwnProperty("2")) totalByType["2"] += Dashboard[ma].summeTerminartenNachArt["2"];
            if (Dashboard[ma].summeTerminartenNachArt.hasOwnProperty("3")) totalByType["3"] += Dashboard[ma].summeTerminartenNachArt["3"];
            if (Dashboard[ma].summeTerminartenNachArt.hasOwnProperty("4")) totalByType["4"] += Dashboard[ma].summeTerminartenNachArt["4"];
            if (Dashboard[ma].summeTerminartenNachArt.hasOwnProperty("5")) totalByType["5"] += Dashboard[ma].summeTerminartenNachArt["5"];
        }

        document.getElementById("Termine").innerText = total.toString();
        document.getElementById("S1").innerText = totalByType["1"].toString();
        document.getElementById("S2").innerText = totalByType["2"].toString();
        document.getElementById("S3").innerText = totalByType["5"].toString();
        document.getElementById("Service").innerText = totalByType["3"].toString();
        document.getElementById("Rec").innerText = totalByType["4"].toString();
        document.getElementById("ATH").innerText = Math.max(total, AllTimeHigh).toString();
        document.getElementById("MVPT").innerText = mvp.t.toString();
        document.getElementById("MVPN").innerText = mvp.name;

        const sortedArray : MitarbeiterRaw[] = Object.values(Dashboard).sort((a, b) => b.summeAllerTermine - a.summeAllerTermine);
        for (let i = 0; i < 10; i++) {
            let listElement = document.getElementById("list").getElementsByClassName("lelem")[i];
            listElement.innerHTML =`<div style="    font-family: Calibri, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    text-rendering: geometricPrecision;
    color: #1b6694 !important;
    width: 98%;
    --sldo-default-font: Calibri, Helvetica, Arial, sans-serif;
    align-items: center;
    display: flex !important;
    justify-content: space-between !important;
    text-align: center !important;
    font-size: 20Px;">
                <div style="
    width: 155px;
"><p>`+ sortedArray[i].vorname + " "+  sortedArray[i].name +`</p>
                </div>
                <div>` +
                (sortedArray[i].summeTerminartenNachArt["1"] ?  sortedArray[i].summeTerminartenNachArt["1"] : 0) + `
                </div>
                <div>
                `+(sortedArray[i].summeTerminartenNachArt["2"] ? sortedArray[i].summeTerminartenNachArt["2"] : 0) + `
                </div>
                <div>
                `+(sortedArray[i].summeTerminartenNachArt["5"]  ? sortedArray[i].summeTerminartenNachArt["5"] : 0) + `
                </div>
                <div>
                `+(sortedArray[i].summeTerminartenNachArt["3"] ? sortedArray[i].summeTerminartenNachArt["3"] : 0)+ `
                </div>
                <div>
                `+(sortedArray[i].summeTerminartenNachArt["4"] ? sortedArray[i].summeTerminartenNachArt["4"] : 0)+ `
                </div>
                <div style="
    width: 100px;
"><p>` + sortedArray[i].summeAllerTermine + `</p></div>
            </div>`
        }
        return total;
    }

    terminAbrufen(loggedInUser, true);

    setInterval(() => {
        terminAbrufen(loggedInUser)
    }, Math.max(Object.keys(Dashboard).length * 200, 10000));
    setInterval(() => {
        anzahlTermineBerechnen()
    }, 5000);

    document.body.innerHTML = `<style>
    * {
        font-family: Calibri, Helvetica, Arial, sans-serif;
        -webkit-font-smoothing: antialiased;
        text-rendering: geometricPrecision;
        color: #1b6694 !important;
    }

    table {
        margin: 0 auto;
        border-collapse: collapse;
    }

    th, td {
        padding: 10px;
        text-align: left;
        vertical-align: top;
        border: 1px solid #009ee3;
    }

    th {
        background-color: #009ee3;
        color: #ffffff;
        font-weight: bold;
    }

    .sldo-cl-u-flex {
        width: 90%;
        word-break: normal;
        tab-size: 4;
        --sldo-default-font: Calibri, Helvetica, Arial, sans-serif;
        --v-theme-surface-variant: 66, 66, 66;
        --v-theme-on-surface-variant: 238, 238, 238;
        font-weight: 400;
        line-height: 1.43;
        -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
        -webkit-text-size-adjust: 100%;
        color: #3d3d3d;
        font-family: Calibri, Helvetica, Arial, sans-serif;
        -webkit-font-smoothing: antialiased;
        text-rendering: geometricPrecision;
        padding: 0;
        margin: 0;
        box-sizing: border-box;
        align-items: flex-start !important;
        display: flex !important;
        justify-content: space-between !important;
        text-align: center !important;
        font-size: 3em;
    }

    .sldo-cl-c-colored-bubble {
        word-break: normal;
        tab-size: 4;
        --sldo-default-font: Calibri, Helvetica, Arial, sans-serif;
        --v-theme-surface-variant: 66, 66, 66;
        --v-theme-on-surface-variant: 238, 238, 238;
        font-weight: 400;
        -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
        -webkit-text-size-adjust: 100%;
        font-family: Calibri, Helvetica, Arial, sans-serif;
        -webkit-font-smoothing: antialiased;
        text-rendering: geometricPrecision;
        padding: 0;
        margin: 0;
        box-sizing: border-box;
        color: #fff !important;
        display: inline-block;
        width: 10vb;
        /* height: 1.125rem; */
        border-radius: 10vb;
        /* line-height: 1.125rem; */
        text-align: center;
    }

    .sldo-cl-u-text-tall {
        color: #1b6694 !important;
        font-weight: 700;
        font-family: Calibri, Helvetica, Arial, sans-serif;
        -webkit-font-smoothing: antialiased;
        text-rendering: geometricPrecision;
    }

    .sldo-cl-c-teaser-card__header{
        margin: 0 0 16px;
        align-items: center;
    }

    .sldo-cl-c-teaser-card__header h2{
        padding: 0;
        margin: 0;
        font-weight: 700;
        line-height: 1.43;
        font-size: 16px;
    }

    .smallColoredBubble{
        --sldo-default-font: Calibri, Helvetica, Arial, sans-serif;
        font-size: 20Px;
        font-family: Calibri, Helvetica, Arial, sans-serif;
        -webkit-font-smoothing: antialiased;
        text-rendering: geometricPrecision;
        color: #fff !important;
        width: 35px;
        border-radius: 10vb;
        text-align: center;
        background-color: rgb(0, 67, 110);
    }

    .common-styles {
        -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
        -webkit-text-size-adjust: 100%;
        color: #3d3d3d;
        font-family: Calibri, Helvetica, Arial, sans-serif;
        font-weight: 400;
        line-height: 1.43;
        font-size: 14px;
        margin: 0;
        padding: 0;
        box-sizing: border-box;
        -webkit-font-smoothing: antialiased;
        text-rendering: geometricPrecision;

    }

    #main>div {
        background: white;
        padding: 10px;
        box-sizing: border-box;
    }

    #list>div{
        width: 100%;
        height: 50px;
        margin: 5px;
    }
</style>
<header class="sldo-cl-c-page-heading common-styles" style="
    box-shadow: 0 0 8px 0 rgba(0,0,0,.25);
    position: sticky;
    z-index: 200;
    top: 0;
    background-color: #fff;
">
    <div class="sldo-cl-c-page-heading__inner common-styles" style="
    display: flex;
    flex-direction: row;
    align-items: center;
    height: 56px;
    padding-right: 16px;
">
        <div class="sldo-cl-c-page-heading__main common-styles" style="
    flex: 0 1 100%;
    margin-left: 24px;
">
            <div class="sldo-cl-c-page-heading__headline common-styles" style="
    font-weight: 700;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    margin-top: .25rem;
    overflow: hidden;
    line-height: 1.25em;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 16px;
    -webkit-line-clamp: 1;
">Gemeinsames Terminieren am <span id="date">?</span></div>
        </div>
    </div>
</header>
<div id="main" style="
    width: 100%;
    height: calc(100% - 60px);
    display: grid;
    grid-template-rows: calc(28% - 10px) repeat(2, calc(36% - 10px));
    grid-template-columns: 50% repeat(2, calc(25% - 10px));
    row-gap: 10px;
    column-gap: 10px;
    gap: 15px 10px;
    padding: 10px;
    background: #f4f4f4;
    box-sizing: border-box;
">
    <div style="grid-column: span 1; grid-row: span 3">
        <div class="sldo-cl-c-teaser-card__header"><h2>Terminstand</h2></div>
        <div style="color: darkblue;
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    align-items: center;
    flex-wrap: nowrap;height: 80%">

            <h3 id="Termine" style="
    font-size: 20em;
    line-height: 80%;
    margin: 0;
">?</h3>
            <div class="sldo-cl-u-flex">
                <div>
                    <div class="sldo-cl-c-colored-bubble sldo-cl-u-text-white" style="
    background-color: rgb(0, 67, 110);
    color: rgb(61, 61, 61);
    "> S1
                    </div>
                    <div class="sldo-cl-u-text-tall sldo-cl-u-text-active" id="S1"> ?</div>
                </div>
                <div>
                    <div class="sldo-cl-c-colored-bubble"
                         style="background-color: rgba(0, 67, 110, 0.6); color: rgb(61, 61, 61);"> S2
                    </div>
                    <div class="sldo-cl-u-text-tall sldo-cl-u-text-active" id="S2"> ?</div>
                </div>
                <div>
                    <div class="sldo-cl-c-colored-bubble"
                         style="background-color: rgba(0, 67, 110, 0.2); color: rgb(61, 61, 61);"> S3
                    </div>
                    <div class="sldo-cl-u-text-tall sldo-cl-u-text-active" id="S3"> ?</div>
                </div>
                <div>
                    <div class="sldo-cl-c-colored-bubble"
                         style="background-color: rgb(236, 112, 0); color: rgb(61, 61, 61);"> SV
                    </div>
                    <div class="sldo-cl-u-text-tall sldo-cl-u-text-active" id="Service"> ?</div>
                </div>
                <div>
                    <div class="sldo-cl-c-colored-bubble"
                         style="background-color: rgb(255, 207, 0); color: rgb(61, 61, 61);"> RC
                    </div>
                    <div class="sldo-cl-u-text-tall sldo-cl-u-text-active" id="Rec"> ?</div>
                </div>
            </div>

        </div>
    </div>
    <div>
        <div class="sldo-cl-c-teaser-card__header"><h2>All-Time-High</h2></div>
        <h1 style="    font-size: 6em;
    text-align: center;
    margin: 0;" id="ATH">?</h1>
    </div>
    <div>
        <div class="sldo-cl-c-teaser-card__header"><h2>MVP</h2></div>
        <div style="
    font-size: 2.5em;
    text-align: center;
    margin: 0;
    line-height: 1em;
    font-weight: 700;
">
            <div id="MVPT">?</div>
            <span id="MVPN">.... ........</span>


        </div>
    </div>
    <div style="grid-column: span 2; grid-row: span 2; overflow: hidden" >
        <div class="sldo-cl-c-teaser-card__header" style="margin: 0;"><h2>Terminlagen</h2></div>
        <div id="list" style="overflow: hidden">
            <div>
            <div style="    font-family: Calibri, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    text-rendering: geometricPrecision;
    color: #1b6694 !important;
    width: 98%;
    --sldo-default-font: Calibri, Helvetica, Arial, sans-serif;
    align-items: center;
    display: flex !important;
    justify-content: space-between !important;
    text-align: center !important;
    font-size: 20Px;">
                <div  style="
    width: 155px;
"><p>Termine</p>
                </div>
                <div>
                    <div class="smallColoredBubble" style="
    background-color: rgb(0, 67, 110);
    color: rgb(61, 61, 61);
    "> S1
                    </div>

                </div>
                <div>
                    <div class="smallColoredBubble" style="background-color: rgba(0, 67, 110, 0.6); color: rgb(61, 61, 61);"> S2
                    </div>

                </div>
                <div>
                    <div class="smallColoredBubble" style="background-color: rgba(0, 67, 110, 0.2); color: rgb(61, 61, 61);"> S3
                    </div>

                </div>
                <div>
                    <div class="smallColoredBubble" style="background-color: rgb(236, 112, 0); color: rgb(61, 61, 61);"> SV
                    </div>

                </div>
                <div>
                    <div class="smallColoredBubble" style="background-color: rgb(255, 207, 0); color: rgb(61, 61, 61);"> RC
                    </div>

                </div>
                <div style="
    width: 100px;
"><p>&sum;</p></div>
            </div>
            </div>
                <div class="lelem"></div>
                <div class="lelem"></div>
                <div class="lelem"></div>
                <div class="lelem"></div>
                <div class="lelem"></div>
                <div class="lelem"></div>
                <div class="lelem"></div>
                <div class="lelem"></div>
                <div class="lelem"></div>
                <div class="lelem"></div>
        </div>
    </div>
</div>


`;

    const requestWakeLock = async () => {
        try {
            // @ts-ignore
            const wakeLock = await navigator.wakeLock.request("screen");
        } catch (err) {
            // The wake lock request fails - usually system-related, such as low battery.

            console.log(`${err.name}, ${err.message}`);
        }
    };

    requestWakeLock();

    document.getElementById("date").innerText = new Date().toLocaleDateString('de-DE');

    fetch("https://vertrieb.tecis.de/,DanaInfo=.acsoBehzp3r39Kso78rvxTv.AEYGL-JKECAAhQDLFEWpIK+api/teamterminarten?betreuerNr=775726").then(a => {
        console.log(a.json())
    });
    fetch('https://vertrieb.tecis.de/,DanaInfo=.acsoBehzp3r39Kso78rvxTv.AEYGL-JKECAAhQDLFEWpIK+api/teamterminarten?betreuerNr=775726')
        .then(response => response.text())
        .then(text => console.log(text))

})();