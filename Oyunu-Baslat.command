#!/bin/sh
# macOS: open this file to build and serve the game in the default browser.
CDPATH= cd -- "$(dirname -- "$0")" || exit 1
PATH="$PWD/.tools/bin:$PATH"
export PATH
export npm_config_cache="$PWD/.cache/npm"
export npm_config_userconfig="$PWD/.cache/npmrc"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js 22.12+ ve npm gerekli. Kurduktan sonra tekrar acin."
  echo "https://nodejs.org/en/download"
  read -r answer
  exit 1
fi

if [ ! -f node_modules/vite/bin/vite.js ]; then
  npm ci || exit 1
fi

echo "Neon Defender hazirlaniyor. Terminali acik tutun; durdurmak icin Ctrl+C."
npm run play
result=$?
if [ "$result" -ne 0 ] && [ "$result" -ne 130 ]; then
  echo "Oyun baslatilamadi. Yukaridaki hata mesajini kontrol edin."
  echo "5176 portu kullanimdaysa mevcut sunucuya dokunulmaz."
  read -r answer
fi
exit "$result"
