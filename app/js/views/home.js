/* views/home.js - top-level hub: connection card + menu (Favorites, Areas,
   All devices, Settings). ES5-safe. */
(function (global) {
  'use strict';

  global.HAViews = global.HAViews || {};

  global.HAViews.home = function (app) {
    var container = null;
    var focus = null;

    function client() { return app.getClient(); }

    function render(root) {
      container = root;
      focus = new HANav.FocusList(container, 'menu-row');
      app.setTitle('HA4KaiOS');
      build();
    }

    function build() {
      container.innerHTML = '';

      var card = document.createElement('div');
      card.className = 'homecard';
      var l1 = document.createElement('div');
      l1.className = 'homecard-line';
      l1.textContent = statusText();
      var l2 = document.createElement('div');
      l2.className = 'homecard-sub';
      l2.textContent = updatedText();
      card.appendChild(l1);
      card.appendChild(l2);
      container.appendChild(card);

      addRow('Favorites', String(HAStore.getFavorites().length), 'favorites');
      addRow('Areas', areaCount(), 'areas');
      addRow('All devices', String(entityCount()), 'all');
      addRow('Settings', '', 'settings');

      focus.refresh(true);
      updateSoftkeys();
    }

    function addRow(label, meta, target) {
      var row = document.createElement('div');
      row.className = 'menu-row';
      row.setAttribute('data-target', target);
      var badge = document.createElement('span');
      badge.className = 'menu-row-badge';
      badge.textContent = label.charAt(0);
      var l = document.createElement('span');
      l.className = 'menu-row-label';
      l.textContent = label;
      var m = document.createElement('span');
      m.className = 'menu-row-meta';
      m.textContent = meta;
      row.appendChild(badge);
      row.appendChild(l);
      row.appendChild(m);
      container.appendChild(row);
    }

    function statusText() {
      var c = client();
      if (!c) return 'Not connected';
      if (c.authenticated) return 'Connected';
      if (c.usingRest) return 'Connected (REST)';
      if (c.status === 'connecting') return 'Connecting...';
      return 'Offline';
    }

    function updatedText() {
      var c = client();
      var n = c ? entityCount() : 0;
      var ts = c ? c.getLastUpdate() : 0;
      if (!ts) return n + ' entities';
      return n + ' entities \u00b7 updated ' + timeOf(ts);
    }

    function timeOf(ts) {
      var d = new Date(ts);
      var h = d.getHours(), m = d.getMinutes();
      return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
    }

    function entityCount() {
      var e = client() ? client().getEntities() : {};
      var n = 0;
      for (var k in e) { if (e.hasOwnProperty(k)) n++; }
      return n;
    }

    function areaCount() {
      var c = client();
      if (!c || !c.hasRegistries()) return '-';
      return String(c.getAreas().length);
    }

    function updateSoftkeys() {
      var c = client();
      var offline = c && !c.authenticated && !c.usingRest;
      app.setSoftkeys(offline ? 'Reconnect' : '', 'Open', '');
    }

    function open() {
      var el = focus.current();
      if (!el) return;
      var t = el.getAttribute('data-target');
      if (t) app.go(t);
    }

    function onKey(key) {
      switch (key) {
        case 'Up': focus.move(-1); return true;
        case 'Down': focus.move(1); return true;
        case 'Enter': open(); return true;
        case 'SoftLeft':
          if (client() && !client().authenticated) app.reconnect();
          return true;
        case 'Backspace': return true; // root: swallow to avoid accidental exit
      }
      return false;
    }

    function onStates() { if (container) build(); }
    function onRegistries() { if (container) build(); }
    function onStatus() { if (container) build(); }
    function destroy() { container = null; }

    return {
      render: render,
      onKey: onKey,
      destroy: destroy,
      onStates: onStates,
      onRegistries: onRegistries,
      onStatus: onStatus
    };
  };
})(window);
