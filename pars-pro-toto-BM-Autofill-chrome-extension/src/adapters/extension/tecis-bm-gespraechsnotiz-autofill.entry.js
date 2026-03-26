import { initGespraechsnotizAutofillEditor, initGespraechsnotizAutofillList } from '../../core/tecis-bm-gespraechsnotiz-autofill.core.js';

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

function installWindowOpenHook() {
  // The page-context hook is injected directly via manifest content_scripts (world: MAIN).
  // Keep this as a no-op to satisfy the shared core interface.
}

function signalPageAutofillNextOpen() {
  window.postMessage({ source: 'tecis-extension', type: 'set-autofill-next-open' }, '*');
  window.dispatchEvent(new CustomEvent('tecis-extension:set-autofill-next-open'));
}

function createDocumentJsonPromise() {
  let resolvePromise;
  const promise = new Promise((resolve) => {
    resolvePromise = resolve;
  });

  const handler = (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.source !== 'tecis-extension') return;
    if (event.data.type !== 'document-json') return;
    resolvePromise(event.data.payload);
    window.removeEventListener('message', handler);
  };

  window.addEventListener('message', handler);

  const script = document.createElement('script');
  script.textContent = `
    (function() {
      const originalOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url) {
        if (typeof url === 'string' && url.includes('pAction=load')) {
          this.addEventListener('load', function() {
            try {
              const json = JSON.parse(this.responseText);
              if (json && (json.pages || json.formFields)) {
                window.postMessage({ source: 'tecis-extension', type: 'document-json', payload: json }, '*');
              }
            } catch (e) {
              console.error('Autofill: Failed to parse intercepted JSON', e);
            }
          });
        }
        return originalOpen.apply(this, arguments);
      };
    })();
  `;
  (document.head || document.documentElement).appendChild(script);
  script.remove();

  return promise;
}

initGespraechsnotizAutofillList({ installWindowOpenHook, signalPageAutofillNextOpen });
initGespraechsnotizAutofillEditor({ fetchJson, createDocumentJsonPromise });
