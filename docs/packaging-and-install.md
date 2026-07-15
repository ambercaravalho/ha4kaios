# Packaging & install

## Build

From the repo root:

```bash
./build/build.sh
```

This zips the contents of [`app/`](../app) into `build/application.zip` with
`manifest.webapp` at the **root** of the archive (required by KaiOS).

## Test on desktop (quick check)

Serve `app/` and open it in an old Firefox (~48) or the KaiOS simulator. Note:

- The `mozSystem` XHR flag is ignored off-device, so REST may hit CORS unless
  Home Assistant allows the origin. The WebSocket path still works.
- Camera APIs and permissions differ from a real device; QR scanning is best
  verified on hardware.

## Install on a device (WebIDE)

1. Enable developer/debugger mode on the phone (varies by device).
2. Connect over USB with `adb` available.
3. In a pre-Quantum Firefox with WebIDE, choose **Install packaged app** and
   select the `app/` folder (the one containing `manifest.webapp`).
4. Launch **HA4KaiOS** from the app list.

## Install on a device (adb / BananaHackers)

For rooted or dev-enabled phones, push `build/application.zip` and install via the
device's app-install tooling. See the
[BananaHackers documentation](https://sites.google.com/view/bananahackers/) for
device-specific steps.

## First run

1. Enter the Home Assistant URL, e.g. `http://192.168.1.10:8123`.
2. Provide the token by scanning its QR code or pasting it.
3. Press **Connect**. On success the entity list appears and the status pill
   shows `online` (or `rest` when using the REST fallback).
