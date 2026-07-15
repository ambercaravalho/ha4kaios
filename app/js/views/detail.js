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

      HADomains.build({
        entityId: entityId,
        entity: entity,
        makeControl: function (label, initial) { return makeControl(wrap, label, initial); },
        addControl: function (desc) { controls.push(desc); },
        svc: svc
      });

      buildAttributes(wrap, e);

      focusIndex = 0;
      applyFocus();
      updateSoftkeys();
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

    function buildAttributes(wrap, e) {
      var section = document.createElement('div');
      section.className = 'section';
      section.textContent = 'Attributes';
      container.appendChild(section);

      var attrs = e.attributes || {};
      var keys = [];
      for (var k in attrs) { if (attrs.hasOwnProperty(k)) keys.push(k); }
      keys.sort();

      for (var i = 0; i < keys.length; i++) {
        var row = document.createElement('div');
        row.className = 'attr';
        var kk = document.createElement('span');
        kk.className = 'attr-key';
        kk.textContent = keys[i];
        var vv = document.createElement('span');
        vv.className = 'attr-val';
        vv.textContent = formatAttr(attrs[keys[i]]);
        row.appendChild(kk);
        row.appendChild(vv);
        container.appendChild(row);
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
      if (cur && cur.el.scrollIntoView) cur.el.scrollIntoView(false);
    }

    function move(delta) {
      if (!controls.length) return;
      var next = focusIndex + delta;
      if (next < 0) next = 0;
      if (next > controls.length - 1) next = controls.length - 1;
      if (next === focusIndex) return;
      focusIndex = next;
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
