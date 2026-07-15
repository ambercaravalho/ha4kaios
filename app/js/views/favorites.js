/* views/favorites.js - the local favorites dashboard, with a reorder mode.
   ES5-safe. */
(function (global) {
  'use strict';

  global.HAViews = global.HAViews || {};

  global.HAViews.favorites = function (app) {
    var list = null;

    function render(root) {
      app.setTitle('Favorites');
      list = HAEntityList(app, {
        ordered: true,
        showArea: true,
        reorderable: true,
        collapseDevices: true,
        leftLabel: 'Back',
        emptyText: 'No favorites yet. Open an entity and press Fav to add one.',
        getIds: function () { return HAStore.getFavorites(); },
        onMove: function (id, delta) { return HAStore.moveFavorite(id, delta); },
        onFavoriteChange: function () { if (list) list.refresh(); }
      });
      list.render(root);
    }

    return {
      render: render,
      onKey: function (k) { return list ? list.onKey(k) : false; },
      onStates: function () { if (list) list.onStates(); },
      onStateChanged: function (e) { if (list) list.onStateChanged(e); },
      onRegistries: function () { if (list) list.onRegistries(); },
      destroy: function () { if (list) list.destroy(); },
      saveState: function () { return list ? list.saveState() : null; },
      restoreState: function (s) { if (list) list.restoreState(s); }
    };
  };
})(window);
