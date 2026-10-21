# Die Bühne — Dateiformat eines Projekts

Ein Projekt ist ein Ordner `~/schnitt-projekte/<id>/`. Alles ist JSON, alles wird atomar geschrieben
(tmp + rename), nichts braucht eine Datenbank. Claude liest die Dateien direkt, das Dashboard über `/api/projekt/<id>/datei/<name>`.

| Datei | Schreibt | Inhalt |
|---|---|---|
| `project.json` | `neu`, jeder Schritt | `{id, name, fps, source{kind:"raw"|"cut", file, duration, …}, styleProfile, steps{<schritt>:{status, at, ms, summary}}}` |
| `media/source.<ext>` | `neu` | Hardlink oder Kopie der Aufnahme |
| `media/audio16k.wav` | `analyse` | Mono 16 kHz, für Whisper und Vorhören |
| `audio/rms.json` | `analyse` | `{hopMs:10, winMs:20, n, db:[…]}` RMS in dBFS je Hop |
| `audio/floor.json` | `analyse` | `{floor, on, off, p50, p95, dynamic}` |
| `audio/peaks.json` | `analyse` | `{binMs:5, bins, data}` Int8 base64 für die Wellenform |
| `blocks.json` | `blocks`, `asr` | `{fps, hopMs, floor, on, off, blocks:[{id,t0,t1,f0,f1,take,text,nWords,flags}], takes}` |
| `words-src.json` | `asr` | `{fps, prompt, words:[{w,t0,t1,p,block,take}], blocks:[{id,text,nWords,flags}]}` — Text von Whisper, Zeiten aus der Energie |
| `words-raw.json` | `asr` | `{pad, blocks:[{id,t0,t1,pre:[{w,t0,t1,p}]}]}` — Rohwörter je Block mit Whisper-Zeiten vor der Dubletten-Bereinigung (für `test/dedupe-replay.mjs`) |
| `names.json` | Nutzer, Dashboard | `{"gehört": "Gemeint"}` — Prompt und Ersetzung in `asr` |
| `selects.json` | `takes`, `seams`, Dashboard | `{fps, kind, groups:[{id,text,takes,chosen,skipped}], selects:[{id:"V#", group, blockIds, text, nWords, t0, t1, dur, enabled, order, locked, segments:[{block, words, in, out, inSec, outSec, onsetSec, offsetSec, decaySec, breath, hardIn, hardOut}]}]}` |
| `cut-profile.json` | Nutzer | überschreibt Felder aus `engine/cut/profile.default.json`, z. B. `{"seam":{"haerte":"weich"}}` |
| `media/camera.mp4` | `cut` | Zusammenschnitt, 30 fps, 9:16, H.264 crf 18, AAC |
| `cut-map.json` | `cut` | `{fps, frames, segments:[{select, block, words, srcIn, srcOut, dstIn, dstOut, hardIn, hardOut}]}` |
| `words-frames.json` | `cut` | Wörter in Ziel-Frames `{w, f0, f1, select, block}` |
| `check/seams.json` | `cut` | Messung: `{haerte, corridorMs, seams:[{i,frame,ms,ok,hard,from,to}], nSeams, hardSeams, inCorridor, medianMs, silenceSec, wpm}` |
| `splices.json` | `splices` (nur `kind:"cut"`) | erkannte Klebestellen des gelieferten Schnitts |
| `chin.json` | `chin` | `{median, segments:[{segment, frame, chinY, faceWidth, fallback}]}` Kinnhöhe je Segment (0 = oben) |
| `texte.json` | `untertitel` | `{fps, frames, subtitles:[{f0,f1,t,segment}]}` — Ein-Wort-Seiten |
| `style-profile.json` | `stil` (Phase 3) | Stilprofil, überschreibt Tokens, Untertitel-Stil, Rhythmus |
| `blockplan.json` | `montage` (Phase 2) | `{blocks:[{f0,f1,mode:"S"|"T"|"C"|"W",…}]}` |
| `montage.json` | `render` | Props der Remotion-Komposition, aus den Dateien oben kompiliert |
| `out/final.mp4` | `render` | das fertige Video |
