#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename));
const REPO_ROOT = resolve(ROOT, '..');
const DIST_USERSCRIPTS = resolve(REPO_ROOT, 'dist/userscripts');
const DIST_EXTENSION = resolve(REPO_ROOT, 'dist/extension/content');
const LEGACY_USER_BM = resolve(REPO_ROOT, 'tecis BM Gespraechsnotiz Autofill.user.js');
const LEGACY_USER_DOK = resolve(REPO_ROOT, 'tecis Dokumente Datenbank.user.js');
const EXT_CONTENT_BM = resolve(ROOT, 'content/tecis-bm-gespraechsnotiz-autofill.js');
const EXT_CONTENT_DOK = resolve(ROOT, 'content/tecis-dokumente-datenbank.js');

mkdirSync(DIST_USERSCRIPTS, { recursive: true });
mkdirSync(DIST_EXTENSION, { recursive: true });

function read(path) {
  return readFileSync(path, 'utf8');
}

function extractUserscriptHeader(source) {
  const match = source.match(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\r?\n?/);
  return match ? match[0].trimEnd() + '\n\n' : '';
}

function stripUserscriptHeader(source) {
  return source.replace(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\r?\n?\r?\n?/, '');
}

function stripImports(source) {
  return source.replace(/^\s*import\s+.+?;\r?$/gm, '');
}

function stripExports(source) {
  return source.replace(/^export\s+/gm, '');
}

function buildBundleSource({ adapterPath, corePaths, includeHeader = false }) {
  const adapterSourceRaw = read(adapterPath);
  const header = includeHeader ? extractUserscriptHeader(adapterSourceRaw) : '';
  const adapterSource = stripImports(stripUserscriptHeader(adapterSourceRaw)).trim();
  const coreSource = corePaths.map((path) => stripExports(read(path)).trim()).join('\n\n');

  return `${header}(function () {\n'use strict';\n\n// GENERATED FILE - DO NOT EDIT DIRECTLY.\n// Source of truth lives under src/core and src/adapters.\n\n${coreSource}\n\n${adapterSource}\n})();\n`;
}

function writeOutputs(outputPaths, source) {
  for (const outputPath of outputPaths) {
    writeFileSync(outputPath, source, 'utf8');
  }
}

const bmCore = resolve(ROOT, 'src/core/tecis-bm-gespraechsnotiz-autofill.core.js');
const dokumenteCore = resolve(ROOT, 'src/core/tecis-dokumente-datenbank.core.js');

const bmUserscript = buildBundleSource({
  adapterPath: resolve(ROOT, 'src/adapters/userscript/tecis-bm-gespraechsnotiz-autofill.entry.js'),
  corePaths: [bmCore],
  includeHeader: true,
});
writeOutputs(
  [
    resolve(DIST_USERSCRIPTS, 'tecis-bm-gespraechsnotiz-autofill.user.js'),
    LEGACY_USER_BM,
  ],
  bmUserscript,
);

const dokuUserscript = buildBundleSource({
  adapterPath: resolve(ROOT, 'src/adapters/userscript/tecis-dokumente-datenbank.entry.js'),
  corePaths: [dokumenteCore],
  includeHeader: true,
});
writeOutputs(
  [
    resolve(DIST_USERSCRIPTS, 'tecis-dokumente-datenbank.user.js'),
    LEGACY_USER_DOK,
  ],
  dokuUserscript,
);

const bmExtension = buildBundleSource({
  adapterPath: resolve(ROOT, 'src/adapters/extension/tecis-bm-gespraechsnotiz-autofill.entry.js'),
  corePaths: [bmCore],
});
writeOutputs(
  [
    resolve(DIST_EXTENSION, 'tecis-bm-gespraechsnotiz-autofill.js'),
    EXT_CONTENT_BM,
  ],
  bmExtension,
);

const dokuExtension = buildBundleSource({
  adapterPath: resolve(ROOT, 'src/adapters/extension/tecis-dokumente-datenbank.entry.js'),
  corePaths: [dokumenteCore],
});
writeOutputs(
  [
    resolve(DIST_EXTENSION, 'tecis-dokumente-datenbank.js'),
    EXT_CONTENT_DOK,
  ],
  dokuExtension,
);

console.log('Built shared targets. Updated dist/ + legacy userscript + extension content outputs.');
