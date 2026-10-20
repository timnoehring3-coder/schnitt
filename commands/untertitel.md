---
description: Kinnhöhe je Segment messen und Ein-Wort-Untertitel aus dem Transkript bauen
argument-hint: <projekt>
allowed-tools: ["Bash", "Read"]
---

# /schnitt:untertitel $ARGUMENTS

0. `bash "${CLAUDE_PLUGIN_ROOT}/tools/install/ensure.sh"` — still, wenn alles eingerichtet ist; sonst läuft die Einrichtung (Homebrew-Werkzeuge, Whisper-Modell, Remotion) einmalig durch. Ausgabe zeigen, dann weiter.

1. `node "${CLAUDE_PLUGIN_ROOT}/engine/cli.mjs" run <projekt> --bis untertitel` (braucht `media/camera.mp4`).
2. Lies `<projektdir>/texte.json`. Prüfe die Schreibweise der Wörter gegen das Thema des Videos (Produktnamen, Eigennamen). Falsch gehörte Namen trägst du in `<projektdir>/names.json` ein (`{"gehört": "Gemeint"}`), dann `asr`, `takes`, `seams`, `cut`, `untertitel` mit `--force` erneut — sag dem Nutzer vorher, dass das etwa drei Minuten dauert.
3. Untertitel sind IMMER genau ein Wort, weiß, unter dem Kinn. Keine Zeilen, kein Karaoke — das ist Absicht, nicht ändern.
