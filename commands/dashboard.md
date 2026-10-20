---
description: Lokales Dashboard starten (Take-Picker, Nahtbericht, Vorschau)
allowed-tools: ["Bash"]
---

# /schnitt:dashboard

0. `bash "${CLAUDE_PLUGIN_ROOT}/tools/install/ensure.sh"` — still, wenn alles eingerichtet ist; sonst läuft die Einrichtung (Homebrew-Werkzeuge, Whisper-Modell, Remotion) einmalig durch. Ausgabe zeigen, dann weiter.

Starte den Server im Hintergrund und öffne den Browser:
```
node "${CLAUDE_PLUGIN_ROOT}/engine/cli.mjs" serve --port 4747
```
Er lauscht nur auf 127.0.0.1 und endet mit der Sitzung. Läuft er schon (Port belegt), nur `open http://127.0.0.1:4747`.
Im Dashboard wählt der Nutzer Versuche, verschiebt Kanten frameweise und klickt „Schnitt bauen“ — das schreibt `selects.json` und ruft dieselbe Engine wie du.
