// test/dedupe-replay.mjs — Dubletten-Regel ohne Whisper-Lauf nachspielen: liest <projekt>/words-raw.json
// (Rohwörter je Block vor der Bereinigung) und druckt die Entscheidungen samt Blocktexten. Für Regel-Experimente.
//   node engine/test/dedupe-replay.mjs /tmp/schnitt-corpus/arcads [blockId …]
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { dedupeBlocks } from '../asr/transcribe.mjs';
const [dir, ...only] = process.argv.slice(2);
const raw = JSON.parse(readFileSync(resolve(dir, 'words-raw.json'), 'utf8'));
const results = []; for (const b of raw.blocks) results[b.id] = { pre: b.pre.map((w) => ({ ...w })) };
const before = raw.blocks.map((b) => b.pre.map((w) => w.w).join(' '));
const dupes = dedupeBlocks(results, raw.blocks, raw.pad, { debug: true });
const want = new Set(only.map(Number));
for (const b of raw.blocks) {
  const after = results[b.id].pre.map((w) => w.w).join(' ');
  if (after !== before[b.id] && (!want.size || want.has(b.id))) console.log(`B${b.id} ${b.t0.toFixed(2)}–${b.t1.toFixed(2)}\n  vor:  ${before[b.id]}\n  nach: ${after}`);
}
console.log(`${dupes} Wörter entfernt`);
