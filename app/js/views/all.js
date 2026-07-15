/* views/all.js - every entity, searchable and grouped by area (or domain when
   registries are unavailable). ES5-safe. */
(function (global) {
  'use strict';

  global.HAViews = global.HAViews || {};

  global.HAViews.all = function (app) {
    var list = null;

    function render(root) {
      app.setTitle('All devices');
      list = HAEntityList(app, {
        search: true,
        group: function () { return app.getClient().hasRegistries() ? 'area' : 'domain'; },
        leftLabel: 'Back',
        emptyText: 'No entities found.',
        getIds: function () {
          var ids = [];
          var ents = app.getClient().getEntities();
          for (var id in ents) { if (ents.hasOwnProperty(id)) ids.push(id); }
          return ids;
        }
      });
      list.render(root);
    }

    return {
      render: render,
      onKey: function (k) { return list ? list.onKey(k) : false; },
      onStates: function () { if (list) list.onStates(); },
      onStateChanged: function (e) { if (list) list.onStateChanged(e); },
      onRegistries: function () { if (list) list.onRegistries(); },
      destroy: function () { if (list) list.destroy(); }
    };
  };
})(window);
