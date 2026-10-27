#!/bin/sh
CDPATH= cd -- "$(dirname -- "$0")" || exit 1
PATH="$PWD/.tools/bin:$PATH"
export PATH
export npm_config_cache="$PWD/.cache/npm"
export npm_config_userconfig="$PWD/.cache/npmrc"

if [ ! -d /Applications/Xcode.app/Contents/Developer ]; then
  echo "Once App Store'dan Xcode kurulumunu tamamlayin."
  echo "https://apps.apple.com/app/xcode/id497799835"
  read -r answer
  exit 1
fi
# Select Xcode for this process only; don't alter the system developer directory.
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js 22.12+ ve npm gerekli: https://nodejs.org/en/download"
  read -r answer
  exit 1
fi
if [ ! -f node_modules/@capacitor/cli/bin/capacitor ]; then
  npm ci || exit 1
fi
echo "Oyun iPhone projesine aktariliyor. Apple hesabi ve cihaz secimi Xcode'da yapilir."
npm run ios:sync || exit 1
npm run ios:open
