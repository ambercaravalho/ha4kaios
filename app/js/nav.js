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

  /* Marquee: iPod-style back-and-forth scroll of overflowing text on the
     focused item. Opt in by adding the "marquee" class to a clipping element
     (overflow:hidden; white-space:nowrap). Driven with text-indent transitions
     to stay ES5/Gecko-48 safe. Only one item marquees at a time (the focused
     one); starting a new one stops any previous animations. */
  var marqueeAnims = [];

  function stopMarquee() {
    for (var i = 0; i < marqueeAnims.length; i++) {
      var a = marqueeAnims[i];
      if (a.timer) clearTimeout(a.timer);
      a.el.style.transition = '';
      a.el.style.textIndent = '';
      a.el.style.textOverflow = '';
    }
    marqueeAnims = [];
  }

  function startMarquee(item) {
    stopMarquee();
    if (!item || !item.getElementsByClassName) return;
    var targets = item.getElementsByClassName('marquee');
    for (var i = 0; i < targets.length; i++) setupMarquee(targets[i]);
  }

  function setupMarquee(el) {
    var overflow = el.scrollWidth - el.clientWidth;
    if (overflow <= 4) return; // fits (or nearly): leave it static
    var shift = overflow + 8;  // reveal the tail with a little trailing pad
    var dur = Math.max(700, Math.round(shift / 55 * 1000)); // ~55px/sec
    var pause = 1000;          // dwell at each end
    var anim = { el: el, timer: null, atEnd: false };
    el.style.textOverflow = 'clip'; // hide the resting ellipsis while moving
    el.style.textIndent = '0px';
    function step() {
      anim.atEnd = !anim.atEnd;
      el.style.transition = 'text-indent ' + dur + 'ms linear';
      el.style.textIndent = anim.atEnd ? (-shift + 'px') : '0px';
      anim.timer = setTimeout(step, dur + pause);
    }
    anim.timer = setTimeout(step, pause);
    marqueeAnims.push(anim);
  }

  /* Scrolling helpers. The app has a single scroll region (#main); focus moves
     should nudge it only as much as needed, never snap the focused element to a
     viewport edge (which makes the whole page jump). */
  function scrollRegion() { return document.getElementById('main'); }

  // Distance from an element's top to the top of the scroll region, summed up
  // the offsetParent chain so nested/positioned wrappers stay correct.
  function offsetTopWithin(el, main) {
    var y = 0;
    var node = el;
    while (node && node !== main) { y += node.offsetTop; node = node.offsetParent; }
    return y;
  }

  function isFullyVisible(el) {
    var main = scrollRegion();
    if (!main || !el) return true;
    var top = offsetTopWithin(el, main);
    var bottom = top + el.offsetHeight;
    return top >= main.scrollTop && bottom <= main.scrollTop + main.clientHeight;
  }

  function scrollIntoViewIfNeeded(el) {
    var main = scrollRegion();
    if (!el) return;
    if (!main) { if (el.scrollIntoView) el.scrollIntoView(false); return; }
    var top = offsetTopWithin(el, main);
    var bottom = top + el.offsetHeight;
    var viewTop = main.scrollTop;
    var viewBottom = viewTop + main.clientHeight;
    if (top < viewTop) main.scrollTop = top;                 // above view: reveal at top
    else if (bottom > viewBottom) main.scrollTop = bottom - main.clientHeight; // below: reveal at bottom
    // otherwise already fully visible: leave the scroll position alone
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
    if (this.index === 0) {
      // Focusing the first row scrolls fully to the top so any content above it
      // (the home connection card, a search box, a section header) stays visible.
      var main = document.getElementById('main');
      if (main) main.scrollTop = 0; else scrollIntoViewIfNeeded(el);
    } else {
      scrollIntoViewIfNeeded(el);
    }
    startMarquee(el);
  };

  FocusList.prototype.move = function (delta) {
    var n = this.items.length;
    if (!n) return;
    // Wrap around: past the bottom returns to the top and vice versa.
    var next = (this.index + delta) % n;
    if (next < 0) next += n;
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
    FocusList: FocusList,
    stopMarquee: stopMarquee,
    isFullyVisible: isFullyVisible,
    scrollIntoViewIfNeeded: scrollIntoViewIfNeeded
  };
})(window);
