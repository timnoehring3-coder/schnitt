// asr/transcribe.mjs — Schritt 3: jeden Sprechblock einzeln transkribieren (mit Kontext-Pad), filtern,
// Namen korrigieren, Wörter über die Energie des Blocks verteilen (Whisper-Zeiten sind nur Reihenfolge).
import { existsSync } from 'node:fs';
import { readJson, writeJson } from '../lib/project.mjs';
import { loadRms } from '../audio/analyse.mjs';
import { alignWords } from '../audio/align.mjs';
import { loadCutProfile } from '../cut/profile.mjs';
import { transcribeSpan } from './whisper.mjs';
import { filterWords } from './filter.mjs';
import { normTok, simRatio } from '../lib/text.mjs';
import { loadNames, applyNames, promptFromNames } from './names.mjs';
import { progress, log } from '../lib/progress.mjs';
import { wav16k } from '../lib/ffmpeg.mjs';

export default async function transcribe(project) {
  const prof = loadCutProfile(project);
  const bj = readJson(project.path('blocks.json'));
  const { db, hopMs } = loadRms(project);
  const wav = project.path('media/audio16k.wav');
  if (!existsSync(wav)) await wav16k(project.path(project.json.source.file), wav);
  const names = loadNames(project, prof.asr.names);
  const prompt = promptFromNames(names, prof.asr.prompt);
  const pad = prof.blocks.ctxPadMs / 1000;
  const blocks = bj.blocks;
  const results = new Array(blocks.length);
  let done = 0;
  const worker = async (queue) => {
    for (const b of queue) {
      const from = Math.max(0, b.t0 - pad), dur = (b.t1 - b.t0) + 2 * pad;
      let raw = [];
      try { raw = await transcribeSpan(wav, from, dur, { lang: prof.asr.lang, prompt, model: prof.asr.model === 'ggml-large-v3-turbo.bin' ? undefined : prof.asr.model }); }
      catch (e) { log(`asr Block ${b.id}: ${e.message}`); }
      // Wörter, die klar im Nachbarblock beginnen (jenseits des Pads), gehören nicht hierher
      raw = raw.filter((w) => w.t0 >= b.t0 - pad - 0.05 && w.t0 <= b.t1 + pad + 0.05);
      const f = filterWords(raw, { spanSec: b.t1 - b.t0 });
      const n = applyNames(f.words, names);
      results[b.id] = { pre: n.words, flags: f.flags, fixed: n.hits };
      done++;
      progress(5 + 90 * done / blocks.length, `ASR ${done}/${blocks.length}`);
    }
  };
  const par = Math.max(1, prof.asr.parallel || 2);
  const queues = Array.from({ length: par }, (_, i) => blocks.filter((_, k) => k % par === i));
  await Promise.all(queues.map(worker));
  // Dubletten an Blockgrenzen: das Kontext-Pad lässt Whisper den Satzrest des Nachbarblocks mithören. Überlappt das
  // Ende von Block k mit dem Anfang von k+1 (bis 4 Wörter, unscharf), bleibt das Wort dort, wo es laut Whisper-Zeit liegt.
  let dupes = 0;
  for (let k = 0; k + 1 < blocks.length; k++) {
    const A = results[blocks[k].id]?.pre, B = results[blocks[k + 1].id]?.pre;
    if (!A?.length || !B?.length || blocks[k + 1].t0 - blocks[k].t1 > 2 * pad + 0.5) continue;
    const same = (x, y) => normTok(x.w) === normTok(y.w) || simRatio(normTok(x.w), normTok(y.w)) >= 0.8;
    let m = 0;
    for (let n = Math.min(4, A.length, B.length); n >= 1; n--) { let ok = true; for (let i = 0; i < n; i++) if (!same(A[A.length - n + i], B[i])) { ok = false; break; } if (ok) { m = n; break; } }
    if (!m) continue;
    const tail = A.slice(A.length - m);
    const beyond = tail.filter((w) => w.t0 > blocks[k].t1 + 0.03).length;    // laut Whisper erst nach Blockende gesprochen
    if (beyond * 2 >= m) A.splice(A.length - m, m); else B.splice(0, m);
    dupes += m;
  }
  for (const b of blocks) {
    const r = results[b.id]; if (!r) continue;
    const a = Math.round(b.t0 * 1000 / hopMs), e = Math.round(b.t1 * 1000 / hopMs);
    const aligned = alignWords(r.pre, db, a, e, { hopMs });
    r.words = aligned.map((w) => ({ w: w.w, t0: +(w.h0 * hopMs / 1000).toFixed(3), t1: +(w.h1 * hopMs / 1000).toFixed(3), p: w.p ?? null, block: b.id, take: b.take, ...(w.fixed ? { fixed: true } : {}), ...(w.byWhisper ? { byWhisper: true } : {}) }));
  }
  const words = results.flatMap((r) => r?.words || []);
  const blockInfo = blocks.map((b) => {
    const r = results[b.id] || { words: [], flags: [] };
    return { id: b.id, text: r.words.map((w) => w.w).join(' '), nWords: r.words.length, flags: r.flags, fixed: r.fixed || 0 };
  });
  writeJson(project.path('words-src.json'), { fps: project.json.fps, prompt, words, blocks: blockInfo });
  bj.blocks = bj.blocks.map((b) => ({ ...b, text: blockInfo[b.id].text, nWords: blockInfo[b.id].nWords, flags: blockInfo[b.id].flags.map((f) => f.rule) }));
  writeJson(project.path('blocks.json'), bj);
  const loops = blockInfo.reduce((s, b) => s + b.flags.filter((f) => f.rule === 'loop').length, 0);
  const empty = blockInfo.filter((b) => !b.nWords).length;
  const summary = { words: words.length, blocks: blocks.length, emptyBlocks: empty, loops, dupes, namesFixed: blockInfo.reduce((s, b) => s + b.fixed, 0) };
  log(`asr: ${summary.words} Wörter · ${empty} leere Blöcke · ${loops} Schleifen entfernt · ${dupes} Dubletten an Blockgrenzen · ${summary.namesFixed} Namen korrigiert`);
  return { summary };
}
