# ha4kaios

A [Home Assistant](https://www.home-assistant.io/) client for **KaiOS 2.5**
feature phones. It is a dependency-free, ES5 packaged app that talks to your own
Home Assistant using a long-lived access token over WebSocket (live state) with
a REST fallback.

## Features

- **Home hub** with Favorites, Areas, All devices, and Settings, plus a
  connection/last-updated line.
- **Area grouping** from Home Assistant's registries, a searchable **All
  devices** screen, and a local **favorites dashboard** with reorder.
- **Smart sorting** (controllable + active first) with Name / Status modes, and
  automatic hiding of hidden/diagnostic entities.
- Control many domains: **lights** (brightness), **switches**, **fans**,
  **covers**, **locks**, **climate**, **media players**, **scenes/scripts**,
  **buttons**, **numbers**, and **selects**; read-only for everything else.
- Per-entity **options menu** (toggle, details, favorite, go to area) and quick
  actions from any list.
- Live updates via the WebSocket API with auto-reconnect and a REST fallback.
- **Scan the token from a QR code** with the camera - no typing the long string.
- **Dark / light themes** and D-pad + softkey UI for small, non-touch screens.

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

| Key            | List view                    | Detail view                    |
| -------------- | ---------------------------- | ------------------------------ |
| Up / Down      | Move selection (or search)   | Move between controls          |
| Left / Right   | -                            | Adjust value (brightness/temp) |
| Center / Enter | Primary action (toggle/open) | Activate focused control       |
| 1-9            | Jump to the nth row          | -                              |
| Left softkey   | `Back`                       | `Back`                         |
| Right softkey  | `Options`                    | `Fav` / `Unfav`                |

Back returns to the previous screen (Home is the root). See the
[UI guide](docs/ui.md) for screens, sorting, favorites, and search.

## Project layout

```
app/                # everything that ships in the packaged app
  manifest.webapp   # privileged manifest (systemXHR + video-capture, icons, CSP)
  index.html        # app shell (external CSS/JS only)
  css/app.css       # small-screen styles + dark/light themes
  js/               # config, store, xhr, ha-client, format, nav, qr, domains, app
  js/components/    # reusable entity list + menu overlay
  js/views/         # setup, home, areas, favorites, all, detail, settings
  js/vendor/        # jsQR (vendored QR decoder)
  icons/            # 56 / 112 px app icons
docs/               # wiki (deep-dive documentation)
build/              # build.sh + generated application.zip
```

## Documentation

- [Architecture](docs/architecture.md)
- [UI guide](docs/ui.md)
- [KaiOS 2.5 constraints](docs/kaios-constraints.md)
- [Home Assistant API](docs/home-assistant-api.md)
- [QR token scanning](docs/qr-scanning.md)
- [Packaging & install](docs/packaging-and-install.md)

## Security

- The access token is stored only in the app's private `localStorage` and is
  sent only to the host you configure; it is never logged.
- Data from Home Assistant is rendered with `textContent` (never `innerHTML`) to
  prevent injection.
- The `video-capture` permission is used solely for QR scanning; frames are
  processed on-device and the camera is released as soon as scanning ends.
- Prefer `https://` when Home Assistant is reachable beyond a trusted LAN.
