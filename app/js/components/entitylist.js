/* components/entitylist.js - reusable live entity list with focus navigation,
   smart sorting/filtering, optional search + grouping, optional device
   collapsing, direct Details on the right softkey, number-key jumps, and an
   optional reorder mode (right softkey on reorderable lists). Exposes
   HAEntityList. ES5-safe.

   Items are either { kind:'entity', id } or, when collapseDevices is on and a
   device has >= 2 visible entities, { kind:'device', deviceId, ids, primaryId }.
   Collapsing is suppressed while searching or reordering. */
(function (global) {
  'use strict';

  function HAEntityList(app, opts) {
    opts = opts || {};
    var container = null;
    var rowsEl = null;
    var searchInput = null;
    var focus = null;

    var rowMap = {};       // entity_id -> { row, name, sub, value, badge } (entity rows)
    var coveredIds = {};   // member entity_id -> deviceId (collapsed into a device row)
    var flatItems = [];    // items in display order (entity/device)
    var searchText = '';
    var searchFocused = false;
    var reorderMode = false;
    var rebuildQueued = false;

    function client() { return app.getClient(); }
    function entities() { return client().getEntities(); }

    /* ---------- data ---------- */
    function computeSections() {
      var ids = (opts.getIds ? opts.getIds() : []) || [];
      var ents = entities();
      var showDiag = HAStore.getPref('showDiagnostics', false);

      if (opts.ordered) {
        ids = applySearch(ids, ents);
        return [{ header: null, ids: ids }];
      }

      // Filter hidden / diagnostic (only meaningful when registries are loaded).
      var filtered = [];
      for (var i = 0; i < ids.length; i++) {
        var meta = client().getEntityMeta(ids[i]);
        if (meta) {
          if (meta.hidden) continue;
          if (meta.category !== null && meta.category !== undefined && !showDiag) continue;
        }
        filtered.push(ids[i]);
      }
      filtered = applySearch(filtered, ents);

      var cmp = HAFmt.comparator({
        entities: ents,
        mode: HAStore.getPref('sortMode', 'smart'),
        pinFavorites: !!opts.pinFavorites
      });
      filtered.sort(cmp);

      var group = opts.group || 'none';
      if (typeof group === 'function') group = group();
      if (group === 'domain') return groupBy(filtered, function (id) {
        return HAFmt.domainLabel(HAFmt.domainOf(id));
      });
      if (group === 'area') return groupBy(filtered, function (id) {
        var aid = client().getEntityArea(id);
        return aid ? client().getAreaName(aid) : 'No area';
      });
      if (group === 'kind') return groupByKind(filtered);
      return [{ header: null, ids: filtered }];
    }

    function applySearch(ids, ents) {
      if (!searchText) return ids;
      var q = searchText.toLowerCase();
      var res = [];
      for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        var e = ents[id];
        var name = (e ? HAFmt.friendlyName(e) : id).toLowerCase();
        if (name.indexOf(q) !== -1 || id.toLowerCase().indexOf(q) !== -1) res.push(id);
      }
      return res;
    }

    function groupBy(ids, keyFn) {
      var map = {};
      var order = [];
      for (var i = 0; i < ids.length; i++) {
        var k = keyFn(ids[i]);
        if (!map[k]) { map[k] = []; order.push(k); }
        map[k].push(ids[i]);
      }
      order.sort();
      var out = [];
      for (var j = 0; j < order.length; j++) {
        out.push({ header: order[j], ids: map[order[j]] });
      }
      return out;
    }

    // Fixed-order buckets: Scenes, Automations, then everything else. Preserves
    // the already-applied sort within each bucket; empty buckets are dropped.
    function groupByKind(ids) {
      var scenes = [], autos = [], rest = [];
      for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        if (id.indexOf('scene.') === 0) scenes.push(id);
        else if (id.indexOf('automation.') === 0) autos.push(id);
        else rest.push(id);
      }
      var out = [];
      if (scenes.length) out.push({ header: 'Scenes', ids: scenes });
      if (autos.length) out.push({ header: 'Automations', ids: autos });
      if (rest.length) out.push({ header: 'Entities', ids: rest });
      return out;
    }

    // Collapse device members within an already-sorted id list into items.
    function computeItems(ids) {
      var collapse = opts.collapseDevices && !searchText && !reorderMode &&
                     client().hasRegistries();
      var items = [];
      var i;
      if (!collapse) {
        for (i = 0; i < ids.length; i++) items.push({ kind: 'entity', id: ids[i] });
        return items;
      }
      var groups = {};
      for (i = 0; i < ids.length; i++) {
        var dev = client().getEntityDevice(ids[i]);
        if (dev) {
          if (!groups[dev]) groups[dev] = [];
          groups[dev].push(ids[i]);
        }
      }
      var emitted = {};
      for (i = 0; i < ids.length; i++) {
        var id = ids[i];
        var d = client().getEntityDevice(id);
        if (d && groups[d].length >= 2) {
          if (!emitted[d]) {
            emitted[d] = true;
            items.push({ kind: 'device', deviceId: d, ids: groups[d].slice(), primaryId: groups[d][0] });
          }
          continue;
        }
        items.push({ kind: 'entity', id: id });
      }
      return items;
    }

    /* ---------- rendering ---------- */
    function render(root) {
      container = root;
      container.innerHTML = '';

      if (opts.search) {
        var wrap = document.createElement('div');
        wrap.className = 'searchwrap';
        searchInput = document.createElement('input');
        searchInput.className = 'search';
        searchInput.setAttribute('type', 'text');
        searchInput.setAttribute('placeholder', 'Search');
        searchInput.addEventListener('input', function () {
          searchText = searchInput.value || '';
          renderRows();
        }, false);
        wrap.appendChild(searchInput);
        container.appendChild(wrap);
      }

      rowsEl = document.createElement('div');
      rowsEl.className = 'rows';
      container.appendChild(rowsEl);

      focus = new HANav.FocusList(rowsEl, 'row');
      renderRows();
    }

    function renderRows() {
      var sections = computeSections();
      rowMap = {};
      coveredIds = {};
      flatItems = [];
      rowsEl.innerHTML = '';

      var built = [];
      var total = 0;
      for (var s = 0; s < sections.length; s++) {
        var its = computeItems(sections[s].ids);
        built.push({ header: sections[s].header, items: its });
        total += its.length;
      }

      if (!total) {
        var msg = document.createElement('div');
        msg.className = 'message';
        if (searchText) msg.textContent = 'No matches.';
        else if (!client().authenticated && !client().usingRest) msg.textContent = 'Connecting...';
        else msg.textContent = opts.emptyText || 'Nothing here yet.';
        rowsEl.appendChild(msg);
        updateSoftkeys();
        return;
      }

      for (var i = 0; i < built.length; i++) {
        if (built[i].header) {
          var sec = document.createElement('div');
          sec.className = 'section';
          sec.textContent = built[i].header;
          rowsEl.appendChild(sec);
        }
        for (var j = 0; j < built[i].items.length; j++) {
          var item = built[i].items[j];
          rowsEl.appendChild(buildRow(item));
          flatItems.push(item);
          if (item.kind === 'device') {
            for (var k = 0; k < item.ids.length; k++) coveredIds[item.ids[k]] = item.deviceId;
          }
        }
      }

      focus.refresh(true);
      updateSoftkeys();
    }

    function buildRow(item) {
      return item.kind === 'device' ? buildDeviceRow(item) : buildEntityRow(item.id);
    }

    function buildEntityRow(id) {
      var ents = entities();
      var e = ents[id];

      var row = document.createElement('div');
      row.className = 'row';
      row.setAttribute('data-entity', id);

      var badge = document.createElement('span');
      badge.className = 'row-badge';
      badge.appendChild(HAIcons.forEntity(id));

      var main = document.createElement('div');
      main.className = 'row-main';
      var name = document.createElement('span');
      name.className = 'row-name marquee';
      name.textContent = e ? HAFmt.friendlyName(e) : id;
      var sub = document.createElement('span');
      sub.className = 'row-sub';
      sub.textContent = subtitle(id, e);
      main.appendChild(name);
      main.appendChild(sub);

      var value = document.createElement('span');
      value.className = 'row-value' + (HAFmt.isActive(e) ? ' state-on' : '');
      value.textContent = e ? HAFmt.displayState(e) : 'n/a';

      row.appendChild(badge);
      row.appendChild(main);
      row.appendChild(value);

      rowMap[id] = { row: row, name: name, sub: sub, value: value, badge: badge };
      return row;
    }

    function buildDeviceRow(item) {
      var row = document.createElement('div');
      row.className = 'row';
      row.setAttribute('data-device', item.deviceId);

      var badge = document.createElement('span');
      badge.className = 'row-badge';
      badge.appendChild(HAIcons.forDevice());

      var main = document.createElement('div');
      main.className = 'row-main';
      var name = document.createElement('span');
      name.className = 'row-name marquee';
      name.textContent = deviceLabel(item);
      var sub = document.createElement('span');
      sub.className = 'row-sub';
      sub.textContent = item.ids.length + ' entities';
      main.appendChild(name);
      main.appendChild(sub);

      var chev = document.createElement('span');
      chev.className = 'row-chevron';
      chev.textContent = '\u203A'; // ›

      row.appendChild(badge);
      row.appendChild(main);
      row.appendChild(chev);
      return row;
    }

    function deviceLabel(item) {
      var n = client().getDeviceName(item.deviceId);
      if (n) return n;
      var e = entities()[item.primaryId];
      return e ? HAFmt.friendlyName(e) : item.deviceId;
    }

    function subtitle(id, e) {
      if (opts.showArea) {
        var aid = client().getEntityArea(id);
        if (aid) return client().getAreaName(aid);
      }
      return id;
    }

    function updateRow(id) {
      var ref = rowMap[id];
      if (!ref) { queueRebuild(); return; }
      var e = entities()[id];
      if (!e) { queueRebuild(); return; }
      ref.name.textContent = HAFmt.friendlyName(e);
      ref.sub.textContent = subtitle(id, e);
      ref.value.textContent = HAFmt.displayState(e);
      ref.value.className = 'row-value' + (HAFmt.isActive(e) ? ' state-on' : '');
    }

    function queueRebuild() {
      if (rebuildQueued) return;
      rebuildQueued = true;
      setTimeout(function () {
        rebuildQueued = false;
        if (rowsEl) renderRows();
      }, 300);
    }

    /* ---------- focus + actions ---------- */
    function focusedItem() { return flatItems[focus.index]; }

    function primaryLabel() {
      var it = focusedItem();
      if (!it) return '';
      if (it.kind === 'device') return 'Open';
      var e = entities()[it.id];
      return e ? HAFmt.primaryAction(e).label : '';
    }

    function updateSoftkeys() {
      if (!rowsEl) return; // view was destroyed (e.g. after navigation)
      if (searchFocused) { app.setSoftkeys('List', '', 'Clear'); return; }
      if (reorderMode) { app.setSoftkeys('Done', 'Move', ''); return; }
      var left = opts.leftLabel || 'Back';
      var center = flatItems.length ? primaryLabel() : '';
      var right = '';
      if (flatItems.length) {
        if (opts.reorderable) right = 'Reorder';
        else {
          var it = focusedItem();
          // Device rows have no single Details screen: no right action.
          right = (it && it.kind === 'device') ? '' : 'Details';
        }
      }
      app.setSoftkeys(left, center, right);
    }

    function doPrimary() {
      var it = focusedItem();
      if (!it) return;
      if (it.kind === 'device') { openDevice(it); return; }
      var e = entities()[it.id];
      if (!e) { openDetail(it.id); return; }
      var act = HAFmt.primaryAction(e);
      if (act.kind === 'detail') { openDetail(it.id); return; }
      callService(act.domain, act.service, act.data);
    }

    function openDetail(id) {
      app.go('detail', { entityId: id });
    }

    function openDevice(item) {
      app.go('deviceEntities', { deviceId: item.deviceId, name: deviceLabel(item) });
    }

    function callService(domain, service, data) {
      client().callService(domain, service, data).then(function () {
        app.toast('Done', 700);
      }, function (err) {
        app.toast((err && err.message) || 'Failed', 2000);
      });
    }

    function doLeft() {
      if (opts.onLeft) opts.onLeft();
      else app.back();
    }

    // Right softkey: reorderable lists enter reorder mode; entity rows jump
    // straight to Details; device rows have no secondary action.
    function doSecondary() {
      if (opts.reorderable) { enterReorder(); return; }
      var it = focusedItem();
      if (!it || it.kind === 'device') return;
      openDetail(it.id);
    }

    /* ---------- reorder (collapse is suppressed, so items are all entities) ---------- */
    function enterReorder() {
      reorderMode = true;
      app.toast('Up/Down to move, Done to finish', 1500);
      renderRows();
    }

    function indexOfEntity(id) {
      for (var i = 0; i < flatItems.length; i++) {
        if (flatItems[i].kind === 'entity' && flatItems[i].id === id) return i;
      }
      return -1;
    }

    function moveFocused(delta) {
      var it = focusedItem();
      if (!it || it.kind !== 'entity') return;
      var id = it.id;
      if (opts.onMove && opts.onMove(id, delta)) {
        renderRows();
        var ni = indexOfEntity(id);
        if (ni !== -1) focus.setIndex(ni);
      }
    }

    /* ---------- search focus ---------- */
    function focusSearch() {
      if (!searchInput) return;
      searchFocused = true;
      try { searchInput.focus(); } catch (e) {}
      updateSoftkeys();
    }

    function blurSearch() {
      searchFocused = false;
      if (searchInput && searchInput.blur) searchInput.blur();
      focus.refresh(true);
      updateSoftkeys();
    }

    /* ---------- key handling ---------- */
    function onKey(key) {
      if (searchFocused) {
        switch (key) {
          case 'Down':
          case 'Enter': blurSearch(); return true;
          case 'SoftLeft': blurSearch(); return true;
          case 'SoftRight':
            searchInput.value = ''; searchText = ''; renderRows(); return true;
          case 'Up': return true;
          case 'Backspace': return false; // let input delete
        }
        return false; // let characters type into the input
      }

      if (reorderMode) {
        switch (key) {
          case 'Up': moveFocused(-1); return true;
          case 'Down': moveFocused(1); return true;
          case 'Enter':
          case 'SoftLeft':
          case 'Backspace':
            reorderMode = false; renderRows(); return true;
        }
        return true;
      }

      switch (key) {
        case 'Up':
          if (opts.search && focus.index === 0) { focusSearch(); return true; }
          focus.move(-1); updateSoftkeys(); return true;
        case 'Down': focus.move(1); updateSoftkeys(); return true;
        case 'Enter': doPrimary(); return true;
        case 'SoftRight': doSecondary(); return true;
        case 'SoftLeft': doLeft(); return true;
        case 'Backspace': doLeft(); return true;
      }
      if (key >= '1' && key <= '9') {
        var idx = parseInt(key, 10) - 1;
        if (idx < flatItems.length) { focus.setIndex(idx); updateSoftkeys(); }
        return true;
      }
      return false;
    }

    /* ---------- live hooks ---------- */
    function onStates() { if (rowsEl) renderRows(); }
    function onRegistries() { if (rowsEl) renderRows(); }
    function onStateChanged(evt) {
      if (!rowsEl) return;
      var id = evt.entityId;
      if (rowMap[id]) { updateRow(id); return; }
      if (coveredIds[id]) return; // collapsed member; device row shows a static count
      queueRebuild();
    }

    function destroy() {
      if (searchInput && searchInput.blur) { try { searchInput.blur(); } catch (e) {} }
      container = null; rowsEl = null;
    }

    /* ---- back-stack position memory ---- */
    function saveState() {
      return { index: focus ? focus.index : 0 };
    }

    function restoreState(s) {
      if (!s || !rowsEl || !focus) return;
      var i = s.index || 0;
      if (i < 0) i = 0;
      if (i > focus.count() - 1) i = focus.count() - 1;
      if (i >= 0) { focus.setIndex(i); updateSoftkeys(); }
    }

    return {
      render: render,
      onKey: onKey,
      onStates: onStates,
      onStateChanged: onStateChanged,
      onRegistries: onRegistries,
      destroy: destroy,
      saveState: saveState,
      restoreState: restoreState,
      refresh: function () { if (rowsEl) renderRows(); }
    };
  }

  global.HAEntityList = HAEntityList;
})(window);
