(function() {
    let addAutofillNextOpen = false;

    function isNormalUrl(u) {
        return typeof u === "string" && !/^(?:javascript:|data:|blob:)/i.test(u);
    }

    function getCurrentWibiid() {
        try {
            return new URL(location.href).searchParams.get("wibiid");
        } catch {
            return null;
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

        const wibiid = getCurrentWibiid();
        if (wibiid && !target.searchParams.has("wibiid")) {
            target.searchParams.set("wibiid", wibiid);
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
