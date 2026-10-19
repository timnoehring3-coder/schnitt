// captions/chin.mjs — Schritt 7: Kinnhöhe JE SEGMENT (CUT-STYLE: Kinn je Block messen, nicht einmal fürs Video).
// Frame aus der Mitte jedes Segments von camera.mp4, Apple Vision, Fallback = Median der Nachbarn.
import { mkdirSync } from 'node:fs';
import { readJson, writeJson } from '../lib/project.mjs';
import { run } from '../lib/spawn.mjs';
import { detectChin } from '../lib/swift.mjs';
import { progress, log } from '../lib/progress.mjs';

export default async function chin(project) {
  const fps = project.json.fps;
  const cm = readJson(project.path('cut-map.json'));
  const cam = project.path('media/camera.mp4');
  mkdirSync(project.path('check/chin'), { recursive: true });
  const out = [];
  for (let i = 0; i < cm.segments.length; i++) {
    const seg = cm.segments[i];
    const mid = Math.floor((seg.dstIn + seg.dstOut) / 2);
    const img = project.path(`check/chin/seg-${String(i).padStart(2, '0')}.jpg`);
    await run('ffmpeg', ['-nostdin', '-y', '-v', 'error', '-ss', (mid / fps).toFixed(3), '-i', cam, '-frames:v', '1', '-q:v', '3', img]);
    const r = await detectChin(img);
    out.push({ segment: i, dstIn: seg.dstIn, dstOut: seg.dstOut, frame: mid, ok: Boolean(r.ok), chinY: r.ok ? r.chinY : null, faceWidth: r.ok ? r.faceWidth : null });
    progress(5 + 90 * (i + 1) / cm.segments.length, `Kinn ${i + 1}/${cm.segments.length}`);
  }
  const good = out.filter((x) => x.ok).map((x) => x.chinY).sort((a, b) => a - b);
  const median = good.length ? good[Math.floor(good.length / 2)] : 0.62;
  for (const x of out) if (!x.ok) { x.chinY = median; x.fallback = true; }
  writeJson(project.path('chin.json'), { fps, median: +median.toFixed(4), segments: out });
  const summary = { segments: out.length, detected: good.length, medianChinY: +median.toFixed(3) };
  log(`chin: ${good.length}/${out.length} Gesichter · Median chinY ${summary.medianChinY}`);
  return { summary };
}
