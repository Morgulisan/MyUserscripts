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

## Technische Details
- **Cross-Origin Fetch**: Nur im Service Worker (Background) erlaubt, daher wird jede API-Anfrage per `chrome.runtime.sendMessage` an `background.js` delegiert.
- **PDF-Lib**: Lokal über `lib/pdf-lib.js` eingebunden, keine externe CDN-Abhängigkeit.
- **Autofill XHR-Intercept**: Im Editor via DOM-Injection, weil Content-Scripts die Page-Context-XHR nicht patchen können.

## Tests & Debugging
- In Chrome unter `chrome://extensions` im Entwicklermodus laden ("Entpackte Erweiterung" → Ordner `tecis-chrome-extension`).
- Service Worker Logs in der Extensions-Seite öffnen.
- Content-Script Logs in der jeweiligen Zielseite prüfen.
