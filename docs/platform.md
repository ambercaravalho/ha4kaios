# Platform, packaging & install

The app targets **KaiOS 2.5, 3.0, 3.1, and 4.0**. KaiOS 2.5 (Gecko 48) is the
most constrained, so the code is written to its limits; newer releases run much
newer Gecko and are a strict superset.

| KaiOS | Engine | Manifest |
| ----- | ------ | -------- |
| 2.5 | Gecko 48 | `manifest.webapp` (Firefox-OS style) |
| 3.0 / 3.1 | Gecko 84 | `manifest.webmanifest` + `b2g_features` |
| 4.0 | Gecko 123 | `manifest.webmanifest` + `b2g_features` |

## JavaScript engine

All code must run on Gecko 48, which lacks `async`/`await`, the `**` operator,
and object rest/spread `{...x}`. So the app is written in **ES5** and uses
`Promise` for async work (the vendored `jsQR` bundle was checked against these
limits). The newer engines run the same code unchanged.

## Content Security Policy

Privileged packaged apps enforce `script-src 'self'`: no inline `<script>` or
handlers, no `eval()`/`new Function()`, and third-party libraries must be
vendored locally (hence `js/vendor/jsQR.js`). Events are wired with
`addEventListener`. The manifest also allows `data:` and `blob:` so
canvas/object-URL usage works. CSP is identical across all versions.

## Networking (CORS)

Home Assistant usually runs on the LAN over plain HTTP, tripping same-origin/CORS
for a normal web app. Two paths avoid this: **REST** via
`new XMLHttpRequest({ mozSystem: true })` (the `systemXHR` permission bypasses
same-origin), and the primary **WebSocket**, which connects cross-origin without
CORS. `mozSystem`/`systemXHR` remain valid on 3.0+.

## Camera

Used only for QR token scanning ([UI guide](ui.md#token-qr-scan)), which needs
the **`video-capture`** permission - the one that gates `getUserMedia`. The
separate `camera` permission is for the low-level Camera API and does not grant
`getUserMedia` (using it yields an immediate "permission denied"). It is a
"prompt" permission, so the device asks on the first scan.

Old Gecko varies, so [`qr.js`](../app/js/qr.js) tries several paths in order:
acquire via `navigator.mediaDevices.getUserMedia` -> legacy `getUserMedia` /
`mozGetUserMedia` / `webkitGetUserMedia`; attach via `video.srcObject` ->
`mozSrcObject` -> `URL.createObjectURL`; prefer the rear camera
(`facingMode: 'environment'`), retrying with `{ video: true }` if rejected.
Frames are downscaled to 320px and decoded on a recursive `setTimeout` (~350ms)
with `inversionAttempts: 'dontInvert'`. `HAQR.stop()` clears the timer, stops
tracks, and releases the camera; setup also calls it from `destroy()`.

## Manifest & packaging

Both manifests declare the same permissions (`systemXHR`, `video-capture`) and
CSP, so runtime behavior is identical. The two formats cannot coexist in one
package, so [`build.sh`](../build/build.sh) emits one zip per family:

- **2.5**: `manifest.webapp` (top-level `type`, `permissions`, `csp`,
  `launch_path`).
- **3.0/3.1/4.0**: W3C `manifest.webmanifest` with a required root `id`;
  non-standard fields (`version`, `type`, `origin`, `developer`, `csp`,
  `permissions`) live in `b2g_features`. `systemXHR`/`video-capture` need the
  privileged/"signed" level, so `b2g_features.type` stays `privileged`.

Prefer runtime feature detection over UA sniffing (the UA carries
`KAIOS/<version>`); the two moz call sites in `qr.js` and `xhr.js` already do so.

## Build

From the repo root, `./build/build.sh` produces two packages, each with its
manifest at the archive **root** (required by KaiOS):

| Package | Manifest | Install on |
| ------- | -------- | ---------- |
| `build/application-2.5.zip` (also copied to `application.zip`) | `manifest.webapp` | KaiOS 2.5 |
| `build/application-3.zip` | `manifest.webmanifest` | KaiOS 3.0 / 3.1 / 4.0 |

Each zip contains the same `index.html`, `css`, `js`, and `icons` plus only its
target manifest. Pick the zip matching the device.

## Install

- **Desktop check**: serve `app/` in an old Firefox (~48) or the KaiOS simulator.
  `mozSystem` is ignored off-device (REST may hit CORS; WebSocket still works),
  and camera behavior differs, so QR is best verified on hardware.
- **KaiOS 2.5 (WebIDE)**: enable developer mode, connect over USB with `adb`, and
  in a pre-Quantum Firefox with WebIDE choose **Install packaged app** -> the
  `app/` folder.
- **KaiOS 3.0/3.1/4.0**: the old WebIDE flow is gone. `systemXHR`/`video-capture`
  need the privileged/"signed" level, so sideload `application-3.zip` with the
  device in developer mode via KaiOS 3+ tooling, or submit a signed build. The
  exact flow varies by device and should be verified on hardware.
- **adb / BananaHackers**: push the matching zip and install via the device's
  tooling; see the
  [BananaHackers docs](https://sites.google.com/view/bananahackers/).

## First run

Enter the Home Assistant URL (e.g. `http://192.168.1.10:8123`), scan or paste the
token, and press **Connect**. On success the entity list appears and the status
pill shows `online` (or `rest` on the REST fallback).

## Hardware notes

Screen ~240x320, non-touch, D-pad + two softkeys + Back. Limited RAM/CPU: keep
the DOM small, avoid heavy per-frame work, and downscale camera frames. Softkey /
D-pad key names (`SoftLeft`, `SoftRight`, `Enter`, `Arrow*`, `Backspace`,
`EndCall`) are unchanged across versions.

## Troubleshooting QR

- **"Camera permission denied"** - accept the prompt on first scan; if it
  persists, the app was likely installed before the manifest declared
  `video-capture`, so reinstall (permissions are read at install time).
- **"No camera found"** - no usable camera; paste the token instead.
- **Preview rotated/mirrored** - per-device quirk; fix with a CSS transform on
  `.qr-video`.
