/* format.js - shared entity formatting, capability helpers, icons, primary
   actions, and sort comparators. Exposes HAFmt. ES5-safe. */
(function (global) {
  'use strict';

  var TOGGLE_DOMAINS = { light: 1, switch: 1, input_boolean: 1, fan: 1, siren: 1 };
  var CONTROLLABLE = {
    light: 1, switch: 1, input_boolean: 1, fan: 1, siren: 1, scene: 1, script: 1,
    button: 1, input_button: 1, cover: 1, climate: 1, media_player: 1, lock: 1,
    number: 1, input_number: 1, select: 1, input_select: 1, automation: 1, vacuum: 1
  };

  // Lower index = higher priority in smart sort.
  var DOMAIN_PRIORITY = [
    'light', 'switch', 'input_boolean', 'fan', 'cover', 'climate',
    'media_player', 'lock', 'scene', 'script', 'button', 'input_button',
    'number', 'input_number', 'select', 'input_select', 'vacuum',
    'binary_sensor', 'sensor'
  ];

  // Two-letter type badges (guaranteed to render on KaiOS fonts).
  var BADGE = {
    light: 'Li', switch: 'Sw', input_boolean: 'Sw', scene: 'Sc', script: 'Sc',
    climate: 'Cl', media_player: 'Md', cover: 'Cv', fan: 'Fn', lock: 'Lk',
    sensor: 'Sn', binary_sensor: 'Bs', button: 'Bt', input_button: 'Bt',
    number: 'Nm', input_number: 'Nm', select: 'Sl', input_select: 'Sl',
    vacuum: 'Vc', automation: 'Au', person: 'Pn', device_tracker: 'Dt'
  };

  var DOMAIN_LABEL = {
    light: 'Lights', switch: 'Switches', input_boolean: 'Switches',
    scene: 'Scenes', script: 'Scripts', climate: 'Climate',
    media_player: 'Media', cover: 'Covers', fan: 'Fans', lock: 'Locks',
    sensor: 'Sensors', binary_sensor: 'Binary Sensors', button: 'Buttons',
    input_button: 'Buttons', number: 'Numbers', input_number: 'Numbers',
    select: 'Selects', input_select: 'Selects', vacuum: 'Vacuums',
    automation: 'Automations'
  };

  // States considered "active" for coloring and status sort.
  var INACTIVE = {
    off: 1, closed: 1, idle: 1, paused: 1, standby: 1, locked: 1,
    unavailable: 1, unknown: 1, not_home: 1, docked: 1, '0': 1
  };

  function domainOf(entityId) {
    var i = entityId.indexOf('.');
    return i === -1 ? entityId : entityId.substring(0, i);
  }

  function friendlyName(entity) {
    if (entity && entity.attributes && entity.attributes.friendly_name) {
      return entity.attributes.friendly_name;
    }
    return entity ? entity.entity_id : '';
  }

  function isOn(entity) {
    return !!entity && entity.state === 'on';
  }

  function isActive(entity) {
    if (!entity) return false;
    return !INACTIVE.hasOwnProperty(entity.state);
  }

  function capitalize(s) {
    if (!s && s !== 0) return '';
    s = '' + s;
    return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
  }

  function badge(entityId) {
    return BADGE[domainOf(entityId)] || domainOf(entityId).substring(0, 2);
  }

  function domainLabel(domain) {
    return DOMAIN_LABEL[domain] || capitalize(domain);
  }

  function isControllable(entity) {
    return entity ? !!CONTROLLABLE[domainOf(entity.entity_id)] : false;
  }

  function supportsFeature(entity, bit) {
    var f = entity && entity.attributes ? entity.attributes.supported_features : 0;
    return !!(f && (f & bit));
  }

  function displayState(entity) {
    if (!entity) return '';
    var d = domainOf(entity.entity_id);
    var st = entity.state;
    var attrs = entity.attributes || {};
    if (st === 'unavailable') return 'n/a';
    if (st === 'unknown') return '?';

    if ((d === 'sensor' || d === 'number' || d === 'input_number') &&
        attrs.unit_of_measurement) {
      return st + ' ' + attrs.unit_of_measurement;
    }
    if (d === 'climate') {
      var t = attrs.temperature;
      return capitalize(st) + (t !== undefined && t !== null ? ' ' + t + '\u00b0' : '');
    }
    if (d === 'cover') {
      if (attrs.current_position !== undefined && attrs.current_position !== null &&
          st === 'open') {
        return attrs.current_position + '%';
      }
      return capitalize(st);
    }
    if (d === 'fan') {
      if (isOn(entity) && attrs.percentage !== undefined && attrs.percentage !== null) {
        return attrs.percentage + '%';
      }
      return isOn(entity) ? 'On' : 'Off';
    }
    if (d === 'media_player') {
      return capitalize(st);
    }
    if (st === 'on') return 'On';
    if (st === 'off') return 'Off';
    return capitalize(st);
  }

  // Returns the quick (Enter/center) action for an entity.
  function primaryAction(entity) {
    var d = domainOf(entity.entity_id);
    var id = entity.entity_id;
    if (TOGGLE_DOMAINS[d]) {
      return { kind: 'call', domain: d, service: 'toggle', data: { entity_id: id }, label: 'Toggle' };
    }
    if (d === 'scene' || d === 'script') {
      return { kind: 'call', domain: d, service: 'turn_on', data: { entity_id: id }, label: 'Activate' };
    }
    if (d === 'button' || d === 'input_button') {
      return { kind: 'call', domain: d, service: 'press', data: { entity_id: id }, label: 'Press' };
    }
    if (d === 'automation') {
      return { kind: 'call', domain: 'automation', service: 'trigger', data: { entity_id: id }, label: 'Run' };
    }
    if (d === 'lock') {
      var lk = entity.state === 'locked' ? 'unlock' : 'lock';
      return { kind: 'call', domain: 'lock', service: lk, data: { entity_id: id }, label: entity.state === 'locked' ? 'Unlock' : 'Lock' };
    }
    if (d === 'cover') {
      var cv = entity.state === 'open' ? 'close_cover' : 'open_cover';
      return { kind: 'call', domain: 'cover', service: cv, data: { entity_id: id }, label: entity.state === 'open' ? 'Close' : 'Open' };
    }
    return { kind: 'detail', label: 'Open' };
  }

  function priorityOf(domain) {
    var i = DOMAIN_PRIORITY.indexOf(domain);
    return i === -1 ? DOMAIN_PRIORITY.length : i;
  }

  // Build a comparator over entity ids. ctx: { entities, mode, pinFavorites }.
  function comparator(ctx) {
    var entities = ctx.entities;
    var mode = ctx.mode || 'smart';
    var favs = ctx.pinFavorites ? (HAStore.getFavorites()) : null;

    function name(id) {
      var e = entities[id];
      return (e ? friendlyName(e) : id).toLowerCase();
    }
    function favRank(id) {
      if (!favs) return 0;
      var i = favs.indexOf(id);
      return i === -1 ? 1 : 0;
    }
    function byName(a, b) {
      var na = name(a), nb = name(b);
      return na < nb ? -1 : (na > nb ? 1 : 0);
    }

    return function (a, b) {
      var ea = entities[a], eb = entities[b];
      if (!ea || !eb) return byName(a, b);

      if (favs) {
        var fr = favRank(a) - favRank(b);
        if (fr) return fr;
      }
      if (mode === 'name') return byName(a, b);

      if (mode === 'status') {
        var sa = isActive(ea) ? 0 : 1, sb = isActive(eb) ? 0 : 1;
        if (sa !== sb) return sa - sb;
        return byName(a, b);
      }

      // smart: controllable, then active, then domain priority, then name.
      var ca = isControllable(ea) ? 0 : 1, cb = isControllable(eb) ? 0 : 1;
      if (ca !== cb) return ca - cb;
      var aa = isActive(ea) ? 0 : 1, ab = isActive(eb) ? 0 : 1;
      if (aa !== ab) return aa - ab;
      var pa = priorityOf(domainOf(a)), pb = priorityOf(domainOf(b));
      if (pa !== pb) return pa - pb;
      return byName(a, b);
    };
  }

  global.HAFmt = {
    domainOf: domainOf,
    friendlyName: friendlyName,
    isOn: isOn,
    isActive: isActive,
    capitalize: capitalize,
    badge: badge,
    domainLabel: domainLabel,
    isControllable: isControllable,
    supportsFeature: supportsFeature,
    displayState: displayState,
    primaryAction: primaryAction,
    comparator: comparator,
    priorityOf: priorityOf
  };
})(window);
