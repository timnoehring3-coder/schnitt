// render-worker.mjs — läuft unter Node 22: bündelt einmal, rendert die Montage. Aufruf aus engine/render/render.mjs.
//   node render-worker.mjs <montage.json> <publicDir> <out.mp4> [--crf 18]
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { readFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const [montageFile, publicDir, out] = process.argv.slice(2);
const crfArg = process.argv.indexOf('--crf');
const crf = crfArg > 0 ? Number(process.argv[crfArg + 1]) : 18;
const props = JSON.parse(readFileSync(montageFile, 'utf8'));
process.stdout.write('@@PROGRESS 2 Bündeln\n');
const serveUrl = await bundle({ entryPoint: resolve(here, 'src/index.jsx'), publicDir, onProgress: (p) => process.stdout.write(`@@PROGRESS ${Math.round(2 + p * 0.13)} Bündeln\n`) });
const composition = await selectComposition({ serveUrl, id: 'Montage', inputProps: props });
if (composition.durationInFrames !== props.frames) process.stderr.write(`Warnung: Comp ${composition.durationInFrames} F, erwartet ${props.frames} F\n`);
let last = -1;
await renderMedia({
  composition, serveUrl, codec: 'h264', crf, audioCodec: 'aac', outputLocation: out, inputProps: props,
  onProgress: ({ progress }) => { const p = Math.round(15 + progress * 85); if (p !== last) { last = p; process.stdout.write(`@@PROGRESS ${p} Rendern\n`); } },
});
try { rmSync(serveUrl, { recursive: true, force: true }); } catch { /* Bundle-Reste stören nicht */ }
process.stdout.write(`@@RESULT ${JSON.stringify({ ok: true, out, frames: composition.durationInFrames })}\n`);
