/* nav.js - D-pad / softkey input handling for KaiOS.
   Normalizes key events into logical keys and provides a FocusList helper
   for D-pad list navigation. ES5-safe. */
(function (global) {
  'use strict';

  // Map raw KeyboardEvent -> logical key. Prefer event.key (KaiOS reports
  // SoftLeft / SoftRight / ArrowUp etc.), fall back to keyCode for safety.
  function normalizeKey(ev) {
    var k = ev.key;
    switch (k) {
      case 'ArrowUp': return 'Up';
      case 'ArrowDown': return 'Down';
      case 'ArrowLeft': return 'Left';
      case 'ArrowRight': return 'Right';
      case 'Enter': return 'Enter';
      case 'SoftLeft': return 'SoftLeft';
      case 'SoftRight': return 'SoftRight';
      case 'Backspace': return 'Backspace';
      case 'EndCall': return 'EndCall';
    }
    // Number keys (used for quick list jumps).
    if (k && k.length === 1 && k >= '0' && k <= '9') return k;

    switch (ev.keyCode) {
      case 38: return 'Up';
      case 40: return 'Down';
      case 37: return 'Left';
      case 39: return 'Right';
      case 13: return 'Enter';
      case 8: return 'Backspace';
      case 112: return 'SoftLeft';  // some devices
      case 113: return 'SoftRight';
    }
    if (ev.keyCode >= 48 && ev.keyCode <= 57) return String(ev.keyCode - 48);
    if (ev.keyCode >= 96 && ev.keyCode <= 105) return String(ev.keyCode - 96);
    return null;
  }

  // Attach a single global key handler. handler(logicalKey, event) should
  // return true if it consumed the event. Returns a detach function.
  function attach(handler) {
    function onKeyDown(ev) {
      var key = normalizeKey(ev);
      if (!key) return;
      var consumed = handler(key, ev);
      if (consumed) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    }
    document.addEventListener('keydown', onKeyDown, false);
    return function detach() {
      document.removeEventListener('keydown', onKeyDown, false);
    };
  }

  /* FocusList: manage a moving focus among a set of item elements inside a
     scroll container. Items are matched by CSS class name. */
  function FocusList(container, itemClass) {
    this.container = container;
    this.itemClass = itemClass || 'row';
    this.index = 0;
    this.items = [];
  }

  FocusList.prototype.refresh = function (preserve) {
    var nodes = this.container.getElementsByClassName(this.itemClass);
    this.items = [];
    for (var i = 0; i < nodes.length; i++) {
      // Skip non-focusable items explicitly opted out.
      if (nodes[i].getAttribute('data-nofocus') === '1') continue;
      this.items.push(nodes[i]);
    }
    if (!preserve || this.index >= this.items.length) {
      this.index = 0;
    }
    this.apply();
  };

  FocusList.prototype.apply = function () {
    for (var i = 0; i < this.items.length; i++) {
      if (i === this.index) {
        this.items[i].className += ' focused';
      } else {
        this.items[i].className = this.items[i].className.replace(/\s*focused/g, '');
      }
    }
    var el = this.items[this.index];
    if (el && el.scrollIntoView) {
      el.scrollIntoView(false);
    }
  };

  FocusList.prototype.move = function (delta) {
    if (!this.items.length) return;
    var next = this.index + delta;
    if (next < 0) next = 0;
    if (next > this.items.length - 1) next = this.items.length - 1;
    if (next === this.index) return;
    this.index = next;
    this.apply();
  };

  FocusList.prototype.current = function () {
    return this.items[this.index] || null;
  };

  FocusList.prototype.setIndex = function (i) {
    if (i < 0 || i >= this.items.length) return;
    this.index = i;
    this.apply();
  };

  FocusList.prototype.count = function () {
    return this.items.length;
  };

  global.HANav = {
    normalizeKey: normalizeKey,
    attach: attach,
    FocusList: FocusList
  };
})(window);
