#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename));
const REPO_ROOT = resolve(ROOT, '..');
const DIST_USERSCRIPTS = resolve(REPO_ROOT, 'dist/userscripts');
const DIST_EXTENSION = resolve(REPO_ROOT, 'dist/extension/content');

mkdirSync(DIST_USERSCRIPTS, { recursive: true });
mkdirSync(DIST_EXTENSION, { recursive: true });

function read(path) {
  return readFileSync(path, 'utf8');
}

function extractUserscriptHeader(source) {
  const match = source.match(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\n?/);
  return match ? match[0].trimEnd() + '\n\n' : '';
}

function stripUserscriptHeader(source) {
  return source.replace(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\n?\n?/, '');
}

function stripImports(source) {
  return source.replace(/^import\s+.+?;\n/gm, '');
}

function stripExports(source) {
  return source.replace(/^export\s+/gm, '');
}

function bundle({ adapterPath, corePaths, outputPath, includeHeader = false }) {
  const adapterSourceRaw = read(adapterPath);
  const header = includeHeader ? extractUserscriptHeader(adapterSourceRaw) : '';
  const adapterSource = stripImports(stripUserscriptHeader(adapterSourceRaw)).trim();
  const coreSource = corePaths.map((path) => stripExports(read(path)).trim()).join('\n\n');

  const output = `${header}(function () {\n'use strict';\n\n${coreSource}\n\n${adapterSource}\n})();\n`;
  writeFileSync(outputPath, output, 'utf8');
}

const bmCore = resolve(ROOT, 'src/core/tecis-bm-gespraechsnotiz-autofill.core.js');
const dokumenteCore = resolve(ROOT, 'src/core/tecis-dokumente-datenbank.core.js');

bundle({
  adapterPath: resolve(ROOT, 'src/adapters/userscript/tecis-bm-gespraechsnotiz-autofill.entry.js'),
  corePaths: [bmCore],
  outputPath: resolve(DIST_USERSCRIPTS, 'tecis-bm-gespraechsnotiz-autofill.user.js'),
  includeHeader: true,
});

bundle({
  adapterPath: resolve(ROOT, 'src/adapters/userscript/tecis-dokumente-datenbank.entry.js'),
  corePaths: [dokumenteCore],
  outputPath: resolve(DIST_USERSCRIPTS, 'tecis-dokumente-datenbank.user.js'),
  includeHeader: true,
});

bundle({
  adapterPath: resolve(ROOT, 'src/adapters/extension/tecis-bm-gespraechsnotiz-autofill.entry.js'),
  corePaths: [bmCore],
  outputPath: resolve(DIST_EXTENSION, 'tecis-bm-gespraechsnotiz-autofill.js'),
});

bundle({
  adapterPath: resolve(ROOT, 'src/adapters/extension/tecis-dokumente-datenbank.entry.js'),
  corePaths: [dokumenteCore],
  outputPath: resolve(DIST_EXTENSION, 'tecis-dokumente-datenbank.js'),
});

console.log('Built shared targets into dist/userscripts and dist/extension/content.');
