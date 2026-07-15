#!/usr/bin/env bash
# Package the app into build/application.zip for KaiOS sideloading.
# The manifest MUST be at the root of the zip (no parent folder), so we zip
# from inside the app/ directory.
set -euo pipefail

BUILD_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$BUILD_DIR/.." && pwd)"
OUT="$BUILD_DIR/application.zip"

rm -f "$OUT"

cd "$ROOT/app"
zip -r -q "$OUT" \
  manifest.webapp \
  index.html \
  css \
  js \
  icons \
  -x '*/.DS_Store'

echo "Built $OUT"
unzip -l "$OUT"
