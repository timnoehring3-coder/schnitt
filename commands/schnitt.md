---
description: Nähte setzen und den Kamera-Schnitt bauen (camera.mp4), danach Nahtbericht
argument-hint: <projekt> [--weich]
allowed-tools: ["Bash", "Read"]
---

# /schnitt:schnitt $ARGUMENTS

1. Optional `--weich`: schreibe `{ "seam": { "haerte": "weich" } }` nach `<projektdir>/cut-profile.json` (Standard ist `hart`, siehe `${CLAUDE_PLUGIN_ROOT}/docs/REGELWERK.md`).
2. `node "${CLAUDE_PLUGIN_ROOT}/engine/cli.mjs" run <projekt> --bis cut` — führt fehlende Schritte aus (Nähte, Schnitt). Für einen Neuaufbau nach Änderungen an `selects.json`: `seams` und `cut` einzeln mit `--force`.
3. Lies `<projektdir>/check/seams.json` und berichte in drei Zeilen: Länge und Tempo (WPM), Nähte im Korridor, Stille gesamt. Jede Naht außerhalb des Korridors mit Frame und Blockpaar nennen.
4. Ergebnis liegt in `<projektdir>/media/camera.mp4`. Nächster Schritt: `/schnitt:untertitel` oder direkt `/schnitt:render`.
