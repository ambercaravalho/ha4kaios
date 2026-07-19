/* views/setup.js - enter HA base URL + long-lived access token, test, persist.
   Supports scanning the token from Home Assistant's QR code. ES5-safe. */
(function (global) {
  'use strict';

  global.HAViews = global.HAViews || {};

  global.HAViews.setup = function (app) {
    var container = null;
    var focusables = [];
    var focusIndex = 0;
    var urlInput = null;
    var tokenInput = null;
    var scanBtn = null;
    var connectBtn = null;
    var busy = false;
    var scanning = false;

    function render(root, params) {
      container = root;
      var cfg = HAConfig.load();

      // Static structure only (no server data) -> innerHTML is CSP-safe here.
      // Action buttons use the .btn convention (not menu-row) so they carry no
      // drill-in chevron; their icon badges are appended as real SVG nodes
      // below (SVG isn't injected as inline HTML).
      container.innerHTML =
        '<div class="section">Connect to Home Assistant</div>' +
        '<div class="form">' +
        '  <div class="field">' +
        '    <label for="ha-url">Home Assistant URL</label>' +
        '    <input id="ha-url" type="url" placeholder="http://192.168.1.10:8123" />' +
        '  </div>' +
        '  <div class="field">' +
        '    <label for="ha-token">Long-Lived Access Token</label>' +
        '    <input id="ha-token" type="password" placeholder="Paste or scan token" />' +
        '  </div>' +
        '</div>' +
        '<div id="ha-scan" class="btn">' +
        '  <span class="btn-badge"></span>' +
        '  <span class="btn-label">Scan token QR</span>' +
        '</div>' +
        '<div id="ha-connect" class="btn btn-primary">' +
        '  <span class="btn-badge"></span>' +
        '  <span class="btn-label">Connect</span>' +
        '</div>' +
        '<div class="section">Help</div>' +
        '<div class="hint">Create a token in Home Assistant: Profile &raquo; Security &raquo; ' +
        'Long-Lived Access Tokens &raquo; Create Token, then scan its QR code.</div>';

      urlInput = document.getElementById('ha-url');
      tokenInput = document.getElementById('ha-token');
      scanBtn = document.getElementById('ha-scan');
      connectBtn = document.getElementById('ha-connect');

      addBadge(scanBtn, 'camera');
      addBadge(connectBtn, 'lan');

      urlInput.value = cfg.baseUrl || '';
      tokenInput.value = cfg.token || '';

      focusables = [urlInput, tokenInput, scanBtn, connectBtn];
      focusIndex = 0;

      app.setTitle('Setup');
      applyFocus();
      updateSoftkeys();
    }

    function isButton(el) {
      return el === scanBtn || el === connectBtn;
    }

    function addBadge(row, glyph) {
      var badge = row.getElementsByClassName('btn-badge')[0];
      if (badge) badge.appendChild(HAIcons.svg(glyph));
    }

    function baseClass(el) {
      if (el === connectBtn) return 'btn btn-primary';
      if (el === scanBtn) return 'btn';
      return '';
    }

    function applyFocus() {
      for (var i = 0; i < focusables.length; i++) {
        var el = focusables[i];
        if (isButton(el)) {
          el.className = (i === focusIndex) ? baseClass(el) + ' focused' : baseClass(el);
        }
        if (i === focusIndex) {
          if (isButton(el)) {
            if (document.activeElement && document.activeElement.blur) {
              document.activeElement.blur();
            }
          } else {
            try { el.focus(); } catch (e) {}
          }
        }
      }
    }

    function updateSoftkeys() {
      if (scanning) {
        app.setSoftkeys('Cancel', '', '');
        return;
      }
      // Center is the single, contextual primary action; there is no redundant
      // right-softkey Connect while typing in a field.
      var focused = focusables[focusIndex];
      var center = 'Next';
      if (focused === scanBtn) center = 'Scan';
      else if (focused === connectBtn) center = 'Connect';
      var left = app.hasClient() ? 'Back' : '';
      app.setSoftkeys(left, center, '');
    }

    function move(delta) {
      var next = focusIndex + delta;
      if (next < 0) next = 0;
      if (next > focusables.length - 1) next = focusables.length - 1;
      if (next === focusIndex) return;
      focusIndex = next;
      applyFocus();
      updateSoftkeys();
    }

    function startScan() {
      if (scanning || busy) return;
      if (!HAQR.isSupported()) {
        app.toast('Camera/QR not available', 2500);
        return;
      }
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
      scanning = true;
      updateSoftkeys();
      HAQR.start({
        onResult: function (text) {
          scanning = false;
          tokenInput.value = text;
          // Move focus to Connect so the user can confirm in one press.
          focusIndex = focusables.length - 1;
          applyFocus();
          updateSoftkeys();
          app.toast('Token scanned', 1500);
        },
        onError: function (err) {
          scanning = false;
          updateSoftkeys();
          app.toast((err && err.message) || 'Scan failed', 2500);
        }
      });
    }

    function cancelScan() {
      if (!scanning) return;
      scanning = false;
      HAQR.stop();
      updateSoftkeys();
    }

    function doConnect() {
      if (busy) return;
      var url = (urlInput.value || '').replace(/^\s+|\s+$/g, '');
      var token = (tokenInput.value || '').replace(/^\s+|\s+$/g, '');
      if (!url) { app.toast('Enter a URL'); return; }
      if (!token) { app.toast('Enter a token'); return; }

      busy = true;
      app.toast('Connecting\u2026', 0);
      HAClient.testConnection(url, token).then(function () {
        busy = false;
        app.clearToast();
        HAConfig.save({ baseUrl: url, token: token });
        app.startClientAndGoList();
      }, function (err) {
        busy = false;
        app.toast((err && err.message) || 'Connection failed', 3000);
      });
    }

    function onKey(key) {
      // While the scanner overlay is up, keys only control the scanner.
      if (scanning) {
        switch (key) {
          case 'SoftLeft':
          case 'SoftRight':
          case 'Backspace':
          case 'Enter':
          case 'EndCall':
            cancelScan();
            return true;
        }
        return true; // swallow everything else during scan
      }

      switch (key) {
        case 'Up': move(-1); return true;
        case 'Down': move(1); return true;
        case 'Enter':
          if (focusables[focusIndex] === scanBtn) { startScan(); }
          else if (focusables[focusIndex] === connectBtn) { doConnect(); }
          else { move(1); }
          return true;
        case 'SoftLeft':
          if (app.hasClient()) { app.back(); return true; }
          return false;
        case 'Backspace':
          // Let a focused text input handle deletion; only navigate back
          // when focus is on a button.
          if (isButton(focusables[focusIndex]) && app.hasClient()) {
            app.back();
            return true;
          }
          return false;
      }
      return false;
    }

    function destroy() {
      if (scanning) { HAQR.stop(); scanning = false; }
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
      container = null;
    }

    return { render: render, onKey: onKey, destroy: destroy };
  };
})(window);
