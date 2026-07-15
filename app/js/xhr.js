/* xhr.js - Promise wrapper over a mozSystem XMLHttpRequest.
   The `mozSystem: true` option (granted via the "systemXHR" manifest
   permission on privileged KaiOS apps) bypasses same-origin / CORS
   restrictions so we can reach a self-hosted Home Assistant on the LAN.
   ES5-safe. */
(function (global) {
  'use strict';

  var DEFAULT_TIMEOUT = 15000;

  function createXhr() {
    // SECURITY-REVIEW: mozSystem XHR sends requests to a user-controlled host
    // with the user's bearer token. Only the configured baseUrl is contacted.
    try {
      return new XMLHttpRequest({ mozSystem: true });
    } catch (e) {
      // Non-KaiOS environments (simulator/desktop) fall back to a normal XHR.
      return new XMLHttpRequest();
    }
  }

  /**
   * request(opts) -> Promise
   * opts: { method, url, token, body (object|undefined), timeout }
   * Resolves with parsed JSON (or raw text when not JSON); rejects with
   * an Error carrying a `.status` property.
   */
  function request(opts) {
    return new Promise(function (resolve, reject) {
      var method = (opts.method || 'GET').toUpperCase();
      var xhr;
      try {
        xhr = createXhr();
        xhr.open(method, opts.url, true);
      } catch (e) {
        reject(wrapError('Invalid request', 0));
        return;
      }

      xhr.timeout = opts.timeout || DEFAULT_TIMEOUT;

      if (opts.token) {
        // SECURITY-REVIEW: bearer token attached only to the configured host.
        xhr.setRequestHeader('Authorization', 'Bearer ' + opts.token);
      }
      if (opts.body !== undefined && opts.body !== null) {
        xhr.setRequestHeader('Content-Type', 'application/json');
      }

      xhr.onload = function () {
        var status = xhr.status;
        var text = xhr.responseText;
        var parsed = parseMaybeJson(text);
        if (status >= 200 && status < 300) {
          resolve(parsed);
        } else if (status === 401 || status === 403) {
          reject(wrapError('Unauthorized (check token)', status));
        } else {
          reject(wrapError('HTTP ' + status, status));
        }
      };

      xhr.onerror = function () {
        reject(wrapError('Network error', 0));
      };

      xhr.ontimeout = function () {
        reject(wrapError('Request timed out', 0));
      };

      try {
        if (opts.body !== undefined && opts.body !== null) {
          xhr.send(JSON.stringify(opts.body));
        } else {
          xhr.send();
        }
      } catch (e) {
        reject(wrapError('Send failed', 0));
      }
    });
  }

  function parseMaybeJson(text) {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      return text;
    }
  }

  function wrapError(message, status) {
    var err = new Error(message);
    err.status = status;
    return err;
  }

  global.HAXhr = { request: request };
})(window);
