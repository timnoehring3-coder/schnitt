# Installation

Voraussetzungen: macOS 14 oder neuer auf Apple Silicon oder Intel, Claude Code, Homebrew, etwa 4 GB freier Platz
(Whisper-Modell 1,6 GB, Remotion mit Headless-Chrome rund 600 MB).

## In Claude Code

```
/plugin marketplace add timnoehring3-coder/schnitt-marketplace
/plugin install schnitt
/schnitt:setup
/schnitt:lizenz <DEIN-SCHLÜSSEL>
```

`/schnitt:setup` installiert über Homebrew `ffmpeg`, `whisper-cpp`, `node@22`, `yt-dlp`, lädt das Whisper-Modell nach
`~/.config/schnitt/models/`, installiert Remotion, kompiliert die Apple-Vision-Werkzeuge nach `~/.config/schnitt/bin/`
und baut das Dashboard. Der Lauf ist wiederholbar; ein abgebrochener Download wird fortgesetzt.

## Erstes Video

```
/schnitt:neu ~/Movies/aufnahme.mov
/schnitt:dashboard
/schnitt:render aufnahme
```

Das Ergebnis liegt in `~/schnitt-projekte/aufnahme/out/final.mp4`. Projekte lassen sich mit `SCHNITT_PROJEKTE=…`
an einen anderen Ort legen.

## Ohne Claude Code

Die Engine ist eine normale CLI:

```
node engine/cli.mjs neu <aufnahme> [--name X] [--typ fertig]
node engine/cli.mjs run <projekt> [--bis <schritt>]
node engine/cli.mjs serve
node engine/cli.mjs doctor
```

## Fehlerbilder

| Meldung | Ursache | Abhilfe |
|---|---|---|
| `node@22 nicht gefunden` | Remotion braucht Node 22, `node` ist neuer | `brew install node@22`, Pfad bleibt intern |
| `Whisper-Modell fehlt` | Download abgebrochen | `/schnitt:setup` erneut |
| `swiftc fehlt` | Xcode Command Line Tools fehlen | `xcode-select --install`, dann setup |
| `braucht eine gültige Lizenz` | kein Schlüssel oder 14 Tage offline | `/schnitt:lizenz <KEY>` |
| Render bricht mit `Cannot read properties of null` | kaputte `montage.json` | Datei löschen, `render --force` |
