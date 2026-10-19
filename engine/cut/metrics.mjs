// cut/metrics.mjs — Nähte am fertigen camera.mp4 nachmessen. Jede Naht einzeln (CUT-STYLE: „jede Naht einzeln nachmessen“).
import { pcmFloat } from '../lib/ffmpeg.mjs';
import { computeRms } from '../audio/rms.mjs';

export async function measureSeams(cameraFile, cutMap, { fps, floor, hopMs = 10, sampleRate = 16000, corridorMs = [100, 220], hart = false } = {}) {
  const pcm = await pcmFloat(cameraFile, sampleRate);
  const db = computeRms(pcm, sampleRate, { hopMs, winMs: 20 });
  const quiet = floor + 8, hot = floor + 12, tail = floor + 8;
  const hopOf = (frame) => Math.round(frame / fps * 1000 / hopMs);
  const seams = [];
  let hardSeams = 0;
  for (let i = 1; i < cutMap.length; i++) {
    // harte Naht: Schnitt mitten im Sprechblock (Neuansatz ohne Pause) — dort gibt es keine Stille zu messen
    if (cutMap[i - 1].hardOut || cutMap[i].hardIn) { hardSeams++; seams.push({ i, frame: cutMap[i].dstIn, ms: 0, hard: true, ok: true, from: cutMap[i - 1].block, to: cutMap[i].block }); continue; }
    const h = hopOf(cutMap[i].dstIn);
    const win = Math.round(300 / hopMs);
    // leisesten Punkt nahe der Naht suchen, von dort den Stille-Lauf ausdehnen
    let lo = h, loV = Infinity;
    for (let x = Math.max(0, h - win); x <= Math.min(db.length - 1, h + win); x++) if (db[x] < loV) { loV = db[x]; lo = x; }
    let a = lo, b = lo;
    if (loV < quiet) { while (a > 0 && db[a - 1] < quiet) a--; while (b < db.length - 1 && db[b + 1] < quiet) b++; }
    const ms = loV < quiet ? (b - a + 1) * hopMs : 0;
    seams.push({ i, frame: cutMap[i].dstIn, ms, ok: ms >= corridorMs[0] && ms <= corridorMs[1], from: cutMap[i - 1].block, to: cutMap[i].block });
  }
  const starts = [], ends = [];
  for (const seg of cutMap) {
    const s = hopOf(seg.dstIn), e = hopOf(seg.dstOut);
    const startsHot = !hart && !seg.hardIn && db[s] > hot && db[s + 1] > hot;
    const endsHot = !hart && !seg.hardOut && db[e - 1] > tail && db[e - 2] > tail;
    if (startsHot) starts.push(seg.block);
    if (endsHot) ends.push(seg.block);
  }
  // Stille gesamt (Läufe ≥ 100 ms unter floor+6)
  let silence = 0, run = 0;
  for (let x = 0; x < db.length; x++) { if (db[x] < quiet) run++; else { if (run >= 100 / hopMs) silence += run; run = 0; } }
  if (run >= 100 / hopMs) silence += run;
  const soft = seams.filter((s) => !s.hard);
  const inCorridor = soft.filter((s) => s.ok).length;
  return {
    seams, nSeams: soft.length, hardSeams, inCorridor, corridorShare: soft.length ? +(inCorridor / soft.length).toFixed(3) : 1,
    medianMs: soft.length ? soft.map((s) => s.ms).sort((x, y) => x - y)[Math.floor(soft.length / 2)] : 0,
    startsHot: starts, endsHot: ends, silenceSec: +(silence * hopMs / 1000).toFixed(2), durationSec: +(pcm.length / sampleRate).toFixed(2),
  };
}
