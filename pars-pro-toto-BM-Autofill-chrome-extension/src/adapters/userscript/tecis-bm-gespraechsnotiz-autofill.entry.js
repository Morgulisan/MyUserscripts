// ==UserScript==
// @name         tecis BM Gesprächsnotiz Autofill
// @namespace    http://tampermonkey.net/
// @version      2.1.0
// @description  Befüllt die Gesprächsnotiz wenn ?autofill=true gesetzt ist und fügt einen Autofill button in der BM hinzu
// @author       Malte Kretzschmar
// @match        https://bm.bp.vertrieb-plattform.de/bm/*
// @match        https://bm.bp.vertrieb-plattform.de/edocbox/editor/ui/?documentid=*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @connect      bm.bp.vertrieb-plattform.de
// @connect      startkonzept.bp.vertrieb-plattform.de
// @connect      mopoliti.de
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tecis.de
// ==/UserScript==

import { initGespraechsnotizAutofillEditor, initGespraechsnotizAutofillList } from '../../core/tecis-bm-gespraechsnotiz-autofill.core.js';

function fetchJson(url, { method = 'GET', headers = {}, body = null } = {}) {
  const gmRequest = (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest : GM_xmlhttpRequest;
  return new Promise((resolve, reject) => {
    gmRequest({
      method,
      url,
      headers,
      data: body,
      onload: (response) => {
        const status = typeof response.status === 'number' ? response.status : 200;
        let parsedResponse;
        try {
          parsedResponse = JSON.parse(response.responseText);
        } catch (error) {
          if (status >= 200 && status < 300) {
            reject(error);
            return;
          }
          parsedResponse = response.responseText;
        }

        if (status < 200 || status >= 300) {
          const err = new Error(`HTTP ${status} for ${url}`);
          err.status = status;
          err.data = parsedResponse;
          reject(err);
          return;
        }

        resolve(parsedResponse);
      },
      onerror: reject,
    });
  });
}

function installWindowOpenHook({ appendParams, consumeAutofillNextOpen }) {
  const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const originalOpen = pageWindow.open;
  Object.defineProperty(pageWindow, 'open', {
    configurable: true,
    writable: true,
    value(url, name, specs, replace) {
      if (typeof url === 'string') {
        url = appendParams(url, { forceAutofill: consumeAutofillNextOpen() });
      }
      return originalOpen.call(this, url, name, specs, replace);
    },
  });
}

function createDocumentJsonPromise() {
  let resolvePromise;
  const promise = new Promise((resolve) => {
    resolvePromise = resolve;
  });

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    if (typeof url === 'string' && url.includes('pAction=load')) {
      this.addEventListener('load', function () {
        try {
          const json = JSON.parse(this.responseText);
          if (json && (json.pages || json.formFields)) {
            resolvePromise(json);
          }
        } catch (error) {
          console.error('Autofill: Failed to parse intercepted JSON', error);
        }
      });
    }
    return originalOpen.apply(this, arguments);
  };

  return promise;
}

initGespraechsnotizAutofillList({ installWindowOpenHook });
initGespraechsnotizAutofillEditor({ fetchJson, createDocumentJsonPromise });
