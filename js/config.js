/* config.js - persistence of Home Assistant base URL + long-lived access token.
   ES5-safe (KaiOS 2.5 / Gecko 48): no let/const/arrow/async. */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'ha4kaios.config';

  // SECURITY-REVIEW: The long-lived access token grants full API access to the
  // user's Home Assistant. It is stored only in this app's private localStorage
  // (sandboxed per packaged app on KaiOS) and is never logged or sent anywhere
  // other than the user-configured Home Assistant host.
  function load() {
    var cfg = { baseUrl: '', token: '' };
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          cfg.baseUrl = typeof parsed.baseUrl === 'string' ? parsed.baseUrl : '';
          cfg.token = typeof parsed.token === 'string' ? parsed.token : '';
        }
      }
    } catch (e) {
      // Corrupt or unavailable storage: fall back to empty config.
    }
    return cfg;
  }

  function save(cfg) {
    // SECURITY-REVIEW: persisting the access token locally (see note above).
    var data = {
      baseUrl: normalizeBaseUrl(cfg.baseUrl || ''),
      token: cfg.token || ''
    };
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  function clear() {
    try {
      global.localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }

  function isConfigured(cfg) {
    return !!(cfg && cfg.baseUrl && cfg.token);
  }

  // Strip trailing slashes and whitespace; ensure a scheme is present.
  function normalizeBaseUrl(url) {
    var u = (url || '').replace(/^\s+|\s+$/g, '');
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) {
      u = 'http://' + u;
    }
    u = u.replace(/\/+$/, '');
    return u;
  }

  // Derive the ws(s):// WebSocket endpoint from an http(s) base URL.
  function wsUrl(baseUrl) {
    var u = normalizeBaseUrl(baseUrl);
    if (!u) return '';
    var ws = u.replace(/^http/i, 'ws');
    return ws + '/api/websocket';
  }

  global.HAConfig = {
    load: load,
    save: save,
    clear: clear,
    isConfigured: isConfigured,
    normalizeBaseUrl: normalizeBaseUrl,
    wsUrl: wsUrl
  };
})(window);
