# Agent Hinweise (tecis-chrome-extension)

## Überblick
- Dieses Verzeichnis enthält eine Chrome MV3-Extension, die drei bisherige Userscripts bündelt.
- Wichtige Dateien:
  - `manifest.json` (Content-Scripts + Host-Permissions)
  - `background.js` (Fetch-Proxy für Cross-Origin-Requests)
  - `content/tecis-dokumente-datenbank.js`
  - `content/tecis-bm-gespraechsnotiz-autofill.js`
  - `content/affiliate-links.js`
  - `lib/pdf-lib.js`

## Update-Workflow
1. **Userscripts aktualisieren**: Änderungen zuerst in den Original-Userscripts nachvollziehen.
2. **Extension-Portierung**:
   - Keine `GM_*` APIs verwenden. Stattdessen `extensionFetchJson(...)` (Content-Script) + `background.js` anpassen.
   - Content-Scripts laufen im isolierten Kontext. Wenn Page-JS gepatcht werden muss (z. B. XHR-Intercept), Script via DOM-Injection hinzufügen und `window.postMessage` nutzen.
3. **Manifest prüfen**:
   - Neue Domains benötigen Einträge in `host_permissions`.
   - Neue Seitenzuordnungen über `content_scripts.matches` ergänzen.
4. **Affiliate-Link-Updater**:
   - Muss auf allen Seiten aktiv sein (`<all_urls>`).
   - Ersetzt nur Links, die noch kein `data-link-replaced` Attribut haben.

## Beratungsmappe 2.0 (Migration, Stand 2026-06-17)
- **Drei Zielumgebungen**: Legacy-Liste `…/bm/*` (PrimeFaces/JSF, bis 2028), neues Frontend `…/bm-frontend/*` (Nuxt 3 / Vue SPA), Editor `https://editor.bm.bp.vertrieb-plattform.de/edocbox/editor/ui/*` (eigene Subdomain, gilt für BEIDE Frontends).
- **Editor-Subdomain**: `host_permissions` + Editor-`content_scripts.matches` decken `editor.bm…` ab (alte `bm…/edocbox`-Matches bleiben übergangsweise). `pAction=load` ist dort ein POST; XHR-Intercept ist method-agnostisch. Fallback-URL wird origin-relativ gebaut.
- **window.open** liefert in beiden Frontends nur `documentid`+`referrer`. `wibiid`+`autofill=true` werden vom MAIN-world `page-window-open-hook.js` angehängt. Im neuen Frontend gibt es kein `wibiid` in der URL → `initGespraechsnotizAutofillFrontend` löst es aus `mandantennr` via `GET /api/service/haushalt?mandantenNr=<b64>` (→ `haushaltId`-UUID, dann `btoa(...)`) auf und injiziert es per `postMessage {type:'set-wibiid'}`.
- **Neues Frontend**: utility-CSS, keine stabilen Klassen → Brain-Icon-Trigger wird an die Actions-Leiste neben `span.iconify.i-custom\:edit` gehängt (per MutationObserver, SPA-Routing).
- **Store BM 2.0**: `tecis-dokumente-datenbank` läuft auf `/bm-frontend/*` als getrenntes Popup. Es lädt PDF-Templates wie bisher, bereitet PDFs vor, wählt im neuen Wizard automatisch `art` → `kategorisierung` → optional `gespraechsnotiz_name`, klickt `Weiter` und setzt die PDF in `#assetsFieldHandle`. Der Nutzer prüft danach Pflichtfelder und klickt `Anlegen`. Network-Recon zeigte `POST /api/service/documents/validatepdf` und `POST /api/service/eigenervorgang/save` mit `FormData`; Direkt-Save per API bleibt bewusst offen, weil die JSON-Blob-Struktur nicht vollständig rekonstruiert ist und Save bei unvollständiger UI-Validierung 500 liefern kann.
- **Offen/Blockiert**: Editor-Feldelemente sind jetzt `eed-fieldcheckbox`/`eed-fieldradio`/`eed-fieldtext` (kein `mat-checkbox`) → echte DOM-Verifikation bleibt nötig. Store-Direktupload braucht die neue Create-Vorgang-/Upload-API. Frontend-Features sind vorerst extension-only (Userscripts matchen `/bm-frontend/` nicht).

## Technische Details
- **Cross-Origin Fetch**: Nur im Service Worker (Background) erlaubt, daher wird jede API-Anfrage per `chrome.runtime.sendMessage` an `background.js` delegiert.
- **PDF-Lib**: Lokal über `lib/pdf-lib.js` eingebunden, keine externe CDN-Abhängigkeit.
- **Autofill XHR-Intercept**: Im Editor via DOM-Injection, weil Content-Scripts die Page-Context-XHR nicht patchen können.


## Generierte Dateien (nicht manuell bearbeiten)
- Änderungen **nur** in `src/` vornehmen (`src/core/` und `src/adapters/`).
- Die folgenden Build-/Output-Dateien dürfen nicht direkt editiert werden:
  - `content/tecis-bm-gespraechsnotiz-autofill.js`
  - `content/tecis-dokumente-datenbank.js`
  - `../tecis BM Gespraechsnotiz Autofill.user.js`
  - `../tecis Dokumente Datenbank.user.js`
  - `../dist/extension/content/tecis-bm-gespraechsnotiz-autofill.js`
  - `../dist/extension/content/tecis-dokumente-datenbank.js`
  - `../dist/userscripts/tecis-bm-gespraechsnotiz-autofill.user.js`
  - `../dist/userscripts/tecis-dokumente-datenbank.user.js`
- Nach Änderungen in `src/` müssen die Output-Dateien über den Build-Prozess (`build-targets.mjs`) neu erzeugt werden.
- Diese Liste ist zu pflegen: Wenn neue generierte Dateien hinzukommen oder Pfade sich ändern, diese Anweisung sofort aktualisieren.

## Tests & Debugging
- In Chrome unter `chrome://extensions` im Entwicklermodus laden ("Entpackte Erweiterung" → Ordner `tecis-chrome-extension`).
- Service Worker Logs in der Extensions-Seite öffnen.
- Content-Script Logs in der jeweiligen Zielseite prüfen.
