chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== 'fetchJson') {
        return;
    }

    const { url, options = {} } = message;
    const { method = 'GET', headers = {}, body = null, credentials = 'include' } = options;

    fetch(url, { method, headers, body, credentials })
        .then(async (response) => {
            let data = null;
            try {
                data = await response.json();
            } catch (err) {
                data = await response.text();
            }
            sendResponse({ ok: response.ok, status: response.status, data });
        })
        .catch((error) => {
            sendResponse({ ok: false, status: 0, error: error.message });
        });

    return true;
});
