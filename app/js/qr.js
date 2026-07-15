/* qr.js - camera QR scanner for reading a Home Assistant long-lived access
   token QR code (which encodes the raw token string). Uses getUserMedia +
   the vendored jsQR decoder. ES5-safe for Gecko 48 / KaiOS 2.5. */
(function (global) {
  'use strict';

  var SCAN_INTERVAL = 350; // ms between decode attempts (feature-phone friendly)
  var MAX_DIM = 320;       // downscale frames to cap decode cost

  var overlay, video, canvas, ctx, hint;
  var stream = null;
  var running = false;
  var timer = null;
  var objectUrl = null;
  var cb = { onResult: null, onError: null };

  function isSupported() {
    if (typeof jsQR !== 'function') return false;
    return !!(
      (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) ||
      navigator.getUserMedia || navigator.mozGetUserMedia || navigator.webkitGetUserMedia
    );
  }

  function cacheEls() {
    overlay = document.getElementById('qr-overlay');
    video = document.getElementById('qr-video');
    canvas = document.getElementById('qr-canvas');
    hint = document.getElementById('qr-hint');
    if (canvas) ctx = canvas.getContext('2d');
  }

  // Normalize the various getUserMedia flavors to a Promise<MediaStream>.
  function getStream(constraints) {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      return navigator.mediaDevices.getUserMedia(constraints);
    }
    var legacy = navigator.getUserMedia || navigator.mozGetUserMedia ||
      navigator.webkitGetUserMedia;
    if (!legacy) return Promise.reject(new Error('Camera not supported'));
    return new Promise(function (resolve, reject) {
      legacy.call(navigator, constraints, resolve, reject);
    });
  }

  function attachStream(mediaStream) {
    stream = mediaStream;
    try {
      video.srcObject = mediaStream;
    } catch (e1) {
      try {
        video.mozSrcObject = mediaStream;
      } catch (e2) {
        var URLobj = global.URL || global.webkitURL;
        if (URLobj && URLobj.createObjectURL) {
          objectUrl = URLobj.createObjectURL(mediaStream);
          video.src = objectUrl;
        }
      }
    }
    var p = video.play();
    if (p && p.then) { p.then(function () {}, function () {}); }
  }

  function start(options) {
    cb.onResult = (options && options.onResult) || function () {};
    cb.onError = (options && options.onError) || function () {};

    cacheEls();
    if (!overlay || !video || !canvas) {
      cb.onError(new Error('Scanner UI missing'));
      return;
    }
    if (typeof jsQR !== 'function') {
      cb.onError(new Error('QR decoder unavailable'));
      return;
    }

    overlay.className = 'qr-overlay';
    if (hint) hint.textContent = 'Point at the token QR code';

    // SECURITY-REVIEW: requests camera access via getUserMedia (declared with
    // the "video-capture" manifest permission). Frames are processed locally
    // only and never sent anywhere; the stream is released when scanning stops.
    getStream({ video: { facingMode: 'environment' }, audio: false })
      .then(onStream, function () {
        // Retry without facingMode (some devices reject the constraint).
        getStream({ video: true, audio: false }).then(onStream, onStreamError);
      });
  }

  function onStream(mediaStream) {
    attachStream(mediaStream);
    running = true;
    // Begin decoding once we have frame data; also kick a fallback timer.
    video.addEventListener('loadedmetadata', scheduleTick, false);
    scheduleTick();
  }

  function onStreamError(err) {
    var message = 'Camera unavailable';
    if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
      message = 'Camera permission denied';
    } else if (err && err.name === 'NotFoundError') {
      message = 'No camera found';
    } else if (err && err.message) {
      message = err.message;
    }
    stop();
    cb.onError(new Error(message));
  }

  function scheduleTick() {
    if (!running || timer) return;
    timer = setTimeout(tick, 0);
  }

  function tick() {
    timer = null;
    if (!running) return;
    try { decodeFrame(); } catch (e) {}
    if (running) timer = setTimeout(tick, SCAN_INTERVAL);
  }

  function decodeFrame() {
    if (!video || video.readyState < 2) return; // HAVE_CURRENT_DATA
    var vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return;

    var scale = Math.min(1, MAX_DIM / Math.max(vw, vh));
    var w = Math.max(1, Math.round(vw * scale));
    var h = Math.max(1, Math.round(vh * scale));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;

    ctx.drawImage(video, 0, 0, w, h);
    var img = ctx.getImageData(0, 0, w, h);
    var code = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
    if (code && code.data) {
      var text = ('' + code.data).replace(/^\s+|\s+$/g, '');
      if (text) {
        var onResult = cb.onResult;
        stop();
        onResult(text);
      }
    }
  }

  function stop() {
    running = false;
    if (timer) { clearTimeout(timer); timer = null; }
    if (video) {
      try { video.removeEventListener('loadedmetadata', scheduleTick, false); } catch (e) {}
      try { video.pause(); } catch (e) {}
      try { video.srcObject = null; } catch (e) {}
      try { video.mozSrcObject = null; } catch (e) {}
      if (video.src) { try { video.removeAttribute('src'); video.load(); } catch (e) {} }
    }
    if (stream) {
      try {
        var tracks = stream.getTracks ? stream.getTracks() : [];
        for (var i = 0; i < tracks.length; i++) {
          try { tracks[i].stop(); } catch (e) {}
        }
      } catch (e) {}
      stream = null;
    }
    if (objectUrl) {
      var URLobj = global.URL || global.webkitURL;
      if (URLobj && URLobj.revokeObjectURL) {
        try { URLobj.revokeObjectURL(objectUrl); } catch (e) {}
      }
      objectUrl = null;
    }
    if (overlay) overlay.className = 'qr-overlay hidden';
  }

  function isActive() { return running; }

  global.HAQR = {
    isSupported: isSupported,
    start: start,
    stop: stop,
    isActive: isActive
  };
})(window);
