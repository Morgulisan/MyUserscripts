// ==UserScript==
// @name         mobile.de Entlasten
// @namespace    http://tampermonkey.net/
// @version      2.0.0
// @description  Entfernt Werbung, Gesponsert, Banner, Footer, Finanzierung/Services u.a.; Endlos-Scroll statt Pagination auf der Suchergebnisseite
// @author       Malte Kretzschmar
// @match        https://suchen.mobile.de/fahrzeuge/search.html*
// @match        https://suchen.mobile.de/fahrzeuge/details.html*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=mobile.de
// @updateURL    https://mopoliti.de/Userscripts/mobile.de%20Entlasten.user.js
// @downloadURL  https://mopoliti.de/Userscripts/mobile.de%20Entlasten.user.js
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ---------------------------------------------------------------
  // Konfiguration: true = ausblenden/aktivieren, false = stehen lassen
  // ---------------------------------------------------------------
  const CONFIG = {
    // Beide Seiten
    topBanner: true,            // großes Werbebanner ganz oben
    adSlots: true,              // Werbeblöcke (class _kKPHM, SRP_*/VIP_*-Slots, "Anzeige")
    footer: true,               // Footer
    appBanner: true,            // "App installieren"-Banner

    // Suchergebnisse
    gesponsert: true,           // "Gesponsert"-Treffer (Top-/TIC-Angebote)
    versicherungChip: true,     // Chip "Versicherung ab … mtl."
    autobewertung: true,        // Kachel "Wie viel ist dein Auto wert?"
    endlosScroll: true,         // Endlos-Scroll statt Pagination

    // Inserat
    weitereServices: true,      // "Weitere Services" (Carfax, CHECK24 …) + Services-Box beim Händler
    finanzierung: true,         // "Finanzierung berechnen", Monatsrate, Rechner, Sticky-Button
    ionityBanner: true,         // IONITY-Werbebanner

    // Optional (standardmäßig aus)
    mobeeKI: false,             // "Frag deinen KI-Assistenten" (mobee)
    aehnlicheFahrzeuge: false,  // Karussell "Ähnliche Fahrzeuge"
    haendlerFolgen: false,      // "Interessiert an Angeboten dieses Händlers?"
    karte: false,               // Standort-Karte
  };

  const LOAD_AHEAD_PX = 1800;   // so früh vor dem Listenende wird die nächste Seite geladen

  // ---------------------------------------------------------------
  // Selektoren. mobile.de nutzt gehashte Klassennamen, die sich bei
  // jedem Deploy ändern können – deshalb vor allem data-testid / Struktur.
  // ---------------------------------------------------------------
  const RULES = {
    topBanner: [
      'div:has(> div > img[data-testid="takeover-fallback-image"])',
      'img[data-testid="takeover-fallback-image"]',
    ],
    adSlots: [
      '._kKPHM',                                                // Werbeblock-Klasse (kann sich ändern, Testids darunter sichern ab)
      '[data-testid^="SRP_"]',                                  // Suche: SRP_TABLECELL_*, SRP_SBANNER_BOTTOM …
      '[data-testid^="VIP_"]',                                  // Inserat: VIP_OOP, VIP_BODY_*, VIP_MRECT_PREMIUM …
      'div[style*="min-height"]:has(> [data-testid^="VIP_"])',  // Wrapper mit fester Mindesthöhe
      '[data-label="Anzeige"]',
      '[id^="div-gpt-ad"]',
      '[id^="google_ads_iframe"]',
      'iframe[src*="doubleclick.net"]',
      'iframe[title*="Criteo" i]',
    ],
    footer: ['footer#reduced-footer', 'footer[data-testid="reduced-footer"]'],
    appBanner: ['[data-testid^="web2app"]'],

    gesponsert: [
      '[data-testid="result-list"] > article:has([data-testid^="top-result-listing"])',
      '[data-testid="result-list"] > article:has([data-testid^="tic-result-listing"])',
    ],
    versicherungChip: ['[data-testid="rate-badge-insurance"]'],

    weitereServices: [
      '[data-testid="vip-more-services"]',
      '#weitereservices',
      '[data-testid="vip-dealer-box-extensible-extensible-additional-services-content-section"]',
    ],
    finanzierung: [
      '[data-testid="financing-entrypoint"]',
      '[data-testid="financing-modal-trigger"]',
      '[data-testid="vip-vehicle-overview-fin-link"]',
      '[data-testid="vip-sticky-cta-fin-link"]',
      '[data-testid="financing-calculator"]',
    ],
    ionityBanner: ['[data-testid="ionity-banner"]'],

    mobeeKI: [
      '[data-testid="ai-card"]',
      '[data-testid="mobee-entry-point-cta"]',
      'body > div:has([data-testid="ai-card"])',
    ],
    aehnlicheFahrzeuge: [
      '[data-testid="vehicle-recommendations-carousel"]',
      '[data-testid="vip-similar-ads"]',
    ],
    haendlerFolgen: ['[data-testid="vip-dealer-box-follow-dealer-promo"]'],
    karte: ['[data-testid="vip-dealer-box-map-content-section"]'],
  };

  const selectors = Object.keys(RULES)
    .filter((key) => CONFIG[key])
    .flatMap((key) => RULES[key]);

  // Pagination ausblenden, sobald Endlos-Scroll aktiv ist (rein per CSS, kein Flackern)
  if (CONFIG.endlosScroll) {
    selectors.push('[data-testid="result-list"] > div:has([data-testid="pagination:previous"])');
  }

  // 1) CSS sofort einhängen (document-start => kein Aufblitzen der Werbung)
  const css = [
    selectors.join(',\n') + ' { display: none !important; }',
    '[data-mde-hide] { display: none !important; }',
    // Performance: Karten außerhalb des Sichtbereichs werden nicht gerendert
    '[data-testid="result-list"] > article { content-visibility: auto; contain-intrinsic-size: auto 380px; }',
    '#mde-sentinel { text-align: center; padding: 28px 0 40px; opacity: .65; font: 14px/1.4 system-ui, sans-serif; }',
  ].join('\n');
  const style = document.createElement('style');
  style.id = 'mde-entlasten';
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);

  const hide = (el) => { if (el && !el.hasAttribute('data-mde-hide')) el.setAttribute('data-mde-hide', ''); };

  // ---------------------------------------------------------------
  // 2) Dinge, die sich nicht sauber per CSS treffen lassen
  // ---------------------------------------------------------------

  // Inserat: Finanzierungsblock im Preisbereich (Wrapper ohne Testid).
  // Vom Rechner nach oben klettern, bis der Elternknoten den Preis enthält.
  function hidePriceBoxFinancing() {
    if (!CONFIG.finanzierung) return;
    document.querySelectorAll('[data-testid="financing-calculator"]').forEach((calc) => {
      let el = calc;
      while (el.parentElement && !el.parentElement.querySelector('[data-testid="main-price-area"]')) {
        el = el.parentElement;
        if (el === document.body) return;
      }
      if (el !== calc) hide(el);
    });
  }

  // Suche: Textbasierte Treffer ohne Testid ("Gesponsert", "Wie viel ist dein Auto wert?")
  function hideTextMatches() {
    if (!CONFIG.gesponsert && !CONFIG.autobewertung) return;
    document.querySelectorAll('article:not([data-mde-checked])').forEach((art) => {
      art.setAttribute('data-mde-checked', '');
      const isListing = art.querySelector('[data-testid*="result-listing"]');
      const head = art.textContent.trim().slice(0, 40);
      if (CONFIG.gesponsert && isListing && /Gesponsert/.test(head)) { hide(art); return; }
      if (CONFIG.autobewertung && !isListing && art.textContent.length < 4000 &&
          /Wie viel ist dein Auto wert/i.test(art.textContent)) {
        let el = art;
        while (el.parentElement && el.parentElement.children.length === 1 &&
               !['MAIN', 'BODY'].includes(el.parentElement.tagName)) {
          el = el.parentElement;
        }
        hide(el);
      }
    });
  }

  // ---------------------------------------------------------------
  // 3) Endlos-Scroll (Suchergebnisse)
  //    Lädt die Folgeseiten per ?pageNumber=N, übernimmt nur die Treffer-Karten
  //    und hängt sie vor die (ausgeblendete) Pagination.
  // ---------------------------------------------------------------
  const isSearchPage = () => location.pathname.startsWith('/fahrzeuge/search.html');
  const getList = () => document.querySelector('[data-testid="result-list"]');
  const searchSig = () => { const u = new URL(location.href); u.searchParams.delete('pageNumber'); return u.search; };
  const listingId = (art) => {
    const a = art.querySelector('a[href*="details.html"]');
    const m = a && /[?&]id=(\d+)/.exec(a.getAttribute('href') || '');
    return m ? m[1] : null;
  };
  const isSponsored = (art) =>
    !!art.querySelector('[data-testid^="top-result-listing"],[data-testid^="tic-result-listing"]') ||
    /Gesponsert/.test(art.textContent.trim().slice(0, 40));

  const es = { list: null, sig: null, page: 1, maxPage: null, loading: false, done: false, seen: new Set(), sentinel: null, io: null };

  function paginationWrapper(list) {
    const p = list.querySelector('[data-testid="pagination:previous"]');
    if (!p) return null;
    let el = p;
    while (el.parentElement && el.parentElement !== list) el = el.parentElement;
    return el.parentElement === list ? el : null;
  }

  function readMaxPage(list) {
    const wrap = paginationWrapper(list);
    if (!wrap) return null;
    const nums = [...wrap.querySelectorAll('button,a')]
      .map((b) => parseInt(b.textContent.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    return nums.length ? Math.max(...nums) : null;
  }

  function setStatus(text) {
    if (es.sentinel && es.sentinel.textContent !== text) es.sentinel.textContent = text;
  }

  function resetEndless(list, sig) {
    document.querySelectorAll('[data-mde-more]').forEach((n) => n.remove());
    es.list = list;
    es.sig = sig;
    es.page = parseInt(new URL(location.href).searchParams.get('pageNumber') || '1', 10) || 1;
    es.maxPage = null;
    es.loading = false;
    es.done = false;
    es.seen = new Set();
    list.querySelectorAll(':scope > article').forEach((a) => { const id = listingId(a); if (id) es.seen.add(id); });
    setStatus('');
  }

  function ensureSentinel(list) {
    if (!es.sentinel) {
      es.sentinel = document.createElement('div');
      es.sentinel.id = 'mde-sentinel';
      es.io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) maybeLoad();
      }, { rootMargin: `0px 0px ${LOAD_AHEAD_PX}px 0px` });
    }
    if (!es.sentinel.isConnected || es.sentinel.previousElementSibling !== list) {
      list.insertAdjacentElement('afterend', es.sentinel);
      es.io.disconnect();
      es.io.observe(es.sentinel);
    }
  }

  function sentinelNearViewport() {
    if (!es.sentinel || !es.sentinel.isConnected) return false;
    return es.sentinel.getBoundingClientRect().top < window.innerHeight + LOAD_AHEAD_PX;
  }

  async function maybeLoad() {
    while (!es.loading && !es.done && sentinelNearViewport()) {
      const got = await loadNext();
      if (!got) break;
    }
  }

  // Gibt true zurück, wenn die Seite abgearbeitet wurde und weitergeprüft werden soll
  async function loadNext() {
    const list = getList();
    if (!list || es.list !== list) return false;
    const next = es.page + 1;
    if (es.maxPage && next > es.maxPage) { finish(); return false; }

    es.loading = true;
    setStatus('Lade weitere Ergebnisse …');
    const sig = es.sig;
    try {
      const u = new URL(location.href);
      u.searchParams.set('pageNumber', String(next));
      const res = await fetch(u.toString(), { credentials: 'same-origin' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      if (es.sig !== sig || es.list !== getList()) return false; // Suche wurde zwischenzeitlich geändert

      const items = [...doc.querySelectorAll('[data-testid="result-list"] > article')];
      if (!items.length) { finish(); return false; }

      const frag = document.createDocumentFragment();
      items.forEach((art) => {
        if (CONFIG.gesponsert && isSponsored(art)) return;
        const id = listingId(art);
        if (id) { if (es.seen.has(id)) return; es.seen.add(id); }
        const node = document.importNode(art, true);
        node.setAttribute('data-mde-more', '');
        node.setAttribute('data-mde-checked', '');
        node.querySelectorAll('img').forEach((img) => { img.setAttribute('loading', 'lazy'); img.setAttribute('decoding', 'async'); });
        frag.appendChild(node);
      });

      const anchor = paginationWrapper(list);
      if (anchor) list.insertBefore(frag, anchor); else list.appendChild(frag);
      es.page = next;
      if (es.maxPage && es.page >= es.maxPage) { finish(); return false; }
      setStatus('');
      return true;
    } catch (err) {
      console.warn('[mde] Nachladen fehlgeschlagen:', err);
      setStatus('Nachladen fehlgeschlagen – nach unten/oben scrollen zum erneuten Versuch');
      return false;
    } finally {
      es.loading = false;
    }
  }

  function finish() {
    es.done = true;
    es.loading = false;
    setStatus('Ende der Ergebnisse');
  }

  function ensureEndless() {
    if (!CONFIG.endlosScroll || !isSearchPage()) return;
    const list = getList();
    if (!list) return;
    const sig = searchSig();
    if (es.list !== list || es.sig !== sig) resetEndless(list, sig);
    if (es.maxPage === null) es.maxPage = readMaxPage(list);
    ensureSentinel(list);
    if (!es.loading && !es.done) maybeLoad();
  }

  // ---------------------------------------------------------------
  // Beobachter: die Seite ist eine React-/Next.js-App, Inhalte kommen
  // nachträglich und bei Navigation neu. Höchstens einmal pro Frame.
  // ---------------------------------------------------------------
  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      hidePriceBoxFinancing();
      hideTextMatches();
      ensureEndless();
    });
  }

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('scroll', () => { if (!es.loading && !es.done) maybeLoad(); }, { passive: true });
  schedule();
})();
