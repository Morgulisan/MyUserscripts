(function() {
    let addAutofillNextOpen = false;

    function isNormalUrl(u) {
        return typeof u === "string" && !/^(?:javascript:|data:|blob:)/i.test(u);
    }

    function getCurrentContextParams() {
        try {
            const params = new URL(location.href).searchParams;
            return {
                wibiid: params.get("wibiid"),
                svhvnr: params.get("svhvnr"),
                verkaufsbegleiter: params.get("verkaufsbegleiter")
            };
        } catch {
            return {};
        }
    }

    function appendParams(u, forceAutofill) {
        if (!isNormalUrl(u)) return u;
        let target;
        try {
            target = new URL(u, location.href);
        } catch {
            return u;
        }

        const context = getCurrentContextParams();
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

    function setAutofillNextOpen() {
        addAutofillNextOpen = true;
    }

    window.addEventListener('message', (event) => {
        // In some Chrome extension contexts `event.source` can be null.
        if (!event.data || event.data.source !== 'tecis-extension') return;
        if (event.data.type === 'set-autofill-next-open') {
            setAutofillNextOpen();
        }
    });

    window.addEventListener('tecis-extension:set-autofill-next-open', setAutofillNextOpen);
})();
