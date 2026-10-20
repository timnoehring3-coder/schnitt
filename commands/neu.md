---
description: Neues Projekt aus einer Aufnahme anlegen und die Kette bis zu den Takes laufen lassen
argument-hint: <pfad-zur-aufnahme> [--name X] [--fertig]
allowed-tools: ["Bash", "Read"]
---

# /schnitt:neu $ARGUMENTS

0. `bash "${CLAUDE_PLUGIN_ROOT}/tools/install/ensure.sh"` — still, wenn alles eingerichtet ist; sonst läuft die Einrichtung (Homebrew-Werkzeuge, Whisper-Modell, Remotion) einmalig durch. Ausgabe zeigen, dann weiter.

Lies zuerst `${CLAUDE_PLUGIN_ROOT}/skills/pausen-schnitt/SKILL.md`.

1. `node "${CLAUDE_PLUGIN_ROOT}/engine/cli.mjs" neu "<pfad>" [--name X] [--typ fertig]` — `--typ fertig`, wenn der Nutzer sagt, das Video sei schon geschnitten (`--fertig`). Die letzte Zeile `@@RESULT …` enthält `id`.
2. `node "${CLAUDE_PLUGIN_ROOT}/engine/cli.mjs" run <id> --bis takes` — läuft Analyse, Blöcke, Transkript (dauert bei 8 Minuten Rohmaterial etwa 3 Minuten) und Takes. Fortschritt steht auf stdout als `@@PROGRESS`.
3. Lies `<projektdir>/selects.json` und fasse zusammen: wie viele Satzgruppen, welche Versuche gewählt (`enabled`), Gesamtlänge. Nenne Gruppen mit `skipped` und Versuche mit `reason`.
4. Biete an: Takes im Dashboard prüfen (`/schnitt:dashboard`) oder direkt `/schnitt:schnitt <id>`.

Nie Versuche „nach Gefühl“ umwählen — die Wahl ändert der Nutzer im Dashboard oder nennt dir konkret Gruppe und Versuch; dann setzt du `enabled` in `selects.json` und sagst, was du geändert hast.
