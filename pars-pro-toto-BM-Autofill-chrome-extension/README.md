# Pars Pro Toto BM Autofill Chrome Extension

## Varianten exportieren

Mit dem Node-Script `export-variants.mjs` kannst du aus derselben Codebasis zwei releasefertige Extension-Pakete erzeugen:

- **mit Affiliate**: enthält `content/affiliate-links.js`
- **ohne Affiliate / App-Store**: entfernt das Affiliate-Content-Script automatisch aus dem Export

### Aufruf

Direkt mit Node:

```bash
cd /workspace/MyUserscripts/pars-pro-toto-BM-Autofill-chrome-extension
node export-variants.mjs
```

Oder über npm, z. B. auch bequem in WebStorm. Unter Windows nutzt das Script intern PowerShell zum Erstellen der ZIP-Dateien, sodass kein separates `zip` installiert sein muss:

```bash
cd /workspace/MyUserscripts/pars-pro-toto-BM-Autofill-chrome-extension
npm run export:variants
```

### Ergebnis

Das Script erzeugt im Ordner `dist/` jeweils:

- einen entpackten Export-Ordner pro Variante
- eine ZIP-Datei pro Variante zum direkten Hochladen oder Archivieren

Dateinamen:

- `dist/pars-pro-toto-bm-autofill-with-affiliate.zip`
- `dist/pars-pro-toto-bm-autofill-without-affiliate.zip`

Für die Store-Variante wird der `affiliate-links.js`-Eintrag aus `manifest.json` entfernt, damit du Änderungen nicht doppelt pflegen musst.

## Shared source of truth (no manual duplicate edits)

Bearbeite nur noch diese Dateien:

- `src/core/*.core.js`
- `src/adapters/userscript/*.entry.js`
- `src/adapters/extension/*.entry.js`

Dann bauen:

```bash
npm run build:targets
```

Der Build aktualisiert automatisch **beide bisherigen Zielorte** (damit bestehende Workflows weiterlaufen):

- Userscript-Dateien im Repo-Root (`tecis BM Gespraechsnotiz Autofill.user.js`, `tecis Dokumente Datenbank.user.js`)
- Extension-Content-Scripts (`content/tecis-bm-gespraechsnotiz-autofill.js`, `content/tecis-dokumente-datenbank.js`)
- zusätzlich `dist/userscripts/*` und `dist/extension/content/*`

Diese Ziel-Dateien sind generiert und sollten nicht manuell editiert werden.
