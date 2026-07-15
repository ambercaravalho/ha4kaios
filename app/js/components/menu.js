/* components/menu.js - reusable modal list overlay used for per-entity option
   menus and settings pickers. Routes keys via app.setOverlay. ES5-safe. */
(function (global) {
  'use strict';

  var open = null; // only one menu at a time

  function openMenu(app, opts) {
    if (open) open.close();

    var items = opts.items || [];
    var index = 0;

    var overlay = document.createElement('div');
    overlay.className = 'menu-overlay';

    var panel = document.createElement('div');
    panel.className = 'menu-panel';

    if (opts.title) {
      var title = document.createElement('div');
      title.className = 'menu-title';
      title.textContent = opts.title;
      panel.appendChild(title);
    }

    var listEl = document.createElement('div');
    listEl.className = 'menu-list';
    var rows = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var row = document.createElement('div');
      row.className = 'menu-item';
      var lbl = document.createElement('span');
      lbl.className = 'menu-item-label';
      lbl.textContent = it.label;
      row.appendChild(lbl);
      if (it.hint) {
        var hint = document.createElement('span');
        hint.className = 'menu-item-hint';
        hint.textContent = it.hint;
        row.appendChild(hint);
      }
      listEl.appendChild(row);
      rows.push(row);
    }
    panel.appendChild(listEl);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    function apply() {
      for (var i = 0; i < rows.length; i++) {
        rows[i].className = (i === index) ? 'menu-item focused' : 'menu-item';
      }
      if (rows[index] && rows[index].scrollIntoView) rows[index].scrollIntoView(false);
    }

    function softkeys() { app.setSoftkeys('Cancel', 'Select', ''); }

    function close(selected) {
      if (!open) return;
      open = null;
      try { document.body.removeChild(overlay); } catch (e) {}
      app.setOverlay(null);
      if (opts.onClose) opts.onClose(selected || null);
    }

    function select() {
      var it = items[index];
      if (!it) { close(); return; }
      if (it.keepOpen) { if (it.onSelect) it.onSelect(); return; }
      // Close first so any navigation in onSelect applies its softkeys last.
      close(it);
      if (it.onSelect) it.onSelect();
    }

    function onKey(key) {
      switch (key) {
        case 'Up': if (index > 0) { index--; apply(); } return true;
        case 'Down': if (index < rows.length - 1) { index++; apply(); } return true;
        case 'Enter': select(); return true;
        case 'SoftLeft':
        case 'SoftRight':
        case 'Backspace': close(); return true;
      }
      // Swallow all other keys while the menu is up.
      return true;
    }

    open = { close: close };
    app.setOverlay({ onKey: onKey });
    apply();
    softkeys();
  }

  global.HAMenu = { open: openMenu, isOpen: function () { return !!open; } };
})(window);
