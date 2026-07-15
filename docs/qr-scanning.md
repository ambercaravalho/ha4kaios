# QR token scanning

Home Assistant's long-lived access token dialog shows the token as a QR code that
encodes the **plain token string**. The app reads it with the camera so users
don't have to type a very long token. Logic lives in
[`app/js/qr.js`](../app/js/qr.js); the decoder is the vendored
[`app/js/vendor/jsQR.js`](../app/js/vendor/jsQR.js).

## Flow

1. In the setup view, select **Scan token QR**.
2. `HAQR.start()` shows the overlay and requests the camera.
3. Frames are drawn to a canvas and decoded by `jsQR` a few times per second.
4. On a hit, the token fills the field, focus moves to **Connect**, and the
   camera is released.
5. A softkey or Backspace cancels and releases the camera.

## Camera capture (Gecko 48 quirks)

`getUserMedia` and stream attachment vary on old Gecko, so `js/qr.js` tries
several paths in order:

- Acquire: `navigator.mediaDevices.getUserMedia` -> legacy
  `navigator.getUserMedia` / `mozGetUserMedia` / `webkitGetUserMedia`.
- Attach: `video.srcObject` -> `video.mozSrcObject` ->
  `URL.createObjectURL(stream)` (allowed by the `blob:` CSP source).
- Constraints: prefer the rear camera (`facingMode: 'environment'`); if rejected,
  retry with `{ video: true }`.

The `camera` permission is declared in the manifest.

## Performance

- Frames are downscaled to a max dimension of 320px before decoding.
- Decoding is scheduled with a recursive `setTimeout` (~350ms) rather than
  `setInterval`, so slow decodes never pile up.
- `inversionAttempts: 'dontInvert'` is used (HA codes are dark-on-light) to save
  CPU on low-end hardware.

## Cleanup

`HAQR.stop()` clears the timer, stops all media tracks, detaches the stream,
revokes any object URL, and hides the overlay. The setup view also calls it from
`destroy()` so navigating away mid-scan never leaves the camera on.

## Troubleshooting

- **"Camera permission denied"** - grant the camera permission for the app.
- **"No camera found" / "Camera unavailable"** - device/simulator has no usable
  camera; paste the token manually instead.
- **Preview rotated or mirrored** - a per-device orientation quirk; can be fixed
  with a CSS transform on `.qr-video`.
