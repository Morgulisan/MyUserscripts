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

function getPageWindowOpenHookSource() {
  return `
    (function() {
      let addAutofillNextOpen = false;

      function isNormalUrl(u) {
        return typeof u === "string" && !/^(?:javascript:|data:|blob:)/i.test(u);
      }

      function getContextParams() {
        const params = new URLSearchParams(location.search);
        return {
          wibiid: params.get("wibiid"),
          svhvnr: params.get("svhvnr"),
          verkaufsbegleiter: params.get("verkaufsbegleiter")
        };
      }

      function appendParams(u, forceAutofill) {
        if (!isNormalUrl(u)) return u;
        let target;
        try {
          target = new URL(u, location.href);
        } catch {
          return u;
        }

        const context = getContextParams();
        if (context.wibiid && !target.searchParams.has("wibiid")) {
          target.searchParams.set("wibiid", context.wibiid);
        }
        if (context.svhvnr && !target.searchParams.has("svhvnr")) {
          target.searchParams.set("svhvnr", context.svhvnr);
        }
        if (context.verkaufsbegleiter && !target.searchParams.has("verkaufsbegleiter")) {
          target.searchParams.set("verkaufsbegleiter", context.verkaufsbegleiter);
        }
        if (forceAutofill) {
          target.searchParams.set("autofill", "true");
        }
        return target.toString();
      }

      const originalOpen = window.open;
      Object.defineProperty(window, "open", {
        configurable: true,
        writable: true,
        value: function(url, name, specs, replace) {
          if (typeof url === "string") {
            url = appendParams(url, addAutofillNextOpen);
          }
          const ret = originalOpen.call(this, url, name, specs, replace);
          addAutofillNextOpen = false;
          return ret;
        }
      });

      window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        if (!event.data || event.data.source !== 'tecis-extension') return;
        if (event.data.type === 'set-autofill-next-open') {
          addAutofillNextOpen = true;
        }
      });
    })();
  `;
}

function installWindowOpenHook() {
  const script = document.createElement('script');
  script.textContent = getPageWindowOpenHookSource();
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

function signalPageAutofillNextOpen() {
  window.postMessage({ source: 'tecis-extension', type: 'set-autofill-next-open' }, '*');
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
