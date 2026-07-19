/* app.js - controller: back-stack routing, softkeys, header/status, toast,
   theme, an overlay hook (menus), and the single HAClient instance whose events
   are forwarded to the active view. ES5-safe. */
(function (global) {
  'use strict';

  // Top-level screens eligible for last-screen restore.
  var ROOT_SCREENS = {
    favorites: 1, scenes: 1, automations: 1, areas: 1, all: 1, settings: 1
  };

  var els = {};
  var client = null;
  var currentView = null;
  var currentName = '';
  var currentEntry = null; // the stack entry currently rendered (holds saved state)
  var toastTimer = null;
  var stack = [];       // [{ name, params, state }]
  var overlay = null;   // { onKey } - intercepts keys when set

  var app = {
    setTitle: setTitle,
    setSoftkeys: setSoftkeys,
    toast: toast,
    clearToast: clearToast,
    go: go,
    back: back,
    getClient: getClient,
    hasClient: hasClient,
    startClientAndGoList: startClientAndGoHome,
    setOverlay: setOverlay,
    setTheme: setTheme,
    reconnect: reconnect,
    signOut: signOut
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

  function setTitle(t) { els.title.textContent = t || 'HA4KaiOS'; }

  function setSoftkeys(left, center, right) {
    els.skLeft.textContent = left || '';
    els.skCenter.textContent = center || '';
    els.skRight.textContent = right || '';
  }

  function setStatusIndicator(info) {
    var status = info.status;
    var cls, label;
    if (status === 'online') {
      cls = 'online';
      label = info.usingRest ? 'REST' : 'Live';
    } else if (status === 'connecting') {
      cls = 'connecting';
      label = 'Sync';
    } else {
      cls = 'offline';
      label = 'Off';
    }
    els.status.textContent = label;
    els.status.className = 'status status-' + cls;
  }

  function toast(msg, ms) {
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.className = 'toast';
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    var duration = (ms === undefined) ? 1500 : ms;
    if (duration > 0) toastTimer = setTimeout(clearToast, duration);
  }

  function clearToast() {
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    if (els.toast) els.toast.className = 'toast hidden';
  }

  function getClient() { return client; }
  function hasClient() { return !!client; }
  function setOverlay(o) { overlay = o; }

  /* ---- theme ---- */
  function applyTheme() {
    // Dark is the default: it matches the base :root token set (no body class).
    var t = HAStore.getPref('theme', 'dark');
    document.body.className = (t === 'light') ? 'theme-light' : '';
  }
  function setTheme(t) { HAStore.setPref('theme', t); applyTheme(); }

  /* ---- navigation (back-stack) ---- */
  function renderEntry(entry) {
    if (!HAViews[entry.name]) return;
    // Persist the outgoing view's state onto the entry it belonged to, so the
    // list/menu position is restored if we navigate back to it.
    if (currentView && currentEntry && currentView.saveState) {
      try { currentEntry.state = currentView.saveState(); } catch (e) {}
    }
    if (currentView && currentView.destroy) {
      try { currentView.destroy(); } catch (e) {}
    }
    HANav.stopMarquee();
    els.view.innerHTML = '';
    clearToast();
    overlay = null;
    currentView = HAViews[entry.name](app);
    currentName = entry.name;
    currentEntry = entry;
    currentView.render(els.view, entry.params || {});
    if (entry.state && currentView.restoreState) {
      try { currentView.restoreState(entry.state); } catch (e) {}
    }
    retriggerViewAnim();
    HAStore.setPref('lastScreen', { name: entry.name, params: entry.params || {} });
  }

  // Restart the screen-entry animation by re-adding the class after a reflow.
  function retriggerViewAnim() {
    if (!els.view) return;
    els.view.className = 'view';
    void els.view.offsetWidth;
    els.view.className = 'view view-in';
  }

  function go(name, params, opts) {
    opts = opts || {};
    if (!HAViews[name]) return;
    if (opts.root) stack = [];
    var entry = { name: name, params: params || {} };
    if (opts.replace && stack.length) stack[stack.length - 1] = entry;
    else stack.push(entry);
    renderEntry(entry);
  }

  function back() {
    if (stack.length > 1) {
      stack.pop();
      renderEntry(stack[stack.length - 1]);
    }
  }

  /* ---- client lifecycle ---- */
  function startClientAndGoHome() {
    var cfg = HAConfig.load();
    if (client) { client.stop(); client = null; }
    client = new HAClient(cfg);

    client.on('status', function (info) {
      setStatusIndicator(info);
      if (currentView && currentView.onStatus) currentView.onStatus(info);
    });
    client.on('states', function () {
      if (currentView && currentView.onStates) currentView.onStates();
    });
    client.on('state_changed', function (evt) {
      if (currentView && currentView.onStateChanged) currentView.onStateChanged(evt);
    });
    client.on('registries', function () {
      if (currentView && currentView.onRegistries) currentView.onRegistries();
    });
    client.on('auth_invalid', function (msg) {
      toast(msg || 'Invalid token', 3000);
      go('setup', {}, { root: true });
    });

    client.start();
    goHomeWithRestore();
  }

  function goHomeWithRestore() {
    go('home', {}, { root: true });
    var last = HAStore.getPref('lastScreen', null);
    if (last && last.name && ROOT_SCREENS[last.name]) {
      go(last.name, last.params || {});
    }
  }

  function reconnect() {
    if (client) client.reconnect();
  }

  function signOut() {
    if (client) { client.stop(); client = null; }
    HAConfig.clear();
    go('setup', {}, { root: true });
  }

  /* ---- global key routing ---- */
  function onKey(key, ev) {
    if (overlay && overlay.onKey) return overlay.onKey(key, ev);
    if (currentView && currentView.onKey) return currentView.onKey(key, ev);
    return false;
  }

  function boot() {
    cacheEls();
    applyTheme();
    var brand = document.getElementById('header-brand');
    if (brand && global.HAIcons) brand.appendChild(HAIcons.svg('home'));
    HANav.attach(onKey);

    var cfg = HAConfig.load();
    if (HAConfig.isConfigured(cfg)) {
      startClientAndGoHome();
    } else {
      go('setup', {}, { root: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, false);
  } else {
    boot();
  }

  global.App = app;
})(window);
