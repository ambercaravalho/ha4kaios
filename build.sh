#!/usr/bin/env bash
# Package the app into application.zip for KaiOS sideloading.
# The manifest MUST be at the root of the zip (no parent folder).
set -euo pipefail

OUT="application.zip"
cd "$(dirname "$0")"

rm -f "$OUT"

zip -r -q "$OUT" \
  manifest.webapp \
  index.html \
  css \
  js \
  icons \
  -x '*/.DS_Store'

echo "Built $OUT"
unzip -l "$OUT"
