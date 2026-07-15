/* components/entitylist.js - reusable live entity list with focus navigation,
   smart sorting/filtering, optional search + grouping, a per-entity options
   menu, number-key jumps, and an optional reorder mode. Exposes HAEntityList.
   ES5-safe. */
(function (global) {
  'use strict';

  function HAEntityList(app, opts) {
    opts = opts || {};
    var container = null;
    var rowsEl = null;
    var searchInput = null;
    var focus = null;

    var rowMap = {};   // entity_id -> { row, name, sub, value, badge }
    var flatIds = [];  // entity_ids in display order
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
      var out = [];

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
      if (group === 'none') return [{ header: null, ids: filtered }];
      if (group === 'domain') return groupBy(filtered, function (id) {
        return HAFmt.domainLabel(HAFmt.domainOf(id));
      }, ents, cmp);
      if (group === 'area') return groupBy(filtered, function (id) {
        var aid = client().getEntityArea(id);
        return aid ? client().getAreaName(aid) : 'No area';
      }, ents, cmp);
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

    function groupBy(ids, keyFn, ents, cmp) {
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
      flatIds = [];
      rowsEl.innerHTML = '';

      var total = 0;
      for (var s = 0; s < sections.length; s++) total += sections[s].ids.length;

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

      for (var i = 0; i < sections.length; i++) {
        if (sections[i].header) {
          var sec = document.createElement('div');
          sec.className = 'section';
          sec.textContent = sections[i].header;
          rowsEl.appendChild(sec);
        }
        for (var j = 0; j < sections[i].ids.length; j++) {
          var id = sections[i].ids[j];
          rowsEl.appendChild(buildRow(id));
          flatIds.push(id);
        }
      }

      focus.refresh(true);
      updateSoftkeys();
    }

    function buildRow(id) {
      var ents = entities();
      var e = ents[id];

      var row = document.createElement('div');
      row.className = 'row';
      row.setAttribute('data-entity', id);

      var badge = document.createElement('span');
      badge.className = 'row-badge';
      badge.textContent = HAFmt.badge(id);

      var main = document.createElement('div');
      main.className = 'row-main';
      var name = document.createElement('span');
      name.className = 'row-name';
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
    function focusedId() { return flatIds[focus.index]; }

    function primaryLabel() {
      var id = focusedId();
      var e = id ? entities()[id] : null;
      if (!e) return '';
      return HAFmt.primaryAction(e).label;
    }

    function updateSoftkeys() {
      if (!rowsEl) return; // view was destroyed (e.g. after navigation)
      if (searchFocused) { app.setSoftkeys('List', '', 'Clear'); return; }
      if (reorderMode) { app.setSoftkeys('Done', 'Move', ''); return; }
      var left = opts.leftLabel || 'Back';
      var center = flatIds.length ? primaryLabel() : '';
      var right = flatIds.length ? 'Options' : '';
      app.setSoftkeys(left, center, right);
    }

    function doPrimary() {
      var id = focusedId();
      if (!id) return;
      var e = entities()[id];
      if (!e) { openDetail(id); return; }
      var act = HAFmt.primaryAction(e);
      if (act.kind === 'detail') { openDetail(id); return; }
      callService(act.domain, act.service, act.data);
    }

    function openDetail(id) {
      app.go('detail', { entityId: id });
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

    function openOptions() {
      var id = focusedId();
      if (!id) return;
      var e = entities()[id];
      var items = [];

      if (e) {
        var act = HAFmt.primaryAction(e);
        if (act.kind !== 'detail') {
          items.push({ label: act.label, onSelect: function () {
            callService(act.domain, act.service, act.data);
          }});
        }
      }
      items.push({ label: 'Details', onSelect: function () { openDetail(id); } });
      items.push({
        label: HAStore.isFavorite(id) ? 'Remove favorite' : 'Add favorite',
        onSelect: function () {
          var nowFav = HAStore.toggleFavorite(id);
          app.toast(nowFav ? 'Added to favorites' : 'Removed', 900);
          if (opts.onFavoriteChange) opts.onFavoriteChange();
        }
      });
      var aid = client().getEntityArea(id);
      if (aid) {
        items.push({ label: 'Go to area', onSelect: function () {
          app.go('areaEntities', { areaId: aid, name: client().getAreaName(aid) });
        }});
      }
      if (opts.reorderable) {
        items.push({ label: 'Reorder list', onSelect: enterReorder });
      }

      HAMenu.open(app, {
        title: e ? HAFmt.friendlyName(e) : id,
        items: items,
        onClose: function () { updateSoftkeys(); }
      });
    }

    /* ---------- reorder ---------- */
    function enterReorder() {
      reorderMode = true;
      app.toast('Up/Down to move, Done to finish', 1500);
      updateSoftkeys();
    }

    function moveFocused(delta) {
      var id = focusedId();
      if (!id) return;
      if (opts.onMove && opts.onMove(id, delta)) {
        renderRows();
        var ni = flatIds.indexOf(id);
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
            reorderMode = false; updateSoftkeys(); return true;
        }
        return true;
      }

      switch (key) {
        case 'Up':
          if (opts.search && focus.index === 0) { focusSearch(); return true; }
          focus.move(-1); updateSoftkeys(); return true;
        case 'Down': focus.move(1); updateSoftkeys(); return true;
        case 'Enter': doPrimary(); return true;
        case 'SoftRight': openOptions(); return true;
        case 'SoftLeft': doLeft(); return true;
        case 'Backspace': doLeft(); return true;
      }
      if (key >= '1' && key <= '9') {
        var idx = parseInt(key, 10) - 1;
        if (idx < flatIds.length) { focus.setIndex(idx); updateSoftkeys(); }
        return true;
      }
      return false;
    }

    /* ---------- live hooks ---------- */
    function onStates() { if (rowsEl) renderRows(); }
    function onRegistries() { if (rowsEl) renderRows(); }
    function onStateChanged(evt) {
      if (!rowsEl) return;
      if (rowMap[evt.entityId]) updateRow(evt.entityId);
      else queueRebuild();
    }

    function destroy() {
      if (searchInput && searchInput.blur) { try { searchInput.blur(); } catch (e) {} }
      container = null; rowsEl = null;
    }

    return {
      render: render,
      onKey: onKey,
      onStates: onStates,
      onStateChanged: onStateChanged,
      onRegistries: onRegistries,
      destroy: destroy,
      refresh: function () { if (rowsEl) renderRows(); }
    };
  }

  global.HAEntityList = HAEntityList;
})(window);
