#!/usr/bin/env bash
# Check Android emulator toolchain for WSL + Windows Android Studio.
set -euo pipefail

SDK="/mnt/c/Users/david/AppData/Local/Android/Sdk"
ADB="$SDK/platform-tools/adb.exe"
EMU="$SDK/emulator/emulator.exe"
AVD_DIR="/mnt/c/Users/david/.android/avd"

echo "=== MentorForge Android dev setup (WSL → Windows SDK) ==="
echo "ANDROID_HOME=${ANDROID_HOME:-<not set>}"
echo

missing=0

for bin in "$ADB" "$EMU"; do
  if [[ -x "$bin" ]]; then
    echo "OK  $bin"
  else
    echo "MISSING  $bin"
    missing=1
  fi
done

if [[ -d "$SDK/system-images" ]]; then
  echo "OK  system-images installed:"
  find "$SDK/system-images" -maxdepth 3 -type d | head -10
else
  echo "MISSING  system-images (no emulator OS image downloaded yet)"
  missing=1
fi

echo
echo "AVDs:"
if "$EMU" -list-avds 2>/dev/null | grep -q .; then
  "$EMU" -list-avds
else
  echo "  (none — create one in Android Studio → Device Manager)"
  missing=1
fi

echo
echo "Connected devices:"
"$ADB" devices

echo
if [[ "$missing" -ne 0 ]]; then
  echo "Next steps in Android Studio (Windows):"
  echo "  1. Settings → Android SDK → SDK Platforms"
  echo "     Show Package Details → pick a release (e.g. API 34/35)"
  echo "     → check \"Google Play Intel x86_64 Atom System Image\" → Apply"
  echo "  2. SDK Tools tab → ensure \"Android Emulator\" is checked → Apply"
  echo "  3. Device Manager → Create Device → pick phone → pick that image → Finish"
  echo "  4. Start the emulator from Device Manager (Play button)"
  echo "  5. In WSL: ./scripts/android-dev-setup.sh  (should list emulator-5554)"
  echo "  6. npx eas build:run -p android --id 704fb86c-1080-4306-bf86-ed9d1a4c5520"
  exit 1
fi

echo "Toolchain looks ready. Start an AVD if adb devices is empty."
