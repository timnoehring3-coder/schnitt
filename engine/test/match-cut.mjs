// test/match-cut.mjs — Tims fertigen Schnitt in die Rohquelle zurückverfolgen: Klebestellen im Schnitt finden
// (Bild-Differenz + Ton-Sprung), jedes Stück per Kreuzkorrelation der RMS-Kurve in der Quelle verorten.
// Ergebnis: reference-selects.json [{dstIn, dstOut, srcIn, srcOut, score}] in Frames — die Handreferenz für den Korpus.
//   node engine/test/match-cut.mjs <roh.mp4> <schnitt.mp4> <out.json> [--fps 30]
import { writeFileSync } from 'node:fs';
import { pcmFloat, probe } from '../lib/ffmpeg.mjs';
import { run } from '../lib/spawn.mjs';
import { computeRms } from '../audio/rms.mjs';

const [raw, cut, out] = process.argv.slice(2);
const fps = 30, hopMs = 10, sr = 16000;
if (!raw || !cut || !out) { console.error('Aufruf: match-cut.mjs <roh> <schnitt> <out.json>'); process.exit(1); }

// 1) Klebestellen im Schnitt: YAVG der Frame-Differenz (CUT-STYLE: > 3,5 × Mittel) + Audio-Sprung
const yavgTxt = await run('ffmpeg', ['-nostdin', '-v', 'error', '-i', cut, '-vf', 'tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-', '-f', 'null', '-']);
const yavg = [];
for (const m of yavgTxt.matchAll(/pts_time:([\d.]+)[\s\S]*?YAVG=([\d.]+)/g)) yavg.push({ t: +m[1], v: +m[2] });
const mean = yavg.reduce((s, x) => s + x.v, 0) / yavg.length;
const splicesV = yavg.filter((x) => x.v > 3.0 * mean).map((x) => Math.round(x.t * fps));
const cutPcm = await pcmFloat(cut, sr), rawPcm = await pcmFloat(raw, sr);
const cutDb = computeRms(cutPcm, sr, { hopMs }), rawDb = computeRms(rawPcm, sr, { hopMs });
// Ton-Sprünge NICHT als Kriterium: Plosive springen ebenso hart. Ein Schnitt im Talking-Head ist immer auch ein Bildsprung.
const cand = [...new Set(splicesV)].sort((a, b) => a - b);
const splices = [];
for (const f of cand) { if (splices.length && f - splices[splices.length - 1] <= 3) continue; splices.push(f); }
const cutFrames = Math.round((await probe(cut)).duration * fps);
const bounds = [0, ...splices.filter((f) => f > 15 && f < cutFrames - 15), cutFrames];
// 2) Jedes Stück in der Quelle verorten: normierte Kreuzkorrelation der RMS-Kurven (über Rauschboden geklemmt)
const norm = (arr) => { const m = arr.reduce((s, x) => s + x, 0) / arr.length; const v = Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length) || 1; return arr.map((x) => (x - m) / v); };
const Rraw = Array.from(rawDb);
// Präfixsummen für fensterweise Mittelwert/Streuung → echte normierte Kreuzkorrelation in O(N) je Stück
const pre1 = new Float64Array(Rraw.length + 1), pre2 = new Float64Array(Rraw.length + 1);
for (let i = 0; i < Rraw.length; i++) { pre1[i + 1] = pre1[i] + Rraw[i]; pre2[i + 1] = pre2[i] + Rraw[i] * Rraw[i]; }
function locate(a, b) {
  const P = norm(Array.from(cutDb.slice(a, b)));
  const L = P.length;
  let best = -Infinity, at = 0;
  for (let s = 0; s + L <= Rraw.length; s++) {
    const m = (pre1[s + L] - pre1[s]) / L, v = (pre2[s + L] - pre2[s]) / L - m * m;
    const sd = v > 1e-9 ? Math.sqrt(v) : 1;
    let c = 0; for (let i = 0; i < L; i++) c += P[i] * Rraw[s + i];
    c = c / (L * sd);
    if (c > best) { best = c; at = s; }
  }
  return { at, score: best };
}
const hopF = (h) => Math.round(h * hopMs / 1000 * fps);
const pieces = [];
function resolve(a, b, depth = 0) {
  const whole = locate(a, b);
  if (whole.score < 0.9 && b - a >= 150 && depth < 4) {
    const mid = Math.round((a + b) / 2);
    const L = locate(a, mid), Rr = locate(mid, b);
    const consistent = Math.abs((Rr.at - L.at) - (mid - a)) <= 15;   // Hälften liegen in der Quelle hintereinander (±150 ms)
    if (!consistent) { resolve(a, mid, depth + 1); resolve(mid, b, depth + 1); return; }
  }
  pieces.push({ dstIn: hopF(a), dstOut: hopF(b), srcIn: hopF(whole.at), srcOut: hopF(whole.at) + (hopF(b) - hopF(a)), score: +whole.score.toFixed(3) });
}
for (let k = 0; k < bounds.length - 1; k++) {
  const a = Math.round(bounds[k] / fps * 1000 / hopMs), b = Math.round(bounds[k + 1] / fps * 1000 / hopMs);
  if (b - a < 20) continue;
  resolve(a, b);
}
// benachbarte Stücke, die in der Quelle nahtlos aufeinander folgen, wieder verbinden
for (let i = pieces.length - 1; i > 0; i--) {
  const p = pieces[i - 1], q = pieces[i];
  if (Math.abs(q.srcIn - p.srcOut) <= 3) { p.dstOut = q.dstOut; p.srcOut = q.srcOut; p.score = Math.min(p.score, q.score); pieces.splice(i, 1); }
}
writeFileSync(out, JSON.stringify({ fps, cutFrames, splices: bounds, pieces }, null, 1));
for (const p of pieces) console.log(`dst ${String(p.dstIn).padStart(5)}–${String(p.dstOut).padEnd(5)} → src ${(p.srcIn / fps).toFixed(2).padStart(7)}–${(p.srcOut / fps).toFixed(2).padEnd(7)} (${((p.dstOut - p.dstIn) / fps).toFixed(2)}s) r=${p.score}`);
