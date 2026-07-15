# ha4kaios

A [Home Assistant](https://www.home-assistant.io/) client for **KaiOS 2.5**
feature phones. It is a dependency-free, ES5 packaged app that talks to your own
Home Assistant using a long-lived access token over WebSocket (live state) with
a REST fallback.

## Features

- **Home hub** with Favorites, Areas, Scenes, Automations, All devices, and
  Settings, plus a connection/last-updated line.
- **Area grouping** from Home Assistant's registries, a searchable **All
  devices** screen, and a local **favorites dashboard** with reorder.
- **Smart sorting** (controllable + active first) with Name / Status modes, and
  automatic hiding of hidden/diagnostic entities.
- Control many domains: **lights** (brightness), **switches**, **fans**,
  **covers**, **locks**, **climate**, **media players**, **scenes/scripts**,
  **buttons**, **numbers**, and **selects**; read-only for everything else.
- Quick primary actions from any list (toggle / activate / open) plus a direct
  **Details** screen for controls, attributes, and favoriting.
- Live updates via the WebSocket API with auto-reconnect and a REST fallback.
- **Scan the token from a QR code** with the camera - no typing the long string.
- **Dark / light themes** and D-pad + softkey UI for small, non-touch screens.

## Requirements

- A reachable Home Assistant instance (e.g. `http://192.168.1.10:8123`).
- A long-lived access token (see
  [Authentication](docs/home-assistant-api.md#authentication)).
- A KaiOS 2.5 device, or an old Firefox / the KaiOS simulator for testing.

## Quick start

```bash
./build/build.sh      # produces build/application.zip (manifest at the zip root)
```

Install `build/application.zip` (or the `app/` folder) on your device or the simulator,
then launch **HA4KaiOS**, enter your URL, scan or paste the token, and press
**Connect**. Full steps: [Packaging & install](docs/packaging-and-install.md).

## Controls

The D-pad moves the selection, Center acts on it (toggle / activate / open), and
the two softkeys are labelled per screen. Back returns to the previous screen;
Home is the root, so Back there never exits by accident. See the
[UI guide](docs/ui.md#controls) for the full key reference, screens, sorting,
favorites, and search.

## Project layout

```
app/                # everything that ships in the packaged app
  manifest.webapp   # privileged manifest (systemXHR + video-capture, icons, CSP)
  index.html        # app shell (external CSS/JS only)
  css/app.css       # small-screen styles + dark/light themes
  js/               # config, store, xhr, ha-client, format, nav, qr, domains, app
  js/components/    # reusable entity list + menu overlay
  js/views/         # one file per screen (setup, home, lists, detail, settings)
  js/vendor/        # jsQR (vendored QR decoder)
  icons/            # 56 / 112 px app icons
docs/               # wiki (deep-dive documentation)
build/              # build.sh + generated application.zip
```

## Documentation

Deep-dive guides live in the [docs wiki](docs/README.md): architecture, UI,
KaiOS constraints, the Home Assistant API, QR scanning, and packaging/install.

## Security

- The access token is stored only in the app's private `localStorage` and is
  sent only to the host you configure; it is never logged.
- Data from Home Assistant is rendered with `textContent` (never `innerHTML`) to
  prevent injection.
- The `video-capture` permission is used solely for QR scanning; frames are
  processed on-device and the camera is released as soon as scanning ends.
- Prefer `https://` when Home Assistant is reachable beyond a trusted LAN.
