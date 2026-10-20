# schnitt (Arbeitsname)

Automatischer Shorts-Schnitt als Claude-Code-Plugin mit lokalem Dashboard: Pausen raus, Takes wählen,
Untertitel, Motion-Graphics, Render — alles auf deinem Mac, nichts verlässt den Rechner.

## Installation

Eine Zeile im Terminal — installiert Homebrew-Werkzeuge, Claude Code (falls nötig), das Plugin und die Engine:

```
curl -fsSL https://raw.githubusercontent.com/timnoehring3-coder/schnitt/main/tools/install/install.sh | bash
```

Oder in Claude Code; die Engine richtet sich beim ersten Aufruf von selbst ein:

```
/plugin marketplace add timnoehring3-coder/schnitt
/plugin install schnitt@schnitt
/schnitt:lizenz <KEY>
```

Ausführlich in `docs/INSTALL.md`. Lizenz: Quellcode einsehbar (PolyForm Noncommercial), Nutzung mit Schlüssel.

## Aufbau

- `engine/` — Node-22-Engine. Eine CLI (`engine/cli.mjs`), die Dashboard und Claude gleichermaßen rufen.
- `remotion/` — Grafik-Kit und Montage-Komposition (Phase 2).
- `dashboard/` — lokales Web-Dashboard (Vite + React).
- `commands/`, `agents/`, `skills/`, `hooks/` — das Claude-Code-Plugin.
- `tools/` — Installer, Swift-Werkzeuge (Apple Vision), Schriften.
- `cloud/web/` — Landingpage, Stripe-Checkout, Lizenzserver (signierte Schlüssel, Geräte in Stripe-Kundenmetadaten).
- `docs/` — Installation, Regelwerk, Bühnenformat.

## Engine, kurz

```
node engine/cli.mjs neu <quelle.mov> [--name X] [--typ roh|fertig]
node engine/cli.mjs run <projekt> [--bis cut]
node engine/cli.mjs status <projekt>
```

Schritte: `analyse → blocks → asr → takes → seams → cut → chin → untertitel → render`.
Testkorpus: `node engine/test/match-cut.mjs <roh> <handschnitt> <ref.json>` und
`node engine/test/corpus.mjs <projekt> <ref.json>`.
