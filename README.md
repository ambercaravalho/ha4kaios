# ha4kaios

A [Home Assistant](https://www.home-assistant.io/) client for **KaiOS 2.5** feature
phones. It is a vanilla-JS, privileged packaged app that talks to your own Home
Assistant instance using a **long-lived access token**, over WebSocket (live
state) with a REST fallback.

## Features

- Long-lived access token authentication (no password stored).
- **Scan the token from a QR code** instead of typing it: Home Assistant's
  token dialog shows a QR code of the token, and the app reads it with the
  camera (via the vendored `jsQR` decoder).
- Live entity states via the Home Assistant WebSocket API (`state_changed`
  subscription), with automatic reconnect and a REST polling fallback.
- Entity list grouped by domain: lights, switches, scenes, climate, sensors,
  binary sensors, and everything else.
- Controls:
  - **Lights** — toggle and adjust brightness.
  - **Switches / input booleans** — toggle.
  - **Scenes** — activate.
  - **Climate** — change HVAC mode and target temperature.
  - **Sensors / binary sensors** — read-only display with full attribute list.
- D-pad + softkey navigation designed for 240x320 non-touch screens.

## Requirements

- A reachable Home Assistant instance (e.g. `http://192.168.1.10:8123`).
- A long-lived access token: in Home Assistant open your **Profile → Security →
  Long-Lived Access Tokens → Create Token**, then copy it.
- A KaiOS 2.5 device (Gecko/Firefox 48) or the KaiOS simulator / an old Firefox
  for testing.

## Platform notes / constraints

KaiOS 2.5 runs on Gecko 48 (Firefox 48). This app is written accordingly:

- **ES5-safe** JavaScript only (no `let`/`const`/arrow/`async`/`await`) — Gecko
  48 predates `async`/`await`.
- **Privileged packaged app** (`"type": "privileged"` in `manifest.webapp`) with
  the **`systemXHR`** and **`camera`** permissions. REST calls use
  `new XMLHttpRequest({ mozSystem: true })`, which bypasses same-origin/CORS so
  the app can reach a self-hosted HA on the LAN. WebSocket connects cross-origin
  without CORS. The `camera` permission is only used for QR token scanning; the
  camera stream is processed locally (frames decoded on-device) and released as
  soon as scanning ends.
- **CSP**: privileged apps enforce `script-src 'self'`. All JavaScript lives in
  external files and events are wired with `addEventListener` (no inline
  `<script>`, no `onclick=`, no `eval`).

## Controls

| Key            | List view                | Detail view                     |
| -------------- | ------------------------ | ------------------------------- |
| Up / Down      | Move selection           | Move between controls           |
| Left / Right   | —                        | Adjust value (brightness/temp)  |
| Center / Enter | Primary action (toggle)  | Activate focused control        |
| Left softkey   | `Setup`                  | `Back`                          |
| Right softkey  | `Details`                | —                               |

## Project structure

```
manifest.webapp     # privileged app manifest (systemXHR permission, icons, CSP)
index.html          # app shell (external CSS/JS only)
css/app.css         # small-screen styles, focus highlight, softkey bar
js/config.js        # baseUrl + token persistence (localStorage)
js/xhr.js           # mozSystem XHR Promise wrapper (REST)
js/ha-client.js     # WebSocket auth/subscriptions + REST fallback
js/nav.js           # D-pad / softkey key normalization + FocusList
js/qr.js            # camera + jsQR token QR scanner
js/vendor/jsQR.js   # vendored QR decoder (ES5-compatible)
js/views/setup.js   # URL + token entry (+ QR scan), test connection
js/views/list.js    # live entity list (+ shared HAFmt helpers)
js/views/detail.js  # per-entity control view
js/app.js           # routing, softkeys, status, toast, client wiring
icons/              # 56 / 112 px app icons
build.sh            # packages everything into application.zip
```

## Build

Create the sideloadable package (`manifest.webapp` must be at the zip root):

```bash
./build.sh
```

This produces `application.zip`.

## Install / test

### Desktop (quick check)

Serve the folder and open it in an old Firefox (48-ish) or the KaiOS simulator.
On non-KaiOS environments the `mozSystem` XHR flag is ignored, so you may hit
CORS unless Home Assistant allows the origin — the WebSocket path still works.

### KaiOS device (WebIDE)

1. Enable **Developer/Debugger mode** on the phone (varies by device; often via
   the hidden developer menu).
2. Connect the phone over USB with `adb` available.
3. In Firefox (pre-Quantum, with WebIDE), open **WebIDE → Install packaged app**
   and select this project folder (the one containing `manifest.webapp`).
4. Launch **HA4KaiOS** from the device app list.

### KaiOS device (adb push, BananaHackers-style)

For rooted/dev-enabled phones you can push `application.zip` and install via the
device's app-install tooling. See the
[BananaHackers documentation](https://sites.google.com/view/bananahackers/) for
device-specific steps.

## First run

1. Launch the app.
2. Enter your Home Assistant URL (e.g. `http://192.168.1.10:8123`).
3. Enter the token by either:
   - Selecting **Scan token QR** and pointing the camera at the QR code shown in
     Home Assistant's "Long-Lived Access Tokens" dialog (press a softkey /
     Backspace to cancel), or
   - Pasting/typing it into the token field.
4. Press the right softkey (`Connect`). On success the entity list appears and
   the header shows `online` (or `rest` when using the REST fallback).

## Security

- The access token grants full API access to your Home Assistant. It is stored
  only in this app's private `localStorage` and is sent only to the host you
  configure. It is never logged. (Relevant code paths are marked with
  `# SECURITY-REVIEW`.)
- All data received from Home Assistant is rendered with `textContent` (never
  `innerHTML`) to avoid script injection from entity/attribute values.
- Prefer `https://` when your Home Assistant is exposed beyond a trusted LAN.
