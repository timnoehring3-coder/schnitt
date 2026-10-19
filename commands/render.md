---
description: Fertiges Video rendern (Remotion, 1080×1920, H.264)
argument-hint: <projekt>
allowed-tools: ["Bash", "Read"]
---

# /schnitt:render $ARGUMENTS

1. `node "${CLAUDE_PLUGIN_ROOT}/engine/cli.mjs" run <projekt>` — rendert alles Fehlende bis `out/final.mp4`. Ein Render von 70 s dauert auf einem M-Mac etwa 2–3 Minuten; melde den Fortschritt.
2. Prüfe mit `ffprobe -v error -show_entries format=duration:stream=width,height -of csv=p=0 "<projektdir>/out/final.mp4"`, dass Länge und 1080×1920 stimmen.
3. Nenne dem Nutzer den vollständigen Pfad. Nie automatisch irgendwohin hochladen.
