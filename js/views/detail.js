/* views/detail.js - per-entity control view for light, switch, scene,
   climate; read-only display for sensors and others. ES5-safe. */
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
      title.textContent = HAFmt.friendlyName(e) || entityId; // untrusted
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
        msg.textContent = 'Entity not available.';
        container.appendChild(msg);
        app.setSoftkeys('Back', '', '');
        return;
      }

      var d = HAFmt.domainOf(entityId);
      if (d === 'light') buildLight(wrap, e);
      else if (d === 'switch' || d === 'input_boolean') buildToggle(wrap, e, d);
      else if (d === 'scene') buildScene(wrap, e);
      else if (d === 'climate') buildClimate(wrap, e);
      // sensors / binary_sensor / others -> read-only (attributes only)

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

    function addControl(desc) { controls.push(desc); }

    /* ---- light ---- */
    function buildLight(wrap, e) {
      var powerCtl = makeControl(wrap, 'Power', HAFmt.isOn(e) ? 'On' : 'Off');
      addControl({
        el: powerCtl.el,
        action: 'Toggle',
        onEnter: function () { svc('light', 'toggle', { entity_id: entityId }); },
        refresh: function (en) { powerCtl.valueEl.textContent = HAFmt.isOn(en) ? 'On' : 'Off'; }
      });

      var supportsBrightness = hasBrightness(e);
      if (supportsBrightness) {
        var brCtl = makeControl(wrap, 'Brightness', brightnessPct(e) + '%');
        addControl({
          el: brCtl.el,
          action: '-/+',
          onLeft: function () { adjustBrightness(-10); },
          onRight: function () { adjustBrightness(10); },
          refresh: function (en) { brCtl.valueEl.textContent = brightnessPct(en) + '%'; }
        });
      }
    }

    function hasBrightness(e) {
      var a = e.attributes || {};
      if (a.brightness !== undefined && a.brightness !== null) return true;
      var modes = a.supported_color_modes;
      if (modes && modes.length) {
        for (var i = 0; i < modes.length; i++) {
          if (modes[i] !== 'onoff') return true;
        }
      }
      return false;
    }

    function brightnessPct(e) {
      var b = e.attributes ? e.attributes.brightness : null;
      if (b === undefined || b === null) return HAFmt.isOn(e) ? 100 : 0;
      return Math.round((b / 255) * 100);
    }

    function adjustBrightness(delta) {
      var e = entity();
      if (!e) return;
      var pct = brightnessPct(e) + delta;
      if (pct < 0) pct = 0;
      if (pct > 100) pct = 100;
      if (pct === 0) {
        svc('light', 'turn_off', { entity_id: entityId });
      } else {
        svc('light', 'turn_on', { entity_id: entityId, brightness_pct: pct });
      }
    }

    /* ---- switch / input_boolean ---- */
    function buildToggle(wrap, e, d) {
      var ctl = makeControl(wrap, 'Power', HAFmt.isOn(e) ? 'On' : 'Off');
      addControl({
        el: ctl.el,
        action: 'Toggle',
        onEnter: function () { svc(d, 'toggle', { entity_id: entityId }); },
        refresh: function (en) { ctl.valueEl.textContent = HAFmt.isOn(en) ? 'On' : 'Off'; }
      });
    }

    /* ---- scene ---- */
    function buildScene(wrap) {
      var ctl = makeControl(wrap, 'Scene', 'Activate');
      addControl({
        el: ctl.el,
        action: 'Activate',
        onEnter: function () { svc('scene', 'turn_on', { entity_id: entityId }); },
        refresh: function () {}
      });
    }

    /* ---- climate ---- */
    function buildClimate(wrap, e) {
      var a = e.attributes || {};

      var modeCtl = makeControl(wrap, 'Mode', HAFmt.capitalize(e.state));
      addControl({
        el: modeCtl.el,
        action: '-/+',
        onLeft: function () { cycleMode(-1); },
        onRight: function () { cycleMode(1); },
        refresh: function (en) { modeCtl.valueEl.textContent = HAFmt.capitalize(en.state); }
      });

      if (a.temperature !== undefined && a.temperature !== null) {
        var tempCtl = makeControl(wrap, 'Target', a.temperature + '\u00b0');
        addControl({
          el: tempCtl.el,
          action: '-/+',
          onLeft: function () { adjustTemp(-1); },
          onRight: function () { adjustTemp(1); },
          refresh: function (en) {
            var t = en.attributes ? en.attributes.temperature : null;
            tempCtl.valueEl.textContent = (t === undefined || t === null) ? '-' : (t + '\u00b0');
          }
        });
      }

      if (a.current_temperature !== undefined && a.current_temperature !== null) {
        var curCtl = makeControl(wrap, 'Current', a.current_temperature + '\u00b0');
        curCtl.el.setAttribute('data-nofocus', '1');
        // read-only display, not added to controls list
      }
    }

    function cycleMode(dir) {
      var e = entity();
      if (!e) return;
      var modes = (e.attributes && e.attributes.hvac_modes) || [];
      if (!modes.length) return;
      var idx = modes.indexOf(e.state);
      if (idx === -1) idx = 0;
      idx = (idx + dir + modes.length) % modes.length;
      svc('climate', 'set_hvac_mode', { entity_id: entityId, hvac_mode: modes[idx] });
    }

    function adjustTemp(dir) {
      var e = entity();
      if (!e) return;
      var a = e.attributes || {};
      var step = a.target_temp_step || 0.5;
      var t = a.temperature;
      if (t === undefined || t === null) return;
      t = t + dir * step;
      if (a.min_temp !== undefined && t < a.min_temp) t = a.min_temp;
      if (a.max_temp !== undefined && t > a.max_temp) t = a.max_temp;
      t = Math.round(t * 10) / 10;
      svc('climate', 'set_temperature', { entity_id: entityId, temperature: t });
    }

    /* ---- attributes (read-only) ---- */
    function buildAttributes(wrap, e) {
      var section = document.createElement('div');
      section.className = 'section';
      section.textContent = 'Attributes';
      container.appendChild(section);

      var attrs = e.attributes || {};
      var keys = [];
      for (var k in attrs) { if (attrs.hasOwnProperty(k)) keys.push(k); }
      keys.sort();

      if (!keys.length) return;
      for (var i = 0; i < keys.length; i++) {
        var row = document.createElement('div');
        row.className = 'attr';
        var kk = document.createElement('span');
        kk.className = 'attr-key';
        kk.textContent = keys[i];
        var vv = document.createElement('span');
        vv.className = 'attr-val';
        vv.textContent = formatAttr(attrs[keys[i]]); // untrusted
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

    function updateSoftkeys() {
      var c = current();
      app.setSoftkeys('Back', c ? (c.action || '') : '', '');
    }

    function svc(domain, service, data) {
      client().callService(domain, service, data).then(function () {
        app.toast('Done', 700);
      }, function (err) {
        app.toast((err && err.message) || 'Failed', 2000);
      });
    }

    function onKey(key) {
      switch (key) {
        case 'Up': move(-1); return true;
        case 'Down': move(1); return true;
        case 'Left':
          var cl = current();
          if (cl && cl.onLeft) cl.onLeft();
          return true;
        case 'Right':
          var cr = current();
          if (cr && cr.onRight) cr.onRight();
          return true;
        case 'Enter':
          var ce = current();
          if (ce && ce.onEnter) ce.onEnter();
          return true;
        case 'SoftLeft':
        case 'Backspace':
          app.go('list');
          return true;
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
    }

    function onStates() {
      if (container) build();
    }

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
