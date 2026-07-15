/* views/list.js - live entity list grouped by domain.
   Exposes shared HAFmt helpers used by the detail view too. ES5-safe. */
(function (global) {
  'use strict';

  global.HAViews = global.HAViews || {};

  /* ---- shared formatting helpers ---- */
  var GROUPS = [
    { domains: ['light'], label: 'Lights' },
    { domains: ['switch', 'input_boolean'], label: 'Switches' },
    { domains: ['scene'], label: 'Scenes' },
    { domains: ['climate'], label: 'Climate' },
    { domains: ['binary_sensor'], label: 'Binary Sensors' },
    { domains: ['sensor'], label: 'Sensors' }
  ];
  var SUPPORTED = { light: 1, switch: 1, input_boolean: 1, scene: 1, climate: 1, sensor: 1, binary_sensor: 1 };

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

  function capitalize(s) {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function displayState(entity) {
    if (!entity) return '';
    var d = domainOf(entity.entity_id);
    var st = entity.state;
    var attrs = entity.attributes || {};
    if (st === 'unavailable') return 'n/a';
    if (st === 'unknown') return '?';
    if (d === 'sensor' && attrs.unit_of_measurement) {
      return st + ' ' + attrs.unit_of_measurement;
    }
    if (d === 'climate') {
      var t = attrs.temperature;
      return capitalize(st) + (t !== undefined && t !== null ? ' ' + t + '\u00b0' : '');
    }
    if (st === 'on') return 'On';
    if (st === 'off') return 'Off';
    return capitalize(st);
  }

  global.HAFmt = {
    domainOf: domainOf,
    friendlyName: friendlyName,
    isOn: isOn,
    displayState: displayState,
    capitalize: capitalize,
    SUPPORTED: SUPPORTED
  };

  /* ---- list view ---- */
  global.HAViews.list = function (app) {
    var container = null;
    var focus = null;
    var rowMap = {}; // entity_id -> {row, name, value}
    var order = [];  // entity_ids in display order
    var rebuildQueued = false;

    function render(root) {
      container = root;
      focus = new HANav.FocusList(container, 'row');
      app.setTitle('Home Assistant');
      build();
    }

    function sortedEntities() {
      var entities = app.getClient().getEntities();
      var buckets = {};
      var others = [];
      var seen;
      var id, d, i, g;

      var idsByGroup = [];
      for (i = 0; i < GROUPS.length; i++) idsByGroup.push([]);

      for (id in entities) {
        if (!entities.hasOwnProperty(id)) continue;
        d = domainOf(id);
        var placed = false;
        for (i = 0; i < GROUPS.length; i++) {
          if (GROUPS[i].domains.indexOf(d) !== -1) {
            idsByGroup[i].push(id);
            placed = true;
            break;
          }
        }
        if (!placed) others.push(id);
      }

      function byName(a, b) {
        var na = friendlyName(entities[a]).toLowerCase();
        var nb = friendlyName(entities[b]).toLowerCase();
        return na < nb ? -1 : (na > nb ? 1 : 0);
      }

      var result = [];
      for (i = 0; i < GROUPS.length; i++) {
        if (!idsByGroup[i].length) continue;
        idsByGroup[i].sort(byName);
        result.push({ header: GROUPS[i].label, ids: idsByGroup[i] });
      }
      if (others.length) {
        others.sort(byName);
        result.push({ header: 'Other', ids: others });
      }
      return result;
    }

    function build() {
      var entities = app.getClient().getEntities();
      var groups = sortedEntities();
      rowMap = {};
      order = [];
      container.innerHTML = '';

      if (!groups.length) {
        var msg = document.createElement('div');
        msg.className = 'message';
        msg.textContent = app.getClient().authenticated
          ? 'No entities found.'
          : 'Connecting to Home Assistant...';
        container.appendChild(msg);
        app.setSoftkeys('Setup', '', 'Reload');
        return;
      }

      for (var gi = 0; gi < groups.length; gi++) {
        var section = document.createElement('div');
        section.className = 'section';
        section.textContent = groups[gi].header;
        container.appendChild(section);

        for (var i = 0; i < groups[gi].ids.length; i++) {
          var id = groups[gi].ids[i];
          var rowEl = buildRow(id, entities[id]);
          container.appendChild(rowEl);
          order.push(id);
        }
      }

      focus.refresh(true);
      updateSoftkeys();
    }

    function buildRow(entityId, entity) {
      var row = document.createElement('div');
      row.className = 'row';
      row.setAttribute('data-entity', entityId);

      var main = document.createElement('div');
      main.className = 'row-main';

      var name = document.createElement('span');
      name.className = 'row-name';
      name.textContent = friendlyName(entity); // untrusted -> textContent

      var sub = document.createElement('span');
      sub.className = 'row-sub';
      sub.textContent = entityId;

      main.appendChild(name);
      main.appendChild(sub);

      var value = document.createElement('span');
      value.className = 'row-value' + (isOn(entity) ? ' state-on' : '');
      value.textContent = displayState(entity);

      row.appendChild(main);
      row.appendChild(value);

      rowMap[entityId] = { row: row, name: name, value: value };
      return row;
    }

    function updateRow(entityId) {
      var entities = app.getClient().getEntities();
      var entity = entities[entityId];
      var ref = rowMap[entityId];
      if (!ref) { queueRebuild(); return; }
      if (!entity) { queueRebuild(); return; }
      ref.name.textContent = friendlyName(entity);
      ref.value.textContent = displayState(entity);
      ref.value.className = 'row-value' + (isOn(entity) ? ' state-on' : '');
    }

    function queueRebuild() {
      if (rebuildQueued) return;
      rebuildQueued = true;
      setTimeout(function () {
        rebuildQueued = false;
        if (container) build();
      }, 250);
    }

    function focusedEntity() {
      var el = focus.current();
      if (!el) return null;
      var id = el.getAttribute('data-entity');
      if (!id) return null;
      return { id: id, entity: app.getClient().getEntities()[id] };
    }

    function primaryLabel(entityId) {
      var d = domainOf(entityId);
      if (d === 'light' || d === 'switch' || d === 'input_boolean') return 'Toggle';
      if (d === 'scene') return 'Activate';
      return 'Open';
    }

    function updateSoftkeys() {
      var f = focusedEntity();
      var center = f ? primaryLabel(f.id) : '';
      app.setSoftkeys('Setup', center, 'Details');
    }

    function doPrimary() {
      var f = focusedEntity();
      if (!f) return;
      var d = domainOf(f.id);
      if (d === 'light' || d === 'switch' || d === 'input_boolean') {
        callService(d, 'toggle', { entity_id: f.id });
      } else if (d === 'scene') {
        callService('scene', 'turn_on', { entity_id: f.id });
      } else {
        app.go('detail', { entityId: f.id });
      }
    }

    function callService(domain, service, data) {
      app.getClient().callService(domain, service, data).then(function () {
        app.toast('Done', 800);
      }, function (err) {
        app.toast((err && err.message) || 'Failed', 2000);
      });
    }

    function onKey(key) {
      switch (key) {
        case 'Up': focus.move(-1); updateSoftkeys(); return true;
        case 'Down': focus.move(1); updateSoftkeys(); return true;
        case 'Enter': doPrimary(); return true;
        case 'SoftLeft': app.go('setup'); return true;
        case 'SoftRight':
          var f = focusedEntity();
          if (f) app.go('detail', { entityId: f.id });
          return true;
        case 'Backspace':
          return true; // stay on home; swallow to avoid app exit surprises
      }
      return false;
    }

    /* live-data hooks called by app.js */
    function onStates() {
      if (container) build();
    }

    function onStateChanged(evt) {
      if (!container) return;
      if (rowMap[evt.entityId]) {
        updateRow(evt.entityId);
      } else {
        queueRebuild();
      }
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
