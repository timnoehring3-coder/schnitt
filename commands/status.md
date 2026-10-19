---
description: Projekte und ihren Stand auflisten
argument-hint: [projekt]
allowed-tools: ["Bash", "Read"]
---

# /schnitt:status $ARGUMENTS

Ohne Argument `node "${CLAUDE_PLUGIN_ROOT}/engine/cli.mjs" liste`, mit Projekt `… status <projekt>`. Zeige je Projekt: Quelle (roh/fertig, Länge), erledigte Schritte mit ihrer Zusammenfassung, nächster offener Schritt und der passende Command.
