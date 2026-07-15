/* views/areas.js - area picker plus the per-area entity list.
   Registers HAViews.areas and HAViews.areaEntities. ES5-safe. */
(function (global) {
  'use strict';

  global.HAViews = global.HAViews || {};

  var UNASSIGNED = '__unassigned__';

  /* ---- area picker ---- */
  global.HAViews.areas = function (app) {
    var container = null;
    var focus = null;

    function client() { return app.getClient(); }

    function render(root) {
      container = root;
      focus = new HANav.FocusList(container, 'menu-row');
      app.setTitle('Areas');
      build();
    }

    function build() {
      container.innerHTML = '';
      var c = client();

      if (!c.hasRegistries()) {
        var msg = document.createElement('div');
        msg.className = 'message';
        msg.textContent = c.authenticated
          ? 'Areas need Home Assistant registries (loading)...'
          : 'Areas are only available over WebSocket.';
        container.appendChild(msg);
        app.setSoftkeys('Back', '', '');
        return;
      }

      var areas = c.getAreas();
      for (var i = 0; i < areas.length; i++) {
        addRow(areas[i].name, String(areas[i].count), areas[i].areaId);
      }
      var un = c.getUnassignedEntities();
      if (un.length) addRow('Unassigned', String(un.length), UNASSIGNED);

      if (!areas.length && !un.length) {
        var m = document.createElement('div');
        m.className = 'message';
        m.textContent = 'No areas found.';
        container.appendChild(m);
      }

      focus.refresh(true);
      app.setSoftkeys('Back', 'Open', '');
    }

    function addRow(label, meta, areaId) {
      var row = document.createElement('div');
      row.className = 'menu-row';
      row.setAttribute('data-area', areaId);
      var l = document.createElement('span');
      l.className = 'menu-row-label';
      l.textContent = label;
      var m = document.createElement('span');
      m.className = 'menu-row-meta';
      m.textContent = meta;
      row.appendChild(l);
      row.appendChild(m);
      container.appendChild(row);
    }

    function open() {
      var el = focus.current();
      if (!el) return;
      var areaId = el.getAttribute('data-area');
      var name = el.firstChild ? el.firstChild.textContent : 'Area';
      app.go('areaEntities', { areaId: areaId, name: name });
    }

    function onKey(key) {
      switch (key) {
        case 'Up': focus.move(-1); return true;
        case 'Down': focus.move(1); return true;
        case 'Enter': open(); return true;
        case 'SoftLeft':
        case 'Backspace': app.back(); return true;
      }
      return false;
    }

    function onStates() { if (container) build(); }
    function onRegistries() { if (container) build(); }
    function destroy() { container = null; }

    return {
      render: render, onKey: onKey, destroy: destroy,
      onStates: onStates, onRegistries: onRegistries
    };
  };

  /* ---- entities within one area ---- */
  global.HAViews.areaEntities = function (app) {
    var list = null;
    var areaId = null;

    function render(root, params) {
      areaId = params && params.areaId;
      app.setTitle((params && params.name) || 'Area');
      list = HAEntityList(app, {
        getIds: function () {
          if (areaId === UNASSIGNED) return app.getClient().getUnassignedEntities();
          return app.getClient().getAreaEntities(areaId);
        },
        collapseDevices: true,
        emptyText: 'No entities in this area.',
        leftLabel: 'Back'
      });
      list.render(root);
    }

    return {
      render: render,
      onKey: function (k) { return list ? list.onKey(k) : false; },
      onStates: function () { if (list) list.onStates(); },
      onStateChanged: function (e) { if (list) list.onStateChanged(e); },
      onRegistries: function () { if (list) list.onRegistries(); },
      destroy: function () { if (list) list.destroy(); }
    };
  };
})(window);
