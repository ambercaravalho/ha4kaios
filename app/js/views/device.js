/* views/device.js - the entities belonging to one device (drill-in from a
   collapsed device row). Registers HAViews.deviceEntities. ES5-safe. */
(function (global) {
  'use strict';

  global.HAViews = global.HAViews || {};

  global.HAViews.deviceEntities = function (app) {
    var list = null;
    var deviceId = null;

    function render(root, params) {
      deviceId = params && params.deviceId;
      app.setTitle((params && params.name) || 'Device');
      list = HAEntityList(app, {
        getIds: function () { return app.getClient().getDeviceEntities(deviceId); },
        emptyText: 'No entities for this device.',
        leftLabel: 'Back'
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
