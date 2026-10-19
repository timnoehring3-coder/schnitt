---
description: Prüft Werkzeuge, Modell, Remotion, Dashboard, Lizenz — repariert nichts
allowed-tools: ["Bash"]
---

# /schnitt:doctor

`node "${CLAUDE_PLUGIN_ROOT}/engine/cli.mjs" doctor` — zeige die Zeilen als Tabelle (Name, Stand, Abhilfe). Bei Problemen die `fix`-Spalte als nächsten Schritt nennen; `yt-dlp` und die Swift-Tools sind optional.
