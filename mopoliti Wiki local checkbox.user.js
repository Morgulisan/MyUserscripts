// ==UserScript==
// @name         Malte Wiki - Local Checkbox
// @namespace    http://tampermonkey.net/
// @version      2
// @updateURL    https://mopoliti.de/Userscripts/mopoliti%20Wiki%20local%20checkbox.user.js
// @description  Enables local checkbox-states saved to local storage
// @author       Malte Kretzschmar
// @match        https://mopoliti.de/Wiki/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=mopoliti.de
// @grant        none
// ==/UserScript==

/**
 * Obsidian exported Quartz disables all checkboxes, this reenables them for local usage on the web.
 */

(function() {
    'use strict';

    // Function to set a value in localStorage with a timestamp
    function setStorage(key, value) {
        const expiration = new Date().getTime() + (10 * 24 * 60 * 60 * 1000); // 10 days in milliseconds
        const item = {
            value: value,
            expiration: expiration
        };
        if (window.localStorage) {
            localStorage.setItem(key, JSON.stringify(item));
        } else {
            document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(JSON.stringify(item))}; path=/; max-age=864000`; // 10 days in seconds
        }
    }

    // Function to get a value from localStorage checking for expiration
    function getStorage(key) {
        let item = null;
        if (window.localStorage) {
            item = localStorage.getItem(key);
        } else {
            const nameEQ = `${encodeURIComponent(key)}=`;
            const ca = document.cookie.split(';');
            for (let i = 0; i < ca.length; i++) {
                let c = ca[i];
                while (c.charAt(0) === ' ') c = c.substring(1, c.length);
                if (c.indexOf(nameEQ) === 0) item = decodeURIComponent(c.substring(nameEQ.length, c.length));
            }
        }
        if (item) {
            const data = JSON.parse(item);
            const now = new Date().getTime();
            if (now < data.expiration) {
                return data.value; // Return the value if it hasn't expired
            } else {
                if (window.localStorage) {
                    localStorage.removeItem(key); // Remove expired item from localStorage
                }
                // For cookies, we don't explicitly remove them here because they'll expire naturally
            }
        }
        return null; // Return null if no item found or item has expired
    }


    // Function to uniquely identify each checkbox using a data attribute
    function generateCheckboxId(index) {
        return `checkbox-${window.location.pathname}-${index}`;
    }

    // Function to encapsulate your checkbox logic for reuse
    function handleCheckboxes() {
        const checkboxes = document.querySelectorAll('input[type=checkbox]');
        checkboxes.forEach((checkbox, index) => {
            checkbox.disabled = false; // Enable checkbox
            const checkboxId = generateCheckboxId(index); // Adjusted for pathname
            checkbox.setAttribute('data-checkbox-id', checkboxId);

            const savedState = getStorage(checkboxId);
            if (savedState !== null) {
                checkbox.checked = savedState === 'true';
            }

            checkbox.removeEventListener('change', handleCheckboxChange); // Prevent multiple bindings
            checkbox.addEventListener('change', handleCheckboxChange);
        });
    }

    // Function to handle checkbox change events
    function handleCheckboxChange() {
        const checkboxId = this.getAttribute('data-checkbox-id'); // 'this' refers to the checkbox
        setStorage(checkboxId, this.checked);
    }

    handleCheckboxes();

    // Observe URL changes that happen through history API
    (function(history){
        let pushState = history.pushState;
        let replaceState = history.replaceState;

        history.pushState = function(state) {
            if (typeof history.onpushstate == "function") {
                history.onpushstate({state: state});
            }
            // Call handleCheckboxes after the pushState action is completed
            setTimeout(handleCheckboxes, 0);
            return pushState.apply(history, arguments);
        };

        history.replaceState = function(state) {
            if (typeof history.onreplacestate == "function") {
                history.onreplacestate({state: state});
            }
            // Call handleCheckboxes after the replaceState action is completed
            setTimeout(handleCheckboxes, 0);
            return replaceState.apply(history, arguments);
        };

        window.addEventListener('popstate', handleCheckboxes);
    })(window.history);

})();
