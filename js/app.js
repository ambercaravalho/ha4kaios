/* app.js - controller: routing, softkeys, header/status, toast, and the
   single HAClient instance whose events are forwarded to the active view.
   ES5-safe. */
(function (global) {
  'use strict';

  var els = {};
  var client = null;
  var currentView = null;
  var currentName = '';
  var toastTimer = null;

  var app = {
    setTitle: setTitle,
    setSoftkeys: setSoftkeys,
    toast: toast,
    clearToast: clearToast,
    go: go,
    getClient: getClient,
    hasClient: hasClient,
    startClientAndGoList: startClientAndGoList
  };

  function cacheEls() {
    els.title = document.getElementById('header-title');
    els.status = document.getElementById('header-status');
    els.view = document.getElementById('view');
    els.skLeft = document.getElementById('sk-left');
    els.skCenter = document.getElementById('sk-center');
    els.skRight = document.getElementById('sk-right');
    els.toast = document.getElementById('toast');
  }

  function setTitle(t) {
    els.title.textContent = t || 'HA4KaiOS';
  }

  function setSoftkeys(left, center, right) {
    els.skLeft.textContent = left || '';
    els.skCenter.textContent = center || '';
    els.skRight.textContent = right || '';
  }

  function setStatusIndicator(info) {
    var status = info.status;
    var label = status;
    if (status === 'online' && info.usingRest) label = 'rest';
    els.status.textContent = label;
    els.status.className = 'status status-' +
      (status === 'online' ? 'online' : (status === 'connecting' ? 'connecting' : 'offline'));
  }

  function toast(msg, ms) {
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.className = 'toast';
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    var duration = (ms === undefined) ? 1500 : ms;
    if (duration > 0) {
      toastTimer = setTimeout(clearToast, duration);
    }
  }

  function clearToast() {
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    if (els.toast) els.toast.className = 'toast hidden';
  }

  function getClient() { return client; }
  function hasClient() { return !!client; }

  function go(name, params) {
    if (!HAViews[name]) return;
    if (currentView && currentView.destroy) {
      try { currentView.destroy(); } catch (e) {}
    }
    els.view.innerHTML = '';
    clearToast();
    currentView = HAViews[name](app);
    currentName = name;
    currentView.render(els.view, params || {});
  }

  function startClientAndGoList() {
    var cfg = HAConfig.load();
    if (client) { client.stop(); client = null; }
    client = new HAClient(cfg);

    client.on('status', function (info) {
      setStatusIndicator(info);
    });
    client.on('states', function () {
      if (currentView && currentView.onStates) currentView.onStates();
    });
    client.on('state_changed', function (evt) {
      if (currentView && currentView.onStateChanged) currentView.onStateChanged(evt);
    });
    client.on('auth_invalid', function (msg) {
      toast(msg || 'Invalid token', 3000);
      go('setup');
    });

    client.start();
    go('list');
  }

  function onKey(key, ev) {
    if (currentView && currentView.onKey) {
      return currentView.onKey(key, ev);
    }
    return false;
  }

  function boot() {
    cacheEls();
    HANav.attach(onKey);

    var cfg = HAConfig.load();
    if (HAConfig.isConfigured(cfg)) {
      startClientAndGoList();
    } else {
      go('setup');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, false);
  } else {
    boot();
  }

  global.App = app;
})(window);
