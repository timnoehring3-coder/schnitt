// render/render.mjs — Schritt 9: Montage unter Node 22 rendern (Remotion). publicDir = media/ des Projekts.
import { compileMontage } from './compile-montage.mjs';
import { spawnStage } from '../lib/spawn.mjs';
import { node22 } from '../lib/node22.mjs';
import { parseLine, progress, log } from '../lib/progress.mjs';
import { REMOTION_ROOT } from '../lib/paths.mjs';
import { resolve } from 'node:path';
import { mkdirSync, existsSync, unlinkSync, linkSync, copyFileSync } from 'node:fs';
import { probe } from '../lib/ffmpeg.mjs';
import { ensureLicensed } from '../lib/license.mjs';

export default async function render(project, opts = {}) {
  await ensureLicensed('Render');
  const props = compileMontage(project);
  const out = project.path('out/final.mp4');
  // Remotion kopiert den ganzen publicDir ins Bundle → eigener Ordner nur mit der Kamera (Hardlink, sonst Kopie)
  const pub = project.path('media/public');
  mkdirSync(pub, { recursive: true });
  const camLink = resolve(pub, 'camera.mp4');
  if (existsSync(camLink)) unlinkSync(camLink);
  try { linkSync(project.path('media/camera.mp4'), camLink); } catch { copyFileSync(project.path('media/camera.mp4'), camLink); }
  let res = null;
  await spawnStage(node22(), [resolve(REMOTION_ROOT, 'render-worker.mjs'), project.path('montage.json'), pub, out, '--crf', String(opts.crf || 18)], (line) => {
    const p = parseLine(line);
    if (p?.type === 'progress') progress(p.pct, p.stage);
    else if (p?.type === 'result') res = p.data;
    else if (line.trim()) log(line);
  }, undefined, { cwd: REMOTION_ROOT });
  const meta = await probe(out);
  const summary = { out: 'out/final.mp4', seconds: +meta.duration.toFixed(2), frames: props.frames, width: meta.width, height: meta.height };
  log(`render: ${summary.seconds}s · ${meta.width}×${meta.height} → ${summary.out}`);
  return { summary };
}
