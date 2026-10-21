# Regelwerk — die Zahlen hinter dem Schnitt

Alle Werte stehen in `engine/cut/profile.default.json` und `remotion/src/kit/geometry.js`. Hier steht, warum.

## Sprache finden
- RMS in dBFS je 10 ms (Fenster 20 ms), Rauschboden = 20. Perzentil der Hops.
- Hysterese: Sprache beginnt bei Boden +12 dB, endet erst unter Boden +8 dB. Das hält leise Wortenden im Block.
- Lücken unter 200 ms gehören zum Satz; Blöcke unter 250 ms sind Klicks, Atmer, Zurufe.
- Takes: Blockgruppen mit mehr als 750 ms Abstand. Versuche werden feiner, auf Wortebene, erkannt: wiederholt sich der Satzanfang (Ähnlichkeit ≥ 0,7), beginnt ein neuer Versuch, auch ohne Pause.

## Wörter
- Whisper je Block mit 300 ms Kontext, ein Wort je Segment. Die Zeitstempel sind in kurzen Blöcken gedehnt und versetzt; sie werden nur übernommen, wenn die Whisper-Spanne (aus Wortanfängen, Ende auf das Blockende geklemmt) 0,7–1,3× der Energie-Spanne des Blocks deckt und monoton ist (hybrid) — dann zählt die Absolutzeit, auf den Block geklemmt; sonst Verteilung nach Zeichengewicht. In beiden Fällen rasten die Grenzen an Energie-Senken ein.
- Pad-Mitschnitt: reicht das Kontext-Pad in den Nachbarblock (Lücke < 300 ms), hört Whisper dessen Satzrest mit und halluziniert über das Blockende hinaus. Längste gemeinsame Wortfolge zwischen Blockende und Nachbaranfang (bis 6 Wörter, unscharf ≥ 0,8): ein Doppelwort gehört zum vorderen Block, wenn seine Wortmitte (Mittel beider Fassungen) vor der Lückenmitte liegt, sonst zum hinteren; hat der vordere Block es gar nicht mehr gehört, ist es sicher hinten. Liegen beide Fassungen in ihrem eigenen Block, ist es kein Echo, sondern ein Neuansatz nach kurzer Pause (Rohaufnahme: „Ich habe aus einem … Ich habe aus einem einzigen Produktbild …“) — dann bleibt alles. Bei einem Echo fallen Wörter hinter der Dublette (Ende A) und davor (Anfang B) weg, ebenso ungepaarte Randwörter, deren Mitte mehr als ein Pad (300 ms) jenseits der Blockgrenze liegt. Bei größeren Lücken wird nichts bereinigt — gleicher Wortlaut ist dann ein neuer Versuch.
- Halluzinationen: `[BLANK_AUDIO]` raus, identische Wortfolge dreimal oder öfter wird eine, Blöcke mit mehr als 6 Wörtern je Sekunde bekommen das Flag `dense`.

## Versuch wählen
- Gruppe = gleicher Satz (Containment ≥ 0,8 absorbiert Teilsätze, sonst Jaccard der Wortmengen und Satzanfang).
- Gewählt wird der Versuch, der den Konsens der Gruppe vollständig enthält, ohne Stottern, ohne Zuruf („nochmal“, „blöd“); ein Zuruf wie „geht doch“ im Anschluss wertet auf. Ein Satzrest, der zum nächsten Satz gehört, wird nur bei eindeutiger Übereinstimmung (≥ 0,85) abgetrennt.

## Nähte
Gemessen am Handschnitt des Autors (Arcads, 16 Stücke): 0 ms Stille an allen Nähten, Einstieg rund 1 Frame nach dem Anlaut, Ausstieg 28 dB unter dem Wortgipfel, 300 ms Ausklang weggeworfen.
- **hart** (Standard): Einstieg = Energie-Flanke (+6 dB gegenüber zwei Hops davor) + 1 Frame. Ausstieg = erster Hop, der 25 dB unter dem Gipfel der letzten 500 ms liegt. Korridor 0–80 ms.
- **weich**: Einstieg = Flanke − 2 Frames, Ausstieg = letzter Hop über Boden +8 dB + 3 Frames, Atem-Burst (80–400 ms, Boden +4…14 dB, spektraler Schwerpunkt > 2 kHz) davor abgeschnitten. Korridor 100–220 ms.
- Über alle 113 Klebestellen der elf fertig geschnittenen Korpus-Videos: Stille im Median 10 ms, 56 Nähte mit 0 ms, 80 % unter 80 ms, p90 130 ms, längste 270 ms — die harte Härte ist die Handschrift, nicht die Ausnahme.
- Audio-Fades 4 ms an jeder Kante, Video framegenau über `trim=start_frame/end_frame` nach `fps=30,setpts=N/FRAME_RATE/TB` — sonst driftet `concat` um Frames.

## Klebestellen (fertig geschnittene Zulieferung)
- Frame-Differenz je Frame (`tblend=difference`, YAVG). Klebestelle = erster Frame der neuen Einstellung, Index = `round(t·fps)` — mit rohen Frames nachgemessen; die alten Palmier-Blockpläne zählten teils einen Frame zu früh.
- Treffer, wenn die Differenz ≥ 3,5× Mittel ist **oder** ≥ 2,5× Mittel und mindestens 1,8× beider Nachbarframes (Einzelspitze). Bewegung und Zoom liefern Läufe erhöhter Werte (Nachbarverhältnis ≈ 1), ein Schnitt eine Spitze. Am Korpus: alle 113 Klebestellen gefunden, schwächste echte 2,9× / 4,3-fach prominent, stärkste Nicht-Klebestelle 2,9× / 1,1-fach.
- Es wird nichts gekürzt: ein Select über die ganze Länge, Kinn je Klebestück, Untertitel folgen den Stücken.

## Untertitel
Genau ein Wort, weiß, Bold 54 px, Fade-in 7 Frames, 34 px unter dem Kinn des jeweiligen Segments (Apple Vision), nie über y = 1010. Wörter kürzer als 6 Frames werden mit dem Nachbarn zusammengelegt. Ein Wort steht bis zum nächsten Wortanfang, höchstens 12 Frames über sein Ende hinaus.

## Bild
1080×1920, 30 fps. Instagram-Sicherheitszonen: oben 270, unten ab 1250, rechts ab 1010. Close-up 1,12 (CTA 1,22), Ankerpunkt 47 % / 45 %, Drift 2 %.
