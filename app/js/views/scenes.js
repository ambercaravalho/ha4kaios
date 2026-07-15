/* views/scenes.js - dedicated list of scene entities. ES5-safe. */
(function (global) {
  'use strict';

  global.HAViews = global.HAViews || {};

  global.HAViews.scenes = function (app) {
    var list = null;

    function render(root) {
      app.setTitle('Scenes');
      list = HAEntityList(app, {
        leftLabel: 'Back',
        emptyText: 'No scenes found.',
        getIds: function () {
          var ids = [];
          var ents = app.getClient().getEntities();
          for (var id in ents) {
            if (ents.hasOwnProperty(id) && id.indexOf('scene.') === 0) ids.push(id);
          }
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
      destroy: function () { if (list) list.destroy(); },
      saveState: function () { return list ? list.saveState() : null; },
      restoreState: function (s) { if (list) list.restoreState(s); }
    };
  };
})(window);
