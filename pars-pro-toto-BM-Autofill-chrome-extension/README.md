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

Oder über npm, z. B. auch bequem in WebStorm:

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
