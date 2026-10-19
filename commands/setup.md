---
description: schnitt einrichten — Werkzeuge, Whisper-Modell, Remotion, Dashboard, Swift-Tools (idempotent)
allowed-tools: ["Bash", "Read"]
---

# /schnitt:setup

Richtet alles ein, was die Engine braucht. Läuft mehrfach ohne Schaden; abgebrochene Läufe setzen fort.

1. Führe aus und zeige die Ausgabe vollständig:
   ```
   bash "${CLAUDE_PLUGIN_ROOT}/tools/install/setup.sh"
   ```
2. Danach `node "${CLAUDE_PLUGIN_ROOT}/engine/cli.mjs" doctor` — jede Zeile mit `ok:false` dem Nutzer als Aufgabe nennen, mit dem `fix`-Text.
3. Fehlt die Lizenz, auf `/schnitt:lizenz <KEY>` hinweisen. Ohne Lizenz laufen Analyse und Takes, aber nicht Schnitt und Render.

Keine Schritte erfinden, nichts außerhalb von `~/.config/schnitt` und dem Plugin-Ordner schreiben.
