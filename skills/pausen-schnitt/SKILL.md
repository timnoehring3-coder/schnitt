---
name: pausen-schnitt
description: Wie schnitt aus einer Rohaufnahme mit vielen Versuchen einen Zusammenschnitt ohne Sprechpausen macht — Begriffe, Dateien, Regeln, typische Fehlerbilder. Lesen vor /schnitt:neu, /schnitt:schnitt und bei jeder Frage zu Takes, Nähten oder Untertiteln.
---

# Pausen-Schnitt

## Begriffe
- **Block**: ein Sprechabschnitt zwischen Pausen ≥ 200 ms (Energie-Hysterese: ein bei Rauschboden +12 dB, aus bei +8 dB; kürzer als 250 ms verworfen).
- **Versuch (V#)**: ein Anlauf eines Satzes auf Wortebene; ein Block kann mehrere Versuche enthalten (Neuansatz ohne Pause).
- **Satzgruppe (S#)**: alle Versuche desselben Satzes (Ähnlichkeit der Wortmengen und des Satzanfangs). Je Gruppe wird ein Versuch gewählt: vollständig gegenüber dem Konsens der Gruppe, ohne Stottern, ohne Zuruf wie „nochmal“; „geht doch“ oder „passt“ im Anschluss wertet auf.
- **Segment**: der geschnittene Quellbereich eines Versuchs mit Ein- und Ausstiegskante in Frames.
- **Naht**: Übergang zwischen zwei Segmenten im Ergebnis.

## Härte (`cut-profile.json → seam.haerte`)
- `hart` (Standard, gemessen am Handschnitt des Autors): Einstieg 1 Frame nach dem Energie-Anlaut, Ausstieg im Ausklang 25 dB unter dem Wortgipfel, Korridor 0–80 ms Stille je Naht, keine Atemzüge. Ergebnis: schlag auf schlag.
- `weich`: 2 Frames Vorlauf, 3 Frames Nachlauf, Korridor 100–220 ms, Atem-Bursts vor der Naht abgeschnitten. Für ruhigere Formate.
- Nähte **innerhalb** eines Blocks (Neuansatz ohne Pause) heißen „harte Nähte“ und werden nicht gegen den Korridor gemessen.

## Dateien der Bühne (`~/schnitt-projekte/<id>/`)
`project.json` (Schritte, Quelle) · `blocks.json` · `words-src.json` (Wörter mit Quellzeiten, Text von Whisper, Zeit aus Energie) · `selects.json` (Gruppen, Versuche, `enabled`, `order`, `segments`, `locked`) · `cut-map.json` (Quelle→Ziel je Segment) · `words-frames.json` · `check/seams.json` (Messung) · `chin.json` · `texte.json` (Ein-Wort-Seiten) · `media/camera.mp4` · `out/final.mp4`.
Alle Zahlen in `engine/cut/profile.default.json`; `cut-profile.json` im Projekt überschreibt einzelne Felder.

## Regeln
1. Die Engine entscheidet deterministisch, nie du. Du änderst `selects.json` nur auf konkrete Anweisung (Gruppe + Versuch) und setzt dann `seams`/`cut` mit `--force` neu.
2. `locked: true` an einem Versuch heißt Hand-Kanten aus dem Dashboard — nie überschreiben.
3. Untertitel: genau ein Wort, weiß, unter dem Kinn. Kein anderer Stil.
4. Namen: falsch gehörte Produktnamen in `names.json` eintragen, dann ab `asr` neu.
5. Nie etwas rendern oder exportieren, das der Nutzer nicht verlangt hat; nie hochladen.

## Fehlerbilder
- **Viele kurze Gruppen „zu kurz“**: normal — Zurufe und Fehlstarts.
- **Ein Satz fehlt ganz**: Gruppe hat nur verworfene Versuche → im Dashboard einen Versuch „an“ schalten.
- **Wort an der Naht abgeschnitten**: `--weich` probieren oder Kante im Dashboard um 1–3 Frames schieben.
- **Whisper hört Namen falsch** („Cloud“ statt „Claude“): `names.json`.
- **Render bricht mit `fontFamily`/`null`**: `montage.json` löschen und `render --force`.
