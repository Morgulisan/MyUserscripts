// ==UserScript==
// @name         tecis Dokumente Datenbank
// @namespace    http://tampermonkey.net/
// @version      2.1.2
// @description  Vorbefüllte PDFs und Anträge mit einem Click in die Beratungsmappe laden: HEK, hkk, Erhöhungen und Kampagnen
// @author       Malte Kretzschmar
// @match        https://bm.bp.vertrieb-plattform.de/bm/*
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @grant        GM_addStyle
// @connect      mopoliti.de
// @connect      www.crm.vertrieb-plattform.de
// @require      https://mopoliti.de/Userscripts/libraries/pdf-lib.js
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tecis.de
// ==/UserScript==

import { initDokumenteDatenbank } from '../../core/tecis-dokumente-datenbank.core.js';

function fetchJson(url, { method = 'GET', headers = {}, body = null } = {}) {
  const gmRequest = (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest : GM_xmlhttpRequest;
  return new Promise((resolve, reject) => {
    gmRequest({
      method,
      url,
      headers,
      data: body,
      onload: (response) => {
        try {
          resolve(JSON.parse(response.responseText));
        } catch (error) {
          reject(error);
        }
      },
      onerror: reject,
    });
  });
}

function addCss(cssText) {
  if (typeof GM_addStyle === 'function') {
    GM_addStyle(cssText);
    return;
  }
  const style = document.createElement('style');
  style.textContent = cssText;
  document.head.appendChild(style);
}

initDokumenteDatenbank({ fetchJson, addCss });
