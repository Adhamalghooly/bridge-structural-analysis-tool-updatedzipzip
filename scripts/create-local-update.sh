#!/usr/bin/env bash
set -euo pipefail

OUT="${1:-artifacts/StructuralMaster-local-update.zip}"

npm run build >/dev/null
mkdir -p "$(dirname "$OUT")"
rm -f "$OUT"

# The archive root must contain index.html directly. The Android updater
# validates this before activating the local web bundle.
(cd dist && zip -qr "../$OUT" .)
echo "Created local update package: $OUT"