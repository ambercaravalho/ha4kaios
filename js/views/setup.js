/* views/setup.js - enter HA base URL + long-lived access token, test, persist.
   ES5-safe. */
(function (global) {
  'use strict';

  global.HAViews = global.HAViews || {};

  global.HAViews.setup = function (app) {
    var container = null;
    var focusables = [];
    var focusIndex = 0;
    var urlInput = null;
    var tokenInput = null;
    var connectBtn = null;
    var busy = false;

    function render(root, params) {
      container = root;
      var cfg = HAConfig.load();

      // Static structure only (no server data) -> innerHTML is CSP-safe here.
      container.innerHTML =
        '<div class="form">' +
        '  <div class="field">' +
        '    <label for="ha-url">Home Assistant URL</label>' +
        '    <input id="ha-url" type="url" placeholder="http://192.168.1.10:8123" />' +
        '  </div>' +
        '  <div class="field">' +
        '    <label for="ha-token">Long-Lived Access Token</label>' +
        '    <input id="ha-token" type="password" placeholder="Paste token" />' +
        '  </div>' +
        '  <div id="ha-connect" class="control" data-nofocus="1">' +
        '    <span class="control-label">Connect</span>' +
        '    <span class="control-value">&#8250;</span>' +
        '  </div>' +
        '</div>' +
        '<div class="hint">Create a token in Home Assistant: Profile &raquo; Security &raquo; ' +
        'Long-Lived Access Tokens &raquo; Create Token.</div>';

      urlInput = document.getElementById('ha-url');
      tokenInput = document.getElementById('ha-token');
      connectBtn = document.getElementById('ha-connect');

      urlInput.value = cfg.baseUrl || '';
      tokenInput.value = cfg.token || '';

      focusables = [urlInput, tokenInput, connectBtn];
      focusIndex = 0;

      app.setTitle('Setup');
      applyFocus();
      updateSoftkeys();
    }

    function applyFocus() {
      for (var i = 0; i < focusables.length; i++) {
        var el = focusables[i];
        if (i === focusIndex) {
          if (el === connectBtn) {
            el.className = 'control focused';
            el.setAttribute('data-nofocus', '1');
            if (document.activeElement && document.activeElement.blur) {
              document.activeElement.blur();
            }
          } else {
            try { el.focus(); } catch (e) {}
          }
        } else if (el === connectBtn) {
          el.className = 'control';
        }
      }
    }

    function updateSoftkeys() {
      var center = (focusables[focusIndex] === connectBtn) ? 'CONNECT' : '';
      var left = app.hasClient() ? 'Back' : '';
      app.setSoftkeys(left, center, 'Connect');
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

    function doConnect() {
      if (busy) return;
      var url = (urlInput.value || '').replace(/^\s+|\s+$/g, '');
      var token = (tokenInput.value || '').replace(/^\s+|\s+$/g, '');
      if (!url) { app.toast('Enter a URL'); return; }
      if (!token) { app.toast('Enter a token'); return; }

      busy = true;
      app.toast('Connecting...', 0);
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
      switch (key) {
        case 'Up': move(-1); return true;
        case 'Down': move(1); return true;
        case 'Enter':
          if (focusables[focusIndex] === connectBtn) { doConnect(); }
          else { move(1); }
          return true;
        case 'SoftRight':
          doConnect();
          return true;
        case 'SoftLeft':
          if (app.hasClient()) { app.go('list'); return true; }
          return false;
        case 'Backspace':
          // Let the focused text input handle deletion; only navigate back
          // when focus is on the Connect button.
          if (focusables[focusIndex] === connectBtn && app.hasClient()) {
            app.go('list');
            return true;
          }
          return false;
      }
      return false;
    }

    function destroy() {
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
      container = null;
    }

    return { render: render, onKey: onKey, destroy: destroy };
  };
})(window);
