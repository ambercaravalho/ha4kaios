#!/usr/bin/env bash
# Package the app for KaiOS sideloading. KaiOS 2.5 uses a Firefox-OS-style
# manifest.webapp, while KaiOS 3.0/3.1/4.0 use a W3C manifest.webmanifest with a
# b2g_features block. The two manifest formats cannot coexist in one package, so
# we emit one zip per platform family from the same app/ source. The manifest
# MUST be at the root of the zip (no parent folder), so we zip from inside app/.
set -euo pipefail

BUILD_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$BUILD_DIR/.." && pwd)"

OUT_25="$BUILD_DIR/application-2.5.zip"
OUT_3="$BUILD_DIR/application-3.zip"
# Backwards-compatible alias for the KaiOS 2.5 package.
OUT_ALIAS="$BUILD_DIR/application.zip"

# Files/dirs shared by both packages (everything except the manifests).
SHARED=(index.html css js icons)

rm -f "$OUT_25" "$OUT_3" "$OUT_ALIAS"

cd "$ROOT/app"

# KaiOS 2.5 package (manifest.webapp).
zip -r -q "$OUT_25" \
  manifest.webapp \
  "${SHARED[@]}" \
  -x '*/.DS_Store'
cp "$OUT_25" "$OUT_ALIAS"

# KaiOS 3.0/3.1/4.0 package (manifest.webmanifest).
zip -r -q "$OUT_3" \
  manifest.webmanifest \
  "${SHARED[@]}" \
  -x '*/.DS_Store'

echo "Built $OUT_25 (KaiOS 2.5)"
unzip -l "$OUT_25"
echo
echo "Built $OUT_3 (KaiOS 3.0/3.1/4.0)"
unzip -l "$OUT_3"
