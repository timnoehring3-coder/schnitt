#!/usr/bin/env bash
# ensure.sh — stellt vor jedem Arbeitsschritt sicher, dass die Engine eingerichtet ist. Still, wenn alles passt;
# sonst läuft setup.sh. Damit installiert sich schnitt beim ersten Gebrauch von selbst.
ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
CFG="$HOME/.config/schnitt"
VER=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$ROOT/.claude-plugin/plugin.json" | head -1)
INST=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$CFG/installed.json" 2>/dev/null | head -1)
NODE22=/opt/homebrew/opt/node@22/bin/node; [ -x "$NODE22" ] || NODE22=/usr/local/opt/node@22/bin/node
if [ "$INST" = "$VER" ] && command -v ffmpeg >/dev/null && command -v whisper-cli >/dev/null && [ -x "$NODE22" ] \
   && [ -d "$ROOT/remotion/node_modules/remotion" ] && [ -s "$ROOT/dashboard/dist/index.html" ]; then
  exit 0
fi
echo "schnitt $VER ist noch nicht eingerichtet — Einrichtung läuft jetzt (einmalig, je nach Netz 5–20 Minuten)."
exec bash "$ROOT/tools/install/setup.sh"
