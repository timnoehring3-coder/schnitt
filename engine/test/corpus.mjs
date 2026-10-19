// test/corpus.mjs — der Maßstab: unsere Kanten gegen Tims Handschnitt. Für jedes Projekt des Korpus liegt
// reference-selects.json (aus match-cut.mjs) neben dem Rohmaterial. Gemessen wird je Referenzstück, ob wir denselben
// Quellbereich gewählt haben (Take-Treffer) und wie weit unsere Kanten von seinen liegen (Frames).
//   node engine/test/corpus.mjs <projektdir> <reference-selects.json>
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [projDir, refFile] = process.argv.slice(2);
if (!projDir || !refFile) { console.error('Aufruf: corpus.mjs <projektdir> <reference-selects.json>'); process.exit(1); }
const ref = JSON.parse(readFileSync(refFile, 'utf8'));
const cm = JSON.parse(readFileSync(resolve(projDir, 'cut-map.json'), 'utf8'));
const fps = cm.fps;
const ours = cm.segments;
const sec = (f) => (f / fps).toFixed(2);
const overlap = (a, b) => Math.max(0, Math.min(a.srcOut, b.srcOut) - Math.max(a.srcIn, b.srcIn));

let hit = 0, inDist = [], outDist = [], missed = [], extra = [];
for (const p of ref.pieces.filter((x) => x.score >= 0.9)) {
  const cand = ours.filter((o) => overlap(o, p) > 0);
  if (!cand.length) { missed.push(p); continue; }
  hit++;
  const first = cand.reduce((m, o) => (o.srcIn < m.srcIn ? o : m)), last = cand.reduce((m, o) => (o.srcOut > m.srcOut ? o : m));
  inDist.push({ d: first.srcIn - p.srcIn, p }); outDist.push({ d: last.srcOut - p.srcOut, p });
}
for (const o of ours) if (!ref.pieces.some((p) => p.score >= 0.9 && overlap(o, p) > 0)) extra.push(o);
const med = (arr) => { const a = arr.map((x) => Math.abs(x.d)).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null; };
const max = (arr) => arr.length ? Math.max(...arr.map((x) => Math.abs(x.d))) : null;
const refSec = ref.pieces.filter((x) => x.score >= 0.9).reduce((s, p) => s + (p.dstOut - p.dstIn), 0) / fps;
console.log(`Referenz: ${ref.pieces.length} Stücke (${ref.pieces.filter((x) => x.score >= 0.9).length} sicher) · ${refSec.toFixed(1)}s · Ausgabe ${(ref.cutFrames / fps).toFixed(1)}s`);
console.log(`Wir:      ${ours.length} Segmente · ${(cm.frames / fps).toFixed(1)}s`);
console.log(`Take-Treffer: ${hit}/${ref.pieces.filter((x) => x.score >= 0.9).length} · Einstieg |Δ| Median ${med(inDist)} F, max ${max(inDist)} F · Ausstieg |Δ| Median ${med(outDist)} F, max ${max(outDist)} F  (Δ>0 = wir später)`);
for (const x of inDist) { const o = outDist.find((y) => y.p === x.p); console.log(`  ref ${sec(x.p.srcIn).padStart(7)}–${sec(x.p.srcOut).padEnd(7)}  Einstieg Δ ${String(x.d).padStart(4)} F · Ausstieg Δ ${String(o.d).padStart(4)} F`); }
if (missed.length) console.log('Tim nahm, wir nicht: ' + missed.map((p) => `${sec(p.srcIn)}–${sec(p.srcOut)}`).join(' · '));
if (extra.length) console.log('Wir nahmen, Tim nicht: ' + extra.map((o) => `${sec(o.srcIn)}–${sec(o.srcOut)} (${o.select})`).join(' · '));
