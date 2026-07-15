# ha4kaios

A [Home Assistant](https://www.home-assistant.io/) client for **KaiOS 2.5**
feature phones. It is a dependency-free, ES5 packaged app that talks to your own
Home Assistant using a long-lived access token over WebSocket (live state) with
a REST fallback.

## Features

- View and control common entities: **lights** (toggle + brightness),
  **switches**, **scenes**, and **climate** (mode + target temp); read-only
  **sensors** and everything else.
- Live updates via the Home Assistant WebSocket API, with auto-reconnect and a
  REST polling fallback.
- **Scan the token from a QR code** with the camera - no typing the long string.
- D-pad + softkey UI designed for small, non-touch screens.

## Requirements

- A reachable Home Assistant instance (e.g. `http://192.168.1.10:8123`).
- A long-lived access token: **Profile -> Security -> Long-Lived Access Tokens ->
  Create Token**.
- A KaiOS 2.5 device, or an old Firefox / the KaiOS simulator for testing.

## Quick start

```bash
./build/build.sh      # produces build/application.zip (manifest at the zip root)
```

Install `build/application.zip` (or the `app/` folder) on your device or the simulator,
then launch **HA4KaiOS**, enter your URL, scan or paste the token, and press
**Connect**. Full steps: [Packaging & install](docs/packaging-and-install.md).

## Controls

| Key            | List view               | Detail view                    |
| -------------- | ----------------------- | ------------------------------ |
| Up / Down      | Move selection          | Move between controls          |
| Left / Right   | -                       | Adjust value (brightness/temp) |
| Center / Enter | Primary action (toggle) | Activate focused control       |
| Left softkey   | `Setup`                 | `Back`                         |
| Right softkey  | `Details`               | -                              |

## Project layout

```
app/                # everything that ships in the packaged app
  manifest.webapp   # privileged manifest (systemXHR + camera, icons, CSP)
  index.html        # app shell (external CSS/JS only)
  css/app.css       # small-screen styles
  js/               # config, xhr, ha-client, nav, qr, views, app
  js/vendor/        # jsQR (vendored QR decoder)
  icons/            # 56 / 112 px app icons
docs/               # wiki (deep-dive documentation)
build/              # build.sh + generated application.zip
```

## Documentation

- [Architecture](docs/architecture.md)
- [KaiOS 2.5 constraints](docs/kaios-constraints.md)
- [Home Assistant API](docs/home-assistant-api.md)
- [QR token scanning](docs/qr-scanning.md)
- [Packaging & install](docs/packaging-and-install.md)

## Security

- The access token is stored only in the app's private `localStorage` and is
  sent only to the host you configure; it is never logged.
- Data from Home Assistant is rendered with `textContent` (never `innerHTML`) to
  prevent injection.
- The `camera` permission is used solely for QR scanning; frames are processed
  on-device and the camera is released as soon as scanning ends.
- Prefer `https://` when Home Assistant is reachable beyond a trusted LAN.
