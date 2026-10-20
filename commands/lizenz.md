---
description: Lizenzschlüssel aktivieren, Status zeigen oder Gerät abmelden
argument-hint: <KEY> | status | abmelden
allowed-tools: ["Bash"]
---

# /schnitt:lizenz $ARGUMENTS

- Schlüssel übergeben (beginnt mit `SCHNITT-`) → `node "${CLAUDE_PLUGIN_ROOT}/engine/cli.mjs" lizenz aktivieren <KEY>`
- `status` → `… lizenz status` (prüft höchstens einmal je 24 h online, 14 Tage Offline-Grace)
- `abmelden` → `… lizenz abmelden` (gibt das Gerät frei; zwei Geräte je Schlüssel)

Die Signatur des Schlüssels prüft die Engine offline, Abo-Stand und Geräte der Lizenzserver. Den Schlüssel nie in
Dateien außerhalb von `~/.config/schnitt/license.json` ablegen und nie in Antworten wiederholen.
