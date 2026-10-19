#!/usr/bin/env bash
# session-start.sh — eine Zeile Kontext für Claude: Version, Lizenz, Engine. Kein Netz.
set -u
ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
CFG="$HOME/.config/schnitt"
VER=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$ROOT/.claude-plugin/plugin.json" | head -1)
INST=$(cat "$CFG/installed.json" 2>/dev/null | sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' | head -1)
LIC="keine Lizenz — /schnitt:lizenz <KEY>"
if [ -f "$CFG/license.json" ]; then
  ST=$(sed -n 's/.*"status": *"\([^"]*\)".*/\1/p' "$CFG/license.json" | head -1)
  EXP=$(sed -n 's/.*"expiresAt": *"\([^"]*\)".*/\1/p' "$CFG/license.json" | head -1)
  case "$ST" in
    active) LIC="Lizenz aktiv${EXP:+ bis ${EXP%%T*}}" ;;
    *) LIC="Lizenz: $ST — /schnitt:lizenz prüfen" ;;
  esac
fi
if [ -z "$INST" ]; then
  ENG="Engine nicht eingerichtet — /schnitt:setup ausführen"
elif [ "$INST" != "$VER" ]; then
  ENG="Engine $INST, Plugin $VER — /schnitt:setup erneut ausführen"
else
  ENG="Engine ok"
fi
echo "schnitt $VER · $LIC · $ENG · Projekte: ~/schnitt-projekte/"
