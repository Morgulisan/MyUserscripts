// ==UserScript==
// @name         Short Blocking
// @namespace    http://tampermonkey.net/
// @version      1
// @updateURL    https://mopoliti.de/Userscripts/Short%20Blocking-2025-02-03.user.js
// @description  Disable scrolling on YouTube Shorts pages (blocking the down arrow) and remove the navigation container if present.
// @author       Malte Kretzschmar
// @match        https://www.youtube.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @grant        none
// ==/UserScript==

(function() {
  'use strict';

  let scrollingDisabled = false;
  let navObserver = null;

  // --- Event Handlers for Scrolling Prevention ---

  function wheelHandler(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function touchmoveHandler(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function keydownHandler(e) {
    // Block keys: space (32), page up (33), page down (34), end (35), home (36),
    // left arrow (37), up arrow (38), right arrow (39), down arrow (40)
    const scrollKeys = [32, 33, 34, 35, 36, 37, 38, 39, 40];
    if (scrollKeys.includes(e.keyCode) || e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }
  }

  // --- Functions to Toggle Scrolling ---

  function disableScrolling() {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    window.addEventListener('wheel', wheelHandler, { capture: true, passive: false });
    window.addEventListener('touchmove', touchmoveHandler, { capture: true, passive: false });
    window.addEventListener('keydown', keydownHandler, { capture: true, passive: false });

    scrollingDisabled = true;
    console.log('[Short Blocking] Scrolling disabled');
  }

  function enableScrolling() {
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';

    window.removeEventListener('wheel', wheelHandler, { capture: true, passive: false });
    window.removeEventListener('touchmove', touchmoveHandler, { capture: true, passive: false });
    window.removeEventListener('keydown', keydownHandler, { capture: true, passive: false });

    scrollingDisabled = false;
    console.log('[Short Blocking] Scrolling enabled');
  }

  // --- Functions to Remove the Navigation Container ---

  // Starts a MutationObserver to continuously remove any element with the
  // class "navigation-container style-scope ytd-shorts" that may be added.
  function startNavObserver() {
    if (navObserver) return; // Already active

    navObserver = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Direct match
              if (node.matches('.navigation-container.style-scope.ytd-shorts')) {
                node.remove();
                console.log('[Short Blocking] Removed navigation container (observer)');
              } else {
                // Check within the node's subtree
                const nav = node.querySelector('.navigation-container.style-scope.ytd-shorts');
                if (nav) {
                  nav.remove();
                  console.log('[Short Blocking] Removed navigation container (observer)');
                }
              }
            }
          });
        }
      }
    });

    navObserver.observe(document.body, { childList: true, subtree: true });
  }

  function stopNavObserver() {
    if (navObserver) {
      navObserver.disconnect();
      navObserver = null;
    }
  }

  // --- URL Check and Toggling Function ---
  // Because YouTube is a single‑page app, we monitor URL changes.
  function checkURLAndToggleScrolling() {
    if (/^https:\/\/www\.youtube\.com\/shorts\/.+/.test(window.location.href)) {
      // On a Shorts page
      if (!scrollingDisabled) {
        disableScrolling();
      }
      // Immediately remove the navigation container if it exists
      const nav = document.querySelector('.navigation-container.style-scope.ytd-shorts');
      if (nav) {
        nav.remove();
        console.log('[Short Blocking] Removed navigation container');
      }
      // Begin observing for future additions of the navigation container
      startNavObserver();
    } else {
      // On a non-Shorts page: re-enable scrolling and disconnect the observer
      if (scrollingDisabled) {
        enableScrolling();
      }
      stopNavObserver();
    }
  }

  // --- URL Change Detection ---
  // Override pushState and replaceState so that navigation changes dispatch a custom event.
  (function(history) {
    const pushState = history.pushState;
    const replaceState = history.replaceState;
    history.pushState = function() {
      const ret = pushState.apply(history, arguments);
      window.dispatchEvent(new Event('locationchange'));
      return ret;
    };
    history.replaceState = function() {
      const ret = replaceState.apply(history, arguments);
      window.dispatchEvent(new Event('locationchange'));
      return ret;
    };
  })(window.history);

  // Also trigger the event on back/forward navigation
  window.addEventListener('popstate', function() {
    window.dispatchEvent(new Event('locationchange'));
  });

  // Listen for our custom locationchange event
  window.addEventListener('locationchange', checkURLAndToggleScrolling);

  // Fallback: periodically check the URL every second
  setInterval(checkURLAndToggleScrolling, 1000);

  // Run an initial check
  checkURLAndToggleScrolling();

})();
