import { initDokumenteDatenbank } from '../../core/tecis-dokumente-datenbank.core.js';

function fetchJson(url, { method = 'GET', headers = {}, body = null, withCredentials = true } = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: 'fetchJson',
        url,
        options: {
          method,
          headers,
          body,
          credentials: withCredentials ? 'include' : 'omit',
        },
      },
      (response) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!response) return reject(new Error('No response from background'));
        if (response.error) return reject(new Error(response.error));
        if (!response.ok) {
          const err = new Error(`HTTP ${response.status} for ${url}`);
          err.status = response.status;
          err.data = response.data;
          return reject(err);
        }
        resolve(response.data);
      },
    );
  });
}

function addCss(cssText) {
  const style = document.createElement('style');
  style.textContent = cssText;
  document.head.appendChild(style);
}

initDokumenteDatenbank({ fetchJson, addCss });
