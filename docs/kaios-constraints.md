# KaiOS 2.5 constraints

KaiOS 2.5 runs on Gecko / Firefox 48. This page lists the platform limits that
shaped the app and the workarounds used.

## JavaScript engine

Gecko 48 supports most of ES6 (`let`/`const`, arrow functions, classes,
Promises, typed arrays), but **not**:

- `async` / `await` (Firefox 52+)
- the `**` exponentiation operator (Firefox 52+)
- object rest/spread `{...x}` (Firefox 55+)

To stay safe and dependency-free, all app code is written in **ES5** and async
work uses `Promise`. The vendored `jsQR` bundle was checked against these limits.

## Content Security Policy

Privileged packaged apps enforce a strict CSP, notably `script-src 'self'`.
Consequences:

- No inline `<script>` blocks and no inline event handlers (`onclick=`).
- No `eval()` / `new Function()`.
- Third-party libraries must be **vendored locally** (hence `js/vendor/jsQR.js`),
  not loaded from a CDN.

All events are wired with `addEventListener`. The manifest also allows `data:`
and `blob:` sources so canvas/object-URL usage works.

## Networking (CORS)

Home Assistant usually runs on the LAN over plain HTTP, which trips
same-origin/CORS for a normal web app. Workarounds:

- **REST**: `new XMLHttpRequest({ mozSystem: true })`, enabled by the
  `systemXHR` manifest permission, bypasses same-origin entirely.
- **WebSocket**: connects cross-origin without CORS, so it is the primary
  transport.

## Camera / getUserMedia

Used only for QR scanning, which needs the **`video-capture`** manifest
permission. Gecko 48 predates the modern promise-only `navigator.mediaDevices`
guarantees and stream attachment differs across builds, so `js/qr.js` relies on
fallbacks. Details, including why `video-capture` rather than `camera`, are in
[QR token scanning](qr-scanning.md).

## Hardware / UX

- Screen around 240x320, non-touch on most devices.
- Input is a D-pad (arrows + center) plus two softkeys and Back.
- Limited RAM/CPU: keep the DOM small, avoid heavy per-frame work, and downscale
  camera frames before decoding.

## Version detection

The user agent contains `KAIOS/<version>` and `Firefox/48.0` on 2.5 devices, but
prefer runtime feature detection over UA sniffing.
