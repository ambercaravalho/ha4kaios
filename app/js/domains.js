/* domains.js - per-domain control builders for the entity detail screen.
   Each builder pushes control descriptors via the `api` provided by detail.js.
   Exposes HADomains. ES5-safe. */
(function (global) {
  'use strict';

  // media_player supported_features bits.
  var MP = {
    PAUSE: 1, VOLUME_SET: 4, PREV: 16, NEXT: 32, TURN_ON: 128, TURN_OFF: 256,
    VOLUME_STEP: 1024, SELECT_SOURCE: 2048, PLAY: 16384
  };
  // cover supported_features bits.
  var COVER = { OPEN: 1, CLOSE: 2, SET_POSITION: 4, STOP: 8 };
  // fan supported_features bits.
  var FAN = { SET_SPEED: 1 };

  function has(entity, bit) { return HAFmt.supportsFeature(entity, bit); }
  function attr(e, k) { return e && e.attributes ? e.attributes[k] : undefined; }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /* ---- light ---- */
  function buildLight(api) {
    var e = api.entity();
    var power = api.makeControl('Power', HAFmt.isOn(e) ? 'On' : 'Off');
    api.addControl({
      el: power.el, action: 'Toggle',
      onEnter: function () { api.svc('light', 'toggle', { entity_id: api.entityId }); },
      refresh: function (en) { power.valueEl.textContent = HAFmt.isOn(en) ? 'On' : 'Off'; }
    });

    if (lightHasBrightness(e)) {
      var br = api.makeControl('Brightness', brightnessPct(e) + '%');
      api.addControl({
        el: br.el, action: '-/+',
        onLeft: function () { adjustBrightness(api, -10); },
        onRight: function () { adjustBrightness(api, 10); },
        refresh: function (en) { br.valueEl.textContent = brightnessPct(en) + '%'; }
      });
    }
  }
  function lightHasBrightness(e) {
    var a = e.attributes || {};
    if (a.brightness !== undefined && a.brightness !== null) return true;
    var modes = a.supported_color_modes;
    if (modes && modes.length) {
      for (var i = 0; i < modes.length; i++) if (modes[i] !== 'onoff') return true;
    }
    return false;
  }
  function brightnessPct(e) {
    var b = attr(e, 'brightness');
    if (b === undefined || b === null) return HAFmt.isOn(e) ? 100 : 0;
    return Math.round((b / 255) * 100);
  }
  function adjustBrightness(api, delta) {
    var e = api.entity(); if (!e) return;
    var pct = clamp(brightnessPct(e) + delta, 0, 100);
    if (pct === 0) api.svc('light', 'turn_off', { entity_id: api.entityId });
    else api.svc('light', 'turn_on', { entity_id: api.entityId, brightness_pct: pct });
  }

  /* ---- switch / input_boolean ---- */
  function buildToggle(api, d) {
    var e = api.entity();
    var ctl = api.makeControl('Power', HAFmt.isOn(e) ? 'On' : 'Off');
    api.addControl({
      el: ctl.el, action: 'Toggle',
      onEnter: function () { api.svc(d, 'toggle', { entity_id: api.entityId }); },
      refresh: function (en) { ctl.valueEl.textContent = HAFmt.isOn(en) ? 'On' : 'Off'; }
    });
  }

  /* ---- scene / script ---- */
  function buildActivate(api, d, label) {
    var ctl = api.makeControl(label, 'Go');
    api.addControl({
      el: ctl.el, action: label,
      onEnter: function () { api.svc(d, 'turn_on', { entity_id: api.entityId }); },
      refresh: function () {}
    });
  }

  /* ---- button ---- */
  function buildButton(api, d) {
    var ctl = api.makeControl('Press', 'Go');
    api.addControl({
      el: ctl.el, action: 'Press',
      onEnter: function () { api.svc(d, 'press', { entity_id: api.entityId }); },
      refresh: function () {}
    });
  }

  /* ---- lock ---- */
  function buildLock(api) {
    var e = api.entity();
    var ctl = api.makeControl('Lock', HAFmt.capitalize(e.state));
    api.addControl({
      el: ctl.el,
      action: function () { return api.entity().state === 'locked' ? 'Unlock' : 'Lock'; },
      onEnter: function () {
        var locked = api.entity().state === 'locked';
        api.svc('lock', locked ? 'unlock' : 'lock', { entity_id: api.entityId });
      },
      refresh: function (en) { ctl.valueEl.textContent = HAFmt.capitalize(en.state); }
    });
  }

  /* ---- cover ---- */
  function buildCover(api) {
    var e = api.entity();
    var openCtl = api.makeControl('Open / Close', HAFmt.capitalize(e.state));
    api.addControl({
      el: openCtl.el, action: '-/+',
      onLeft: function () { api.svc('cover', 'close_cover', { entity_id: api.entityId }); },
      onRight: function () { api.svc('cover', 'open_cover', { entity_id: api.entityId }); },
      refresh: function (en) { openCtl.valueEl.textContent = HAFmt.capitalize(en.state); }
    });

    if (has(e, COVER.STOP)) {
      var stop = api.makeControl('Stop', 'Go');
      api.addControl({
        el: stop.el, action: 'Stop',
        onEnter: function () { api.svc('cover', 'stop_cover', { entity_id: api.entityId }); },
        refresh: function () {}
      });
    }
    if (has(e, COVER.SET_POSITION)) {
      var pos = api.makeControl('Position', posText(e));
      api.addControl({
        el: pos.el, action: '-/+',
        onLeft: function () { adjustPosition(api, -10); },
        onRight: function () { adjustPosition(api, 10); },
        refresh: function (en) { pos.valueEl.textContent = posText(en); }
      });
    }
  }
  function posText(e) {
    var p = attr(e, 'current_position');
    return (p === undefined || p === null) ? '-' : (p + '%');
  }
  function adjustPosition(api, delta) {
    var e = api.entity(); if (!e) return;
    var p = attr(e, 'current_position');
    if (p === undefined || p === null) p = 0;
    p = clamp(p + delta, 0, 100);
    api.svc('cover', 'set_cover_position', { entity_id: api.entityId, position: p });
  }

  /* ---- fan ---- */
  function buildFan(api) {
    var e = api.entity();
    var power = api.makeControl('Power', HAFmt.isOn(e) ? 'On' : 'Off');
    api.addControl({
      el: power.el, action: 'Toggle',
      onEnter: function () { api.svc('fan', 'toggle', { entity_id: api.entityId }); },
      refresh: function (en) { power.valueEl.textContent = HAFmt.isOn(en) ? 'On' : 'Off'; }
    });
    if (has(e, FAN.SET_SPEED) || attr(e, 'percentage') !== undefined) {
      var spd = api.makeControl('Speed', speedText(e));
      api.addControl({
        el: spd.el, action: '-/+',
        onLeft: function () { adjustSpeed(api, -10); },
        onRight: function () { adjustSpeed(api, 10); },
        refresh: function (en) { spd.valueEl.textContent = speedText(en); }
      });
    }
  }
  function speedText(e) {
    var p = attr(e, 'percentage');
    return (p === undefined || p === null) ? '-' : (p + '%');
  }
  function adjustSpeed(api, delta) {
    var e = api.entity(); if (!e) return;
    var p = attr(e, 'percentage');
    if (p === undefined || p === null) p = 0;
    p = clamp(p + delta, 0, 100);
    api.svc('fan', 'set_percentage', { entity_id: api.entityId, percentage: p });
  }

  /* ---- climate ---- */
  function buildClimate(api) {
    var e = api.entity();
    var modeCtl = api.makeControl('Mode', HAFmt.capitalize(e.state));
    api.addControl({
      el: modeCtl.el, action: '-/+',
      onLeft: function () { cycleMode(api, -1); },
      onRight: function () { cycleMode(api, 1); },
      refresh: function (en) { modeCtl.valueEl.textContent = HAFmt.capitalize(en.state); }
    });

    if (attr(e, 'temperature') !== undefined && attr(e, 'temperature') !== null) {
      var tempCtl = api.makeControl('Target', attr(e, 'temperature') + '\u00b0');
      api.addControl({
        el: tempCtl.el, action: '-/+',
        onLeft: function () { adjustTemp(api, -1); },
        onRight: function () { adjustTemp(api, 1); },
        refresh: function (en) {
          var t = attr(en, 'temperature');
          tempCtl.valueEl.textContent = (t === undefined || t === null) ? '-' : (t + '\u00b0');
        }
      });
    }
    if (attr(e, 'current_temperature') !== undefined && attr(e, 'current_temperature') !== null) {
      var cur = api.makeControl('Current', attr(e, 'current_temperature') + '\u00b0');
      cur.el.setAttribute('data-nofocus', '1'); // read-only display
    }
  }
  function cycleMode(api, dir) {
    var e = api.entity(); if (!e) return;
    var modes = attr(e, 'hvac_modes') || [];
    if (!modes.length) return;
    var idx = modes.indexOf(e.state);
    if (idx === -1) idx = 0;
    idx = (idx + dir + modes.length) % modes.length;
    api.svc('climate', 'set_hvac_mode', { entity_id: api.entityId, hvac_mode: modes[idx] });
  }
  function adjustTemp(api, dir) {
    var e = api.entity(); if (!e) return;
    var step = attr(e, 'target_temp_step') || 0.5;
    var t = attr(e, 'temperature');
    if (t === undefined || t === null) return;
    t = t + dir * step;
    var mn = attr(e, 'min_temp'), mx = attr(e, 'max_temp');
    if (mn !== undefined && t < mn) t = mn;
    if (mx !== undefined && t > mx) t = mx;
    t = Math.round(t * 10) / 10;
    api.svc('climate', 'set_temperature', { entity_id: api.entityId, temperature: t });
  }

  /* ---- media_player ---- */
  function buildMedia(api) {
    var e = api.entity();
    var state = api.makeControl('Playback', HAFmt.capitalize(e.state));
    api.addControl({
      el: state.el, action: 'Play/Pause',
      onEnter: function () { api.svc('media_player', 'media_play_pause', { entity_id: api.entityId }); },
      refresh: function (en) { state.valueEl.textContent = HAFmt.capitalize(en.state); }
    });

    if (has(e, MP.VOLUME_SET) || has(e, MP.VOLUME_STEP)) {
      var vol = api.makeControl('Volume', volText(e));
      api.addControl({
        el: vol.el, action: '-/+',
        onLeft: function () { api.svc('media_player', 'volume_down', { entity_id: api.entityId }); },
        onRight: function () { api.svc('media_player', 'volume_up', { entity_id: api.entityId }); },
        refresh: function (en) { vol.valueEl.textContent = volText(en); }
      });
    }
    if (has(e, MP.PREV) || has(e, MP.NEXT)) {
      var track = api.makeControl('Track', 'Prev / Next');
      api.addControl({
        el: track.el, action: '-/+',
        onLeft: function () { api.svc('media_player', 'media_previous_track', { entity_id: api.entityId }); },
        onRight: function () { api.svc('media_player', 'media_next_track', { entity_id: api.entityId }); },
        refresh: function () {}
      });
    }
    if (has(e, MP.SELECT_SOURCE)) {
      var src = api.makeControl('Source', srcText(e));
      api.addControl({
        el: src.el, action: '-/+',
        onLeft: function () { cycleSource(api, -1); },
        onRight: function () { cycleSource(api, 1); },
        refresh: function (en) { src.valueEl.textContent = srcText(en); }
      });
    }
  }
  function volText(e) {
    var v = attr(e, 'volume_level');
    return (v === undefined || v === null) ? '-' : (Math.round(v * 100) + '%');
  }
  function srcText(e) {
    var s = attr(e, 'source');
    return s ? ('' + s) : '-';
  }
  function cycleSource(api, dir) {
    var e = api.entity(); if (!e) return;
    var list = attr(e, 'source_list') || [];
    if (!list.length) return;
    var cur = attr(e, 'source');
    var idx = list.indexOf(cur);
    if (idx === -1) idx = 0;
    idx = (idx + dir + list.length) % list.length;
    api.svc('media_player', 'select_source', { entity_id: api.entityId, source: list[idx] });
  }

  /* ---- number / input_number ---- */
  function buildNumber(api, d) {
    var e = api.entity();
    var ctl = api.makeControl('Value', numText(e));
    api.addControl({
      el: ctl.el, action: '-/+',
      onLeft: function () { adjustNumber(api, d, -1); },
      onRight: function () { adjustNumber(api, d, 1); },
      refresh: function (en) { ctl.valueEl.textContent = numText(en); }
    });
  }
  function numText(e) {
    var v = e.state;
    var u = attr(e, 'unit_of_measurement');
    return u ? (v + ' ' + u) : ('' + v);
  }
  function adjustNumber(api, d, dir) {
    var e = api.entity(); if (!e) return;
    var step = attr(e, 'step') || 1;
    var v = parseFloat(e.state);
    if (isNaN(v)) v = 0;
    v = v + dir * step;
    var mn = attr(e, 'min'), mx = attr(e, 'max');
    if (mn !== undefined && v < mn) v = mn;
    if (mx !== undefined && v > mx) v = mx;
    v = Math.round(v * 1000) / 1000;
    api.svc(d, 'set_value', { entity_id: api.entityId, value: v });
  }

  /* ---- select / input_select ---- */
  function buildSelect(api, d) {
    var e = api.entity();
    var ctl = api.makeControl('Option', HAFmt.capitalize(e.state));
    api.addControl({
      el: ctl.el, action: '-/+',
      onLeft: function () { cycleOption(api, d, -1); },
      onRight: function () { cycleOption(api, d, 1); },
      refresh: function (en) { ctl.valueEl.textContent = HAFmt.capitalize(en.state); }
    });
  }
  function cycleOption(api, d, dir) {
    var e = api.entity(); if (!e) return;
    var opts = attr(e, 'options') || [];
    if (!opts.length) return;
    var idx = opts.indexOf(e.state);
    if (idx === -1) idx = 0;
    idx = (idx + dir + opts.length) % opts.length;
    api.svc(d, 'select_option', { entity_id: api.entityId, option: opts[idx] });
  }

  /* ---- dispatch ---- */
  function build(api) {
    var d = HAFmt.domainOf(api.entityId);
    switch (d) {
      case 'light': buildLight(api); break;
      case 'switch': case 'input_boolean': case 'siren': buildToggle(api, d); break;
      case 'scene': buildActivate(api, 'scene', 'Activate'); break;
      case 'script': buildActivate(api, 'script', 'Run'); break;
      case 'button': case 'input_button': buildButton(api, d); break;
      case 'lock': buildLock(api); break;
      case 'cover': buildCover(api); break;
      case 'fan': buildFan(api); break;
      case 'climate': buildClimate(api); break;
      case 'media_player': buildMedia(api); break;
      case 'number': case 'input_number': buildNumber(api, d); break;
      case 'select': case 'input_select': buildSelect(api, d); break;
      default: break; // read-only (attributes only)
    }
  }

  global.HADomains = { build: build };
})(window);
