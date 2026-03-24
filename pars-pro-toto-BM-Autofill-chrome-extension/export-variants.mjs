#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(__filename, '..');
const DIST_DIR = join(ROOT, 'dist');
const BASE_EXPORT_NAME = 'pars-pro-toto-bm-autofill';
const AFFILIATE_SCRIPT = 'content/affiliate-links.js';
const CURRENT_SCRIPT_NAME = 'export-variants.mjs';

const VARIANTS = [
  {
    key: 'with-affiliate',
    includeAffiliate: true,
    manifestName: 'Beratungsmappen Autofill Pars Pro Toto (Affiliate)',
    descriptionSuffix: 'Enthält den Affiliate-Link-Updater.',
  },
  {
    key: 'without-affiliate',
    includeAffiliate: false,
    manifestName: 'Beratungsmappen Autofill Pars Pro Toto',
    descriptionSuffix: 'Ohne Affiliate-Link-Updater für den Store-Upload.',
  },
];

const EXCLUDE_NAMES = new Set(['dist', 'node_modules', '__pycache__', CURRENT_SCRIPT_NAME]);
const EXCLUDE_SUFFIXES = new Set(['.pyc']);

function loadManifest() {
  return JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
}

function writeManifest(targetDir, manifest) {
  writeFileSync(join(targetDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function shouldSkip(entryName) {
  if (EXCLUDE_NAMES.has(entryName)) {
    return true;
  }

  for (const suffix of EXCLUDE_SUFFIXES) {
    if (entryName.endsWith(suffix)) {
      return true;
    }
  }

  return false;
}

function copyExtensionFiles(targetDir) {
  for (const entryName of readdirSync(ROOT)) {
    if (shouldSkip(entryName)) {
      continue;
    }

    const sourcePath = join(ROOT, entryName);
    const destinationPath = join(targetDir, entryName);
    const stats = statSync(sourcePath);

    if (stats.isDirectory()) {
      cpSync(sourcePath, destinationPath, { recursive: true });
    } else {
      cpSync(sourcePath, destinationPath);
    }
  }
}

function createZipArchive(sourceDir, zipPath) {
  if (process.platform === 'win32') {
    const escapedZipPath = zipPath.replace(/'/g, "''");
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Get-ChildItem -Force | Compress-Archive -DestinationPath '${escapedZipPath}' -Force`,
      ],
      { cwd: sourceDir, stdio: 'inherit' },
    );
    return;
  }

  execFileSync('zip', ['-qr', zipPath, '.'], { cwd: sourceDir, stdio: 'inherit' });
}

function buildVariant(baseManifest, variant) {
  const exportName = `${BASE_EXPORT_NAME}-${variant.key}`;
  const variantDir = join(DIST_DIR, exportName);
  const zipPath = join(DIST_DIR, `${exportName}.zip`);

  rmSync(variantDir, { recursive: true, force: true });
  rmSync(zipPath, { force: true });

  mkdirSync(variantDir, { recursive: true });
  copyExtensionFiles(variantDir);

  const manifest = structuredClone(baseManifest);
  manifest.name = variant.manifestName;
  manifest.description = `${baseManifest.description} ${variant.descriptionSuffix}`;

  if (!variant.includeAffiliate) {
    manifest.content_scripts = manifest.content_scripts.filter(
      (script) => !script.js?.includes(AFFILIATE_SCRIPT),
    );
    manifest.optional_host_permissions = (manifest.optional_host_permissions ?? []).filter(
      (permission) => permission !== '<all_urls>',
    );
    if (manifest.optional_host_permissions.length === 0) {
      delete manifest.optional_host_permissions;
    }
    rmSync(join(variantDir, AFFILIATE_SCRIPT), { force: true });
  }

  writeManifest(variantDir, manifest);
  createZipArchive(variantDir, zipPath);

  return { variantDir, zipPath };
}

function main() {
  if (existsSync(DIST_DIR)) {
    rmSync(DIST_DIR, { recursive: true, force: true });
  }
  mkdirSync(DIST_DIR, { recursive: true });

  const manifest = loadManifest();
  const outputs = VARIANTS.map((variant) => ({ variant, ...buildVariant(manifest, variant) }));

  console.log('Export abgeschlossen:');
  for (const { variant, variantDir, zipPath } of outputs) {
    const affiliateState = variant.includeAffiliate ? 'mit Affiliate' : 'ohne Affiliate';
    console.log(`- ${variant.key} (${affiliateState})`);
    console.log(`  Ordner: ${variantDir}`);
    console.log(`  ZIP:    ${zipPath}`);
  }
}

main();
