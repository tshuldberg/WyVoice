#!/usr/bin/env bash
set -euo pipefail

if [[ "${OSTYPE:-}" != darwin* ]]; then
  echo "[MyVoice] macOS packaging must run on macOS." >&2
  exit 1
fi

if [[ -n "${MYVOICE_CODESIGN_ID:-}" ]]; then
  if ! security find-identity -v -p codesigning | grep -q "$MYVOICE_CODESIGN_ID"; then
    echo "[MyVoice] Signing identity hash not found: $MYVOICE_CODESIGN_ID" >&2
    exit 1
  fi
  export CSC_NAME="$MYVOICE_CODESIGN_ID"
  echo "[MyVoice] Using signing identity: $MYVOICE_CODESIGN_ID"
fi

default_output="${TMPDIR:-/tmp}myvoice-release"
output_dir="${MYVOICE_RELEASE_OUTPUT:-$default_output}"

mkdir -p "$output_dir"

echo "[MyVoice] Packaging macOS app"
echo "[MyVoice] Output directory: $output_dir"

electron-builder --mac --config.directories.output="$output_dir"

echo "[MyVoice] Build complete"
find "$output_dir" -maxdepth 1 -name '*.dmg' -print
