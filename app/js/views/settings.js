/* views/settings.js - preferences (sort, theme, diagnostics) and connection
   actions (reconnect, edit, sign out). ES5-safe. */
(function (global) {
  'use strict';

  global.HAViews = global.HAViews || {};

  var SORT_LABELS = { smart: 'Smart', name: 'Name', status: 'Status' };

  global.HAViews.settings = function (app) {
    var container = null;
    var focus = null;

    function render(root) {
      container = root;
      focus = new HANav.FocusList(container, 'menu-row');
      app.setTitle('Settings');
      build();
    }

    function build() {
      var keep = focus ? focus.index : 0;
      container.innerHTML = '';

      section('Preferences');
      addRow('Sort order', SORT_LABELS[HAStore.getPref('sortMode', 'smart')], 'sort');
      addRow('Theme', HAStore.getPref('theme', 'dark') === 'light' ? 'Light' : 'Dark', 'theme');
      addRow('Show diagnostics', HAStore.getPref('showDiagnostics', false) ? 'On' : 'Off', 'diag');

      section('Connection');
      addRow('Reconnect now', '', 'reconnect');
      addRow('Edit connection', '', 'edit');
      addRow('Sign out', '', 'signout');

      focus.refresh(true);
      if (keep) focus.setIndex(keep);
      app.setSoftkeys('Back', 'Select', '');
    }

    function section(text) {
      var s = document.createElement('div');
      s.className = 'section';
      s.textContent = text;
      container.appendChild(s);
    }

    function addRow(label, value, action) {
      var row = document.createElement('div');
      row.className = 'menu-row';
      row.setAttribute('data-action', action);
      var l = document.createElement('span');
      l.className = 'menu-row-label';
      l.textContent = label;
      var m = document.createElement('span');
      m.className = 'menu-row-meta';
      m.textContent = value;
      row.appendChild(l);
      row.appendChild(m);
      container.appendChild(row);
    }

    function select() {
      var el = focus.current();
      if (!el) return;
      switch (el.getAttribute('data-action')) {
        case 'sort': pickSort(); break;
        case 'theme': pickTheme(); break;
        case 'diag':
          HAStore.setPref('showDiagnostics', !HAStore.getPref('showDiagnostics', false));
          build();
          break;
        case 'reconnect': app.reconnect(); app.toast('Reconnecting\u2026', 1200); break;
        case 'edit': app.go('setup'); break;
        case 'signout': confirmSignOut(); break;
      }
    }

    function pickSort() {
      HAMenu.open(app, {
        title: 'Sort order',
        items: [
          { label: 'Smart', onSelect: function () { setSort('smart'); } },
          { label: 'By name', onSelect: function () { setSort('name'); } },
          { label: 'By status', onSelect: function () { setSort('status'); } }
        ],
        onClose: function () { app.setSoftkeys('Back', 'Select', ''); }
      });
    }
    function setSort(mode) { HAStore.setPref('sortMode', mode); build(); }

    function pickTheme() {
      HAMenu.open(app, {
        title: 'Theme',
        items: [
          { label: 'Dark', onSelect: function () { app.setTheme('dark'); build(); } },
          { label: 'Light', onSelect: function () { app.setTheme('light'); build(); } }
        ],
        onClose: function () { app.setSoftkeys('Back', 'Select', ''); }
      });
    }

    function confirmSignOut() {
      HAMenu.open(app, {
        title: 'Sign out? Clears your token.',
        items: [
          { label: 'Sign out', onSelect: function () { app.signOut(); } },
          { label: 'Cancel', onSelect: function () {} }
        ],
        onClose: function () { app.setSoftkeys('Back', 'Select', ''); }
      });
    }

    function onKey(key) {
      switch (key) {
        case 'Up': focus.move(-1); return true;
        case 'Down': focus.move(1); return true;
        case 'Enter': select(); return true;
        case 'SoftLeft':
        case 'Backspace': app.back(); return true;
      }
      return false;
    }

    function destroy() { container = null; }

    function saveState() { return { index: focus ? focus.index : 0 }; }
    function restoreState(s) {
      if (!s || !focus) return;
      var i = s.index || 0;
      var n = focus.count();
      if (i > n - 1) i = n - 1;
      if (i >= 0) focus.setIndex(i);
    }

    return {
      render: render, onKey: onKey, destroy: destroy,
      saveState: saveState, restoreState: restoreState
    };
  };
})(window);
