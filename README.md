# ha4kaios

A [Home Assistant](https://www.home-assistant.io/) client for **KaiOS 2.5, 3.0,
3.1, and 4.0** feature phones. It is a dependency-free, ES5 packaged app that
talks to your own Home Assistant using a long-lived access token over WebSocket
(live state) with a REST fallback.

## Features

- **Home hub** with Favorites, Areas, Scenes, Automations, All devices, and
  Settings, area grouping from HA's registries, and a searchable All-devices
  screen.
- Control lights (brightness), switches, fans, covers, locks, climate, media
  players, scenes/scripts, buttons, numbers, and selects; read-only for the rest.
- **Smart sorting**, a local favorites dashboard with reorder, and dark/light
  themes.
- Live updates over the WebSocket API with auto-reconnect and a REST fallback.
- **Scan the token from a QR code** - no typing the long string.

## Requirements

- A reachable Home Assistant instance (e.g. `http://192.168.1.10:8123`).
- A long-lived access token (see
  [Home Assistant API](docs/architecture.md#home-assistant-api)).
- A KaiOS 2.5/3.0/3.1/4.0 device, or an old Firefox / the KaiOS simulator for
  testing.

## Quick start

```bash
./build/build.sh      # produces build/application-2.5.zip and build/application-3.zip
```

Install the package that matches your device (`application-2.5.zip` for KaiOS
2.5, `application-3.zip` for KaiOS 3.0/3.1/4.0), then launch **HA4KaiOS**, enter
your URL, scan or paste the token, and press **Connect**. Full steps:
[Platform, packaging & install](docs/platform.md).

## Documentation

- [Architecture](docs/architecture.md) - modules, data flow, and the Home
  Assistant WebSocket/REST API.
- [UI guide](docs/ui.md) - screens, navigation, favorites, sorting, and search.
- [Platform, packaging & install](docs/platform.md) - KaiOS versions,
  constraints, camera, and building/sideloading the packages.

## Security

- The access token is stored only in the app's private `localStorage` and is
  sent only to the host you configure; it is never logged.
- Data from Home Assistant is rendered with `textContent` (never `innerHTML`) to
  prevent injection.
- The `video-capture` permission is used solely for QR scanning; frames are
  processed on-device and the camera is released as soon as scanning ends.
- Prefer `https://` when Home Assistant is reachable beyond a trusted LAN.
