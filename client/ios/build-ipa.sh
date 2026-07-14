#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
ARCHIVE_PATH="$PROJECT_DIR/build/Canary.xcarchive"
OUTPUT_DIR="$PROJECT_DIR/build"
IPA_PATH="$OUTPUT_DIR/Canary.ipa"

rm -rf "$ARCHIVE_PATH" "$IPA_PATH"
mkdir -p "$OUTPUT_DIR"

echo "==> Archiving..."
xcodebuild archive \
  -project "$PROJECT_DIR/Canary.xcodeproj" \
  -scheme Canary \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE_PATH" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  -quiet

APP_PATH=$(find "$ARCHIVE_PATH/Products/Applications" -name "*.app" -maxdepth 1 | head -1)
if [ -z "$APP_PATH" ]; then
  echo "Error: .app not found in archive"
  exit 1
fi

echo "==> Ad-hoc signing to embed entitlements..."
APPEX_PATH=$(find "$APP_PATH/PlugIns" -name "*.appex" -maxdepth 1 | head -1)
if [ -n "$APPEX_PATH" ]; then
  codesign --force --sign - \
    --entitlements "$PROJECT_DIR/CanaryWidget/CanaryWidget.entitlements" \
    "$APPEX_PATH"
  echo "    Signed widget extension"
fi
codesign --force --sign - \
  --entitlements "$PROJECT_DIR/Canary/Canary.entitlements" \
  "$APP_PATH"
echo "    Signed main app"

echo "==> Creating .ipa..."
PAYLOAD_DIR="$OUTPUT_DIR/Payload"
rm -rf "$PAYLOAD_DIR"
mkdir -p "$PAYLOAD_DIR"
cp -R "$APP_PATH" "$PAYLOAD_DIR/"

cd "$OUTPUT_DIR"
zip -r -q Canary.ipa Payload
rm -rf Payload

echo "==> Done: $IPA_PATH"
ls -lh "$IPA_PATH"
