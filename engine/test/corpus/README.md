# Testkorpus

Je Projekt ein Ordner mit Referenzdaten aus Tims Handarbeit; das Rohmaterial liegt NICHT im Repo
(`CORPUS_DIR`, Standard `~/Tim OS/work/palmier`).

| Projekt | Quelle | Typ | Referenz |
|---|---|---|---|
| arcads | `arcads/raw.mp4` (479 s Rohtakes), Handschnitt `arcads/cut2.mp4` | roh | `reference-selects.json` (aus `match-cut.mjs`) |
| dreiskills | `dreiskills/camera.mp4` (37,8 s, fertig geschnitten) | fertig | `reference-splices.json` (11 Klebestellen), `reference-words.json` (Wortzeiten) |

Lauf: `node engine/test/run-corpus.mjs [--only arcads]` — legt Projekte unter `/tmp/schnitt-corpus/` an, rechnet die
Kette bis `cut` und druckt die Messwerte. Ziele: Take-Treffer ≥ 85 %, Klebestellen exakt, Wortzeiten |Δ| Median ≤ 3 F.
