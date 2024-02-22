// ==UserScript==
// @name         Malte Wiki - Local Checkbox
// @namespace    http://tampermonkey.net/
// @version      2024-02-22
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
// Function to set a value in localStorage or cookies
    function setStorage(key, value) {
        if (window.localStorage) {
            localStorage.setItem(key, value);
        } else {
            document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; path=/; max-age=1236000`; // ca 2 Wochen
        }
    }

// Function to get a value from localStorage or cookies
    function getStorage(key) {
        if (window.localStorage) {
            return localStorage.getItem(key);
        } else {
            const nameEQ = `${encodeURIComponent(key)}=`;
            const ca = document.cookie.split(';');
            for (let i = 0; i < ca.length; i++) {
                let c = ca[i];
                while (c.charAt(0) === ' ') c = c.substring(1, c.length);
                if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
            }
            return null;
        }
    }

// Function to uniquely identify each checkbox
    function generateCheckboxId(index) {
        return `checkbox-${window.location.pathname}-${index}`;
    }
// Function to encapsulate your checkbox logic for reuse
    function handleCheckboxes() {
        const checkboxes = document.querySelectorAll('input[type=checkbox]');
        checkboxes.forEach((checkbox, index) => {
            checkbox.disabled = false; // Enable checkbox
            const checkboxId = `checkbox-${window.location.pathname}-${index}`; // Adjusted for pathname
            checkbox.id = checkboxId;

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
        const checkboxId = this.id; // 'this' refers to the checkbox
        setStorage(checkboxId, this.checked);
    }

    handleCheckboxes();

// Observe URL changes that happen through history API
    (function(history){
        var pushState = history.pushState;
        var replaceState = history.replaceState;

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