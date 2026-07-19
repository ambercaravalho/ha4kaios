/* views/detail.js - per-entity control screen. The shell owns the control list,
   focus/navigation, attributes, and favorite toggle; per-domain controls come
   from HADomains. ES5-safe. */
(function (global) {
  'use strict';

  global.HAViews = global.HAViews || {};

  global.HAViews.detail = function (app) {
    var container = null;
    var entityId = null;
    var controls = [];
    var focusIndex = 0;

    function client() { return app.getClient(); }
    function entity() { return client().getEntities()[entityId]; }

    function render(root, params) {
      container = root;
      entityId = params && params.entityId;
      controls = [];
      focusIndex = 0;
      build();
    }

    function build() {
      var e = entity();
      controls = [];
      container.innerHTML = '';

      var wrap = document.createElement('div');
      wrap.className = 'detail';

      var title = document.createElement('div');
      title.className = 'detail-title';
      title.textContent = HAFmt.friendlyName(e) || entityId;
      wrap.appendChild(title);

      var eid = document.createElement('div');
      eid.className = 'detail-entity';
      eid.textContent = entityId;
      wrap.appendChild(eid);

      container.appendChild(wrap);
      app.setTitle('Details');

      if (!e) {
        var msg = document.createElement('div');
        msg.className = 'message';
        msg.textContent = 'Entity unavailable.';
        container.appendChild(msg);
        app.setSoftkeys('Back', '', favLabel());
        return;
      }

      // Controls live in a titled card; read-only display controls (e.g. a
      // climate's current temperature) are appended here too.
      var controlsWrap = document.createElement('div');
      controlsWrap.className = 'control-group';

      HADomains.build({
        entityId: entityId,
        entity: entity,
        makeControl: function (label, initial) { return makeControl(controlsWrap, label, initial); },
        addControl: function (desc) { controls.push(desc); },
        svc: svc
      });

      if (controlsWrap.children && controlsWrap.children.length) {
        container.appendChild(makeSection('Controls'));
        container.appendChild(controlsWrap);
      }

      buildAttributes(container, e);

      focusIndex = 0;
      applyFocus();
      updateSoftkeys();
    }

    function makeSection(text) {
      var s = document.createElement('div');
      s.className = 'section';
      s.textContent = text;
      return s;
    }

    function makeControl(parent, label, initial) {
      var el = document.createElement('div');
      el.className = 'control';
      var l = document.createElement('span');
      l.className = 'control-label';
      l.textContent = label;
      var v = document.createElement('span');
      v.className = 'control-value';
      v.textContent = initial || '';
      el.appendChild(l);
      el.appendChild(v);
      parent.appendChild(el);
      return { el: el, valueEl: v };
    }

    // Attributes that are internal, shown elsewhere, or just noise on a small
    // screen. Hidden from the human-facing attribute list.
    var ATTR_HIDE = {
      friendly_name: 1, supported_features: 1, icon: 1, entity_picture: 1,
      assumed_state: 1, restored: 1, editable: 1, attribution: 1,
      device_class: 1, state_class: 1, id: 1
    };

    function humanizeKey(key) {
      return HAFmt.capitalize(key);
    }

    function buildAttributes(parent, e) {
      var attrs = e.attributes || {};
      var keys = [];
      for (var k in attrs) {
        if (attrs.hasOwnProperty(k) && !ATTR_HIDE[k]) keys.push(k);
      }
      keys.sort();
      if (!keys.length) return;

      parent.appendChild(makeSection('Attributes'));

      for (var i = 0; i < keys.length; i++) {
        var row = document.createElement('div');
        row.className = 'attr';
        var kk = document.createElement('span');
        kk.className = 'attr-key';
        kk.textContent = humanizeKey(keys[i]);
        var vv = document.createElement('span');
        vv.className = 'attr-val';
        vv.textContent = formatAttr(attrs[keys[i]]);
        row.appendChild(kk);
        row.appendChild(vv);
        parent.appendChild(row);
      }
    }

    function formatAttr(v) {
      if (v === null || v === undefined) return '';
      if (typeof v === 'object') {
        try { return JSON.stringify(v); } catch (e) { return String(v); }
      }
      return String(v);
    }

    /* ---- focus + input ---- */
    function applyFocus() {
      for (var i = 0; i < controls.length; i++) {
        controls[i].el.className = (i === focusIndex) ? 'control focused' : 'control';
      }
      var cur = controls[focusIndex];
      if (cur) HANav.scrollIntoViewIfNeeded(cur.el);
    }

    // Scroll the main content area (used to reach read-only content such as the
    // attributes list, and for entities that have no focusable controls).
    function scrollMain(delta) {
      var main = document.getElementById('main');
      if (main) main.scrollTop += delta;
    }

    function atPageBottom() {
      var main = document.getElementById('main');
      if (!main) return true;
      return main.scrollTop + main.clientHeight >= main.scrollHeight - 1;
    }

    // True when the page has been scrolled down past the focused control (its
    // top is above the viewport), i.e. we're reading the attributes below.
    function scrolledPast(el) {
      var main = document.getElementById('main');
      return !!(main && el && main.scrollTop > el.offsetTop);
    }

    function move(delta) {
      // No controls (e.g. a sensor): Up/Down just scroll the page.
      if (!controls.length) { scrollMain(delta * 40); return; }

      var curEl = controls[focusIndex].el;

      if (delta > 0) {
        // At the last control, keep scrolling down so attributes stay reachable
        // without yanking focus back up.
        if (focusIndex === controls.length - 1) {
          if (!atPageBottom()) scrollMain(40);
          return;
        }
        focusIndex += 1;
        applyFocus();
        updateSoftkeys();
        return;
      }

      // Up: if we scrolled below the focused control to read attributes, ease
      // back up toward it before moving the selection.
      if (!HANav.isFullyVisible(curEl) && scrolledPast(curEl)) {
        scrollMain(-40);
        return;
      }
      if (focusIndex === 0) { scrollMain(-40); return; }
      focusIndex -= 1;
      applyFocus();
      updateSoftkeys();
    }

    function current() { return controls[focusIndex] || null; }

    function actionLabel(c) {
      if (!c) return '';
      return typeof c.action === 'function' ? c.action() : (c.action || '');
    }

    function favLabel() {
      return HAStore.isFavorite(entityId) ? 'Unfav' : 'Fav';
    }

    function updateSoftkeys() {
      app.setSoftkeys('Back', actionLabel(current()), favLabel());
    }

    function svc(domain, service, data) {
      client().callService(domain, service, data).then(function () {
        app.toast('Done', 700);
      }, function (err) {
        app.toast((err && err.message) || 'Failed', 2000);
      });
    }

    function toggleFavorite() {
      var nowFav = HAStore.toggleFavorite(entityId);
      app.toast(nowFav ? 'Added to favorites' : 'Removed', 900);
      updateSoftkeys();
    }

    function onKey(key) {
      switch (key) {
        case 'Up': move(-1); return true;
        case 'Down': move(1); return true;
        case 'Left':
          var cl = current(); if (cl && cl.onLeft) cl.onLeft(); return true;
        case 'Right':
          var cr = current(); if (cr && cr.onRight) cr.onRight(); return true;
        case 'Enter':
          var ce = current(); if (ce && ce.onEnter) ce.onEnter(); return true;
        case 'SoftRight': toggleFavorite(); return true;
        case 'SoftLeft':
        case 'Backspace': app.back(); return true;
      }
      return false;
    }

    function onStateChanged(evt) {
      if (!container || evt.entityId !== entityId) return;
      var e = entity();
      if (!e) { build(); return; }
      for (var i = 0; i < controls.length; i++) {
        if (controls[i].refresh) controls[i].refresh(e);
      }
      updateSoftkeys();
    }

    function onStates() { if (container) build(); }
    function destroy() { container = null; }

    return {
      render: render,
      onKey: onKey,
      destroy: destroy,
      onStates: onStates,
      onStateChanged: onStateChanged
    };
  };
})(window);
