/* store.js - local UI preferences and favorites, persisted in localStorage.
   Kept separate from connection credentials (see config.js). ES5-safe. */
(function (global) {
  'use strict';

  var KEY = 'ha4kaios.prefs';

  var defaults = {
    favorites: [],           // ordered entity_ids
    sortMode: 'smart',       // 'smart' | 'name' | 'status'
    showDiagnostics: false,  // include config/diagnostic entities
    theme: 'dark',           // 'dark' | 'light'
    lastScreen: null         // { name, params } for restore
  };

  var cache = null;

  function load() {
    if (cache) return cache;
    cache = clone(defaults);
    try {
      var raw = global.localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          for (var k in defaults) {
            if (defaults.hasOwnProperty(k) && parsed[k] !== undefined) {
              cache[k] = parsed[k];
            }
          }
        }
      }
    } catch (e) {}
    if (!isArray(cache.favorites)) cache.favorites = [];
    return cache;
  }

  function persist() {
    try { global.localStorage.setItem(KEY, JSON.stringify(load())); } catch (e) {}
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function isArray(x) { return Object.prototype.toString.call(x) === '[object Array]'; }

  /* ---- preferences ---- */
  function getPref(key, fallback) {
    var c = load();
    return c[key] !== undefined ? c[key] : fallback;
  }

  function setPref(key, value) {
    var c = load();
    c[key] = value;
    persist();
  }

  /* ---- favorites ---- */
  function getFavorites() {
    return load().favorites.slice();
  }

  function isFavorite(id) {
    return load().favorites.indexOf(id) !== -1;
  }

  function toggleFavorite(id) {
    var favs = load().favorites;
    var i = favs.indexOf(id);
    if (i === -1) { favs.push(id); persist(); return true; }
    favs.splice(i, 1);
    persist();
    return false;
  }

  // Move a favorite up (-1) or down (+1) in the ordered list.
  function moveFavorite(id, delta) {
    var favs = load().favorites;
    var i = favs.indexOf(id);
    if (i === -1) return false;
    var j = i + delta;
    if (j < 0 || j >= favs.length) return false;
    var tmp = favs[i];
    favs[i] = favs[j];
    favs[j] = tmp;
    persist();
    return true;
  }

  function clearAll() {
    cache = clone(defaults);
    persist();
  }

  global.HAStore = {
    getPref: getPref,
    setPref: setPref,
    getFavorites: getFavorites,
    isFavorite: isFavorite,
    toggleFavorite: toggleFavorite,
    moveFavorite: moveFavorite,
    clearAll: clearAll
  };
})(window);
