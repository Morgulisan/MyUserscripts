// ==UserScript==
// @name         Affiliate Links
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Ersetzt den Verivox Link im Startkonzept durch deinen Affiliate Link
// @author       Malte Kretzschmar
// @match        https://startkonzept.bp.vertrieb-plattform.de/consultation/*/presentation
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- Konfiguration ---
    // Definieren Sie hier Ihre Regeln.
    // WICHTIG: Spezifischere Regeln (wie für /partner/) müssen VOR allgemeineren Regeln stehen.
    const linkReplacements = [
        {
            // Regel für Verivox (einfacher String-Vergleich, ersetzt den ganzen Link)
            search: 'https://www.verivox.de/strom-gas',
            replace: 'https://www.verivox.de/strom-gas'
        },
        {
            // SPEZIFISCHE REGEL: Wechselpilot /partner/
            // Sucht nach dem exakten Partner-Link (mit oder ohne / am Ende).
            // Das $1 im replace-String steht für den gesamten gefundenen Link.
            search: /^(https:\/\/www\.wechselpilot\.com\/partner\/?)$/,
            replace: '$1?refId=1404ff0e-5c1e-4776-9d60-1b3322a292e4'
        },
        {
            // ALLGEMEINE "WILDCARD" REGEL: Jeder andere Wechselpilot-Unterordner
            // Sucht nach https://www.wechselpilot.com/ gefolgt von einem beliebigen Unterordner.
            // Der Link darf noch keine Query-Parameter (?) haben um anderen affiliates nichts zu klauen.
            search: /^(https:\/\/www\.wechselpilot\.com\/[^/]+\/?)$/,
            replace: '$1?refId=tecis-aachen-malte-kretzschmar%2Bid1a33070c-8589-4c67-bda0-838c97ff82ac'
        }
        // Fügen Sie hier weitere Regeln hinzu
    ];

    // --- Kernfunktionalität ---
    const replaceLinks = () => {
        // Wir suchen nur nach Links, die noch nicht von uns markiert wurden.
        const allLinks = document.querySelectorAll('a:not([data-link-replaced])');

        allLinks.forEach(link => {
            for (const rule of linkReplacements) {
                let match = false;
                // Prüfen, ob die Regel ein regulärer Ausdruck ist
                if (rule.search instanceof RegExp) {
                    if (rule.search.test(link.href)) {
                        match = true;
                    }
                } else { // Ansonsten als einfacher String behandeln
                    if (link.href === rule.search) {
                        match = true;
                    }
                }

                if (match) {
                    const oldHref = link.href;
                    // Die .replace() Methode von Strings kann mit Regex und Backreferences ($1) umgehen
                    link.href = oldHref.replace(rule.search, rule.replace);

                    // Markieren, dass der Link von diesem Skript bearbeitet wurde.
                    link.dataset.linkReplaced = 'true';
                    console.log(`Link modifiziert: ${oldHref} -> ${link.href}`);

                    // Wichtig: Brechen Sie die Schleife ab, damit keine weiteren (allgemeineren) Regeln auf denselben Link angewendet werden.
                    break;
                }
            }
        });
    };

    // --- Ausführung ---
    // MutationObserver, um auf dynamisch geladene Inhalte zu reagieren.
    const observer = new MutationObserver((mutations, obs) => {
        // Optimierung: Prüfen, ob tatsächlich neue Elemente hinzugefügt wurden, bevor wir die Funktion aufrufen.
        if (mutations.some(mutation => mutation.addedNodes.length > 0)) {
            replaceLinks();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Führen Sie die Funktion einmal initial aus, falls die Links bereits beim Laden vorhanden sind.
    replaceLinks();

})();