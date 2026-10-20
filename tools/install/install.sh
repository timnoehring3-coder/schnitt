#!/usr/bin/env bash
# install.sh — Ein-Zeilen-Installation für Nutzer:
#   curl -fsSL https://raw.githubusercontent.com/timnoehring3-coder/schnitt/main/tools/install/install.sh | bash
# Macht: Homebrew prüfen, Claude Code installieren (falls fehlt), Marketplace + Plugin registrieren, Engine einrichten.
set -u
REPO="timnoehring3-coder/schnitt"
say() { printf '\n== %s\n' "$*"; }

[ "$(uname -s)" = "Darwin" ] || { echo "schnitt läuft in Version 1 nur auf macOS."; exit 1; }

say "Homebrew"
if command -v brew >/dev/null 2>&1; then echo "  vorhanden"
else
  echo "  fehlt — Homebrew wird installiert (fragt nach deinem Mac-Passwort)"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" </dev/tty || { echo "Homebrew-Installation abgebrochen"; exit 1; }
  [ -x /opt/homebrew/bin/brew ] && eval "$(/opt/homebrew/bin/brew shellenv)"
  [ -x /usr/local/bin/brew ] && eval "$(/usr/local/bin/brew shellenv)"
fi

say "Claude Code"
if command -v claude >/dev/null 2>&1; then echo "  vorhanden: $(claude --version 2>/dev/null | head -1)"
else
  echo "  fehlt — wird installiert"
  curl -fsSL https://claude.ai/install.sh | bash || { echo "Claude-Code-Installation fehlgeschlagen — siehe https://docs.anthropic.com/claude-code"; exit 1; }
  export PATH="$HOME/.local/bin:$PATH"
  command -v claude >/dev/null 2>&1 || { echo "claude nicht im PATH — Terminal neu öffnen und install.sh erneut ausführen"; exit 1; }
fi

say "Plugin registrieren"
if claude plugin marketplace list 2>/dev/null | grep -q "$REPO"; then echo "  Marketplace vorhanden"; claude plugin marketplace update schnitt >/dev/null 2>&1 || true
else claude plugin marketplace add "$REPO" || { echo "Marketplace konnte nicht hinzugefügt werden"; exit 1; }; fi
if claude plugin list 2>/dev/null | grep -q "schnitt@schnitt"; then echo "  Plugin vorhanden"; claude plugin update schnitt@schnitt >/dev/null 2>&1 || true
else claude plugin install schnitt@schnitt || { echo "Plugin-Installation fehlgeschlagen"; exit 1; }; fi

say "Engine einrichten"
ROOT=$(find "$HOME/.claude/plugins" -maxdepth 6 -path '*schnitt*' -name plugin.json 2>/dev/null | grep '/\.claude-plugin/plugin.json$' | head -1 | xargs -I{} dirname {} | xargs -I{} dirname {})
[ -n "$ROOT" ] && [ -f "$ROOT/tools/install/setup.sh" ] || { echo "  Plugin-Ordner nicht gefunden — in Claude Code /schnitt:setup ausführen"; exit 1; }
CLAUDE_PLUGIN_ROOT="$ROOT" bash "$ROOT/tools/install/setup.sh" </dev/tty || exit 1

say "fertig"
echo "  Starte 'claude' in einem Ordner deiner Wahl und tippe:"
echo "    /schnitt:lizenz <DEIN-SCHLÜSSEL>"
echo "    /schnitt:neu ~/Movies/aufnahme.mov"
