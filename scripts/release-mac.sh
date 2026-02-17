#!/usr/bin/env bash
set -euo pipefail

if [[ "${OSTYPE:-}" != darwin* ]]; then
  echo "[MyVoice] macOS release packaging must run on macOS." >&2
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

if ! security find-identity -v -p codesigning | grep -q "Developer ID Application"; then
  echo "[MyVoice] Missing Developer ID Application certificate in keychain." >&2
  echo "[MyVoice] Install your Developer ID Application cert and retry." >&2
  exit 1
fi

has_api_key_notarization=false
if [[ -n "${APPLE_API_KEY:-}" && -n "${APPLE_API_KEY_ID:-}" && -n "${APPLE_API_ISSUER:-}" ]]; then
  has_api_key_notarization=true
fi

has_apple_id_notarization=false
if [[ -n "${APPLE_ID:-}" && -n "${APPLE_APP_SPECIFIC_PASSWORD:-}" && -n "${APPLE_TEAM_ID:-}" ]]; then
  has_apple_id_notarization=true
fi

if [[ "$has_api_key_notarization" != true && "$has_apple_id_notarization" != true ]]; then
  echo "[MyVoice] Missing notarization credentials." >&2
  echo "[MyVoice] Provide either:" >&2
  echo "  - APPLE_API_KEY + APPLE_API_KEY_ID + APPLE_API_ISSUER" >&2
  echo "  - APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID" >&2
  exit 1
fi

default_output="${TMPDIR:-/tmp}myvoice-release-signed"
output_dir="${MYVOICE_RELEASE_OUTPUT:-$default_output}"

mkdir -p "$output_dir"

echo "[MyVoice] Building release DMG (signed + notarized)"
echo "[MyVoice] Output directory: $output_dir"

electron-builder --mac --config.directories.output="$output_dir"

app_path="$(find "$output_dir" -maxdepth 2 -type d -name 'MyVoice.app' | head -n 1)"
if [[ -z "$app_path" ]]; then
  echo "[MyVoice] Could not locate built app bundle for stapling/verification." >&2
  exit 1
fi

echo "[MyVoice] Stapling notarization ticket"
xcrun stapler staple "$app_path"

echo "[MyVoice] Verifying Gatekeeper acceptance"
spctl -a -vv "$app_path"

echo "[MyVoice] Release build complete"
find "$output_dir" -maxdepth 1 -name '*.dmg' -print
