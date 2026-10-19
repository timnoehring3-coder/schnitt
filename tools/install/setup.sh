#!/usr/bin/env bash
# setup.sh — richtet schnitt auf einem Mac ein. Idempotent: jeder Schritt prüft erst, ob er nötig ist.
set -u
ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
CFG="$HOME/.config/schnitt"; mkdir -p "$CFG/models" "$CFG/bin"
MODEL="${SCHNITT_MODEL:-ggml-large-v3-turbo.bin}"
say() { printf '\n== %s\n' "$*"; }
fail=0

say "Homebrew"
if ! command -v brew >/dev/null 2>&1; then echo "Homebrew fehlt — bitte zuerst https://brew.sh installieren, dann setup erneut."; exit 1; fi

say "Werkzeuge (ffmpeg, whisper-cpp, node@22, yt-dlp)"
for f in ffmpeg whisper-cpp node@22 yt-dlp; do
  if brew list --versions "$f" >/dev/null 2>&1; then echo "  $f vorhanden"; else echo "  installiere $f …"; brew install "$f" || fail=1; fi
done
NODE22=/opt/homebrew/opt/node@22/bin/node; [ -x "$NODE22" ] || NODE22=/usr/local/opt/node@22/bin/node
[ -x "$NODE22" ] || { echo "  node@22 nicht gefunden"; fail=1; }

say "Xcode Command Line Tools (swiftc für Apple Vision)"
if xcode-select -p >/dev/null 2>&1 && command -v swiftc >/dev/null 2>&1; then echo "  vorhanden"; else echo "  fehlt — es öffnet sich der Installer; danach setup erneut."; xcode-select --install 2>/dev/null || true; fail=1; fi

say "Whisper-Modell $MODEL"
if [ -s "$CFG/models/$MODEL" ]; then echo "  vorhanden"
elif [ -s "$HOME/whisper-models/$MODEL" ]; then ln -sf "$HOME/whisper-models/$MODEL" "$CFG/models/$MODEL"; echo "  verknüpft aus ~/whisper-models"
else
  echo "  lade (1,6 GB) …"
  curl -L --progress-bar -o "$CFG/models/$MODEL.part" "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/$MODEL" && mv "$CFG/models/$MODEL.part" "$CFG/models/$MODEL" || { echo "  Download fehlgeschlagen"; fail=1; }
fi

say "Remotion (npm, node@22)"
if [ -d "$ROOT/remotion/node_modules/remotion" ]; then echo "  vorhanden"; else (cd "$ROOT/remotion" && PATH="$(dirname "$NODE22"):$PATH" npm install --no-audit --no-fund --loglevel=error) || fail=1; fi
say "Headless-Chrome für Remotion"
(cd "$ROOT/remotion" && "$NODE22" -e 'import("@remotion/renderer").then(r=>r.ensureBrowser()).then(()=>console.log("  ok")).catch(e=>{console.error("  ",e.message);process.exit(1)})') || fail=1

say "Dashboard"
if [ -s "$ROOT/dashboard/dist/index.html" ]; then echo "  gebaut"; else (cd "$ROOT/dashboard" && npm install --no-audit --no-fund --loglevel=error && npm run build) || fail=1; fi

say "Swift-Werkzeuge"
for t in detect-chin person-cutout; do
  if [ -x "$CFG/bin/$t" ] && [ "$CFG/bin/$t" -nt "$ROOT/tools/swift/$t.swift" ]; then echo "  $t ok"
  elif command -v swiftc >/dev/null 2>&1; then echo "  kompiliere $t …"; swiftc -O -o "$CFG/bin/$t" "$ROOT/tools/swift/$t.swift" 2>&1 | tail -2 || fail=1
  else echo "  $t übersprungen (kein swiftc)"; fi
done

VER=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$ROOT/.claude-plugin/plugin.json" | head -1)
if [ "$fail" = 0 ]; then
  printf '{ "version": "%s", "at": "%s", "root": "%s" }\n' "$VER" "$(date -u +%FT%TZ)" "$ROOT" > "$CFG/installed.json"
  say "fertig — schnitt $VER eingerichtet. Nächster Schritt: /schnitt:lizenz <KEY>, dann /schnitt:neu <aufnahme>"
else
  say "unvollständig — oben die Zeilen ohne „ok/vorhanden“ beheben und setup erneut ausführen"
fi
exit $fail
