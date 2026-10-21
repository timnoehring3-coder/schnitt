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
  const rawFile = project.path('words-raw.json');
  if (process.env.SCHNITT_ASR_REPLAY === '1' && existsSync(rawFile)) {
    // Regel-Experimente: Rohwörter des letzten Whisper-Laufs wiederverwenden statt neu zu transkribieren.
    for (const b of readJson(rawFile).blocks) results[b.id] = { pre: b.pre, flags: b.flags || (bj.blocks[b.id]?.flags || []).map((rule) => ({ rule })), fixed: b.fixed || 0 };
    log('asr: Replay aus words-raw.json (SCHNITT_ASR_REPLAY)');
  } else await Promise.all(queues.map(worker));
  // Pad-Mitschnitt: das Kontext-Pad lässt Whisper den Satzrest des Nachbarblocks mithören — und über das Blockende
  // hinaus halluzinieren (blender: Block 0 endet 8,62 s, Whisper liefert „alles mit KI erstellt wurde“ bis 10,5 s).
  // Bereinigt wird nur dort, wo das Pad wirklich in den Nachbarblock reicht (Lücke < Pad) — bei größeren Lücken ist
  // gleicher Wortlaut ein Neuansatz (Roh-Take) und bleibt; Dedupe über alle Lücken kostete bei arcads 3 von 16 Takes.
  // Regel: längste gemeinsame Wortfolge zwischen A-Schwanz und B-Kopf (mit Versatz). Seite je Doppelwort: Wortmitte
  // (Mittel beider Fassungen) vor der Lückenmitte → A, sonst B; hat A das Wort gar nicht mehr gehört → B. Der Schnitt
  // ist monoton. A-Wörter hinter der Dublette und B-Wörter davor sind Pad-Halluzination; ungepaarte Randwörter mehr als
  // pad/2 jenseits der Blockgrenze fallen. Gemessen: blender |Δ| Median 4→2 F, dreiskills 3→2 F (125/125), voiceaudio 1 F.
  writeJson(rawFile, { pad, blocks: blocks.map((b) => ({ id: b.id, t0: b.t0, t1: b.t1, pre: results[b.id]?.pre || [], flags: results[b.id]?.flags || [], fixed: results[b.id]?.fixed || 0 })) });
  const dupes = prof.asr.dedupe !== false ? dedupeBlocks(results, blocks, pad) : 0;
  for (const b of blocks) {
    const r = results[b.id]; if (!r) continue;
    const a = Math.round(b.t0 * 1000 / hopMs), e = Math.round(b.t1 * 1000 / hopMs);
    const aligned = alignWords(r.pre, db, a, e, { hopMs, hybrid: prof.asr.hybridTimes !== false });
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
  log(`asr: ${summary.words} Wörter · ${empty} leere Blöcke · ${loops} Schleifen entfernt · ${dupes} Pad-Wörter entfernt · ${summary.namesFixed} Namen korrigiert`);
  return { summary };
}

/** Dubletten an Blockgrenzen bereinigen (siehe Kommentar oben). results[id].pre wird ersetzt; liefert die Zahl entfernter Wörter. */
export function dedupeBlocks(results, blocks, pad, { debug = Boolean(process.env.SCHNITT_DEBUG_DEDUPE) } = {}) {
  let dupes = 0;
  for (let k = 0; k + 1 < blocks.length; k++) {
    const A = results[blocks[k].id]?.pre, B = results[blocks[k + 1].id]?.pre;
    if (!A?.length || !B?.length || blocks[k + 1].t0 - blocks[k].t1 >= pad) continue;
    const same = (x, y) => normTok(x.w) === normTok(y.w) || simRatio(normTok(x.w), normTok(y.w)) >= 0.8;
    // Längste gemeinsame Wortfolge zwischen A-Schwanz (bis 6 Wörter) und B-Kopf (bis 6 Wörter), mit Versatz.
    let best = { n: 0, ia: 0, jb: 0 };
    const tailLen = Math.min(6, A.length - 1), headLen = Math.min(6, B.length - 1);
    for (let ia = A.length - tailLen; ia < A.length; ia++) for (let jb = 0; jb < headLen; jb++) {
      let n = 0; while (ia + n < A.length && jb + n < headLen && same(A[ia + n], B[jb + n])) n++;
      if (n > best.n) best = { n, ia, jb };
    }
    const dropA = new Set(), dropB = new Set(), matchedA = new Set(), matchedB = new Set();
    const gapMid = (blocks[k].t1 + blocks[k + 1].t0) / 2, heardA = blocks[k].t1 + pad - 0.05;
    const mid = (w) => (w.t0 + w.t1) / 2;
    // Neuansatz oder Pad-Echo? Liegen beide Fassungen der Dublette in ihrem eigenen Block (A-Fassung vor A-Ende,
    // B-Fassung nach B-Anfang), hat der Sprecher den Satz nach kurzer Pause neu angesetzt (Roh-Take) — dann bleibt alles.
    // Ein Echo erkennt man daran, dass mindestens eine Fassung im fremden Block liegt (arcads: 14/16 → 10/16 Takes ohne diese Prüfung).
    if (best.n) {
      let aIn = 0, bIn = 0;
      for (let i = 0; i < best.n; i++) { if (mid(A[best.ia + i]) <= blocks[k].t1) aIn++; if (mid(B[best.jb + i]) >= blocks[k + 1].t0) bIn++; }
      // Textbeweis: geht die Übereinstimmung VOR der Dublette weiter (A[ia−1] = B[jb−1]), wiederholt B den Anfang von A —
      // ein Echo aus dem Pad kann A's Anfang nicht enthalten. Kurze Blöcke dehnen Whisper-Zeiten, deshalb zählt der Text zuerst.
      const restartByText = best.ia > 0 && best.jb > 0 && same(A[best.ia - 1], B[best.jb - 1]);
      if (restartByText || (aIn * 2 >= best.n && bIn * 2 >= best.n)) best = { n: 0, ia: 0, jb: 0 };
    }
    if (best.n) {
      // Seite je Doppelwort: hat A das Wort gar nicht mehr gehört (Beginn hinter A-Fenster), ist es B's; sonst entscheidet
      // die Wortmitte (Mittel beider Fassungen) gegen die Lückenmitte. Der Schnitt bleibt monoton: ab dem ersten
      // B-Wort gehört der Rest der Dublette zu B.
      let split = best.n;
      for (let i = 0; i < best.n; i++) {
        const wa = A[best.ia + i], wb = B[best.jb + i];
        const toB = wa.t0 >= heardA || (mid(wa) + mid(wb)) / 2 >= gapMid;
        if (toB) { split = i; break; }
      }
      for (let i = 0; i < best.n; i++) { matchedA.add(best.ia + i); matchedB.add(best.jb + i); if (i < split) dropB.add(best.jb + i); else dropA.add(best.ia + i); }
      for (let i = best.ia + best.n; i < A.length; i++) dropA.add(i);   // A-Wörter hinter der Dublette: Pad-Halluzination
      for (let j = 0; j < best.jb; j++) dropB.add(j);                   // B-Wörter vor der Dublette: Vorlauf aus dem Pad
    }
    // Keine Zeitregel für ungepaarte Randwörter: Whisper dehnt das letzte Wort kurzer Blöcke weit über das Fenster
    // hinaus („Arcads“ 138,26–139,5 s in einem Block, der 138,06 endet) — jede Schwelle kostete echte Satzenden.
    if (dropA.size >= A.length) dropA.clear(); if (dropB.size >= B.length) dropB.clear();
    if (debug && (dropA.size || dropB.size)) log(`dedupe ${blocks[k].id}|${blocks[k + 1].id} (${blocks[k].t1.toFixed(2)}/${blocks[k + 1].t0.toFixed(2)}): A −[${[...dropA].map((i) => `${A[i].w}@${A[i].t0}-${A[i].t1}`).join(' ')}] B −[${[...dropB].map((j) => `${B[j].w}@${B[j].t0}-${B[j].t1}`).join(' ')}]${best.n ? ` Dublette ${best.n}` : ''}`);
    results[blocks[k].id].pre = A.filter((_, i) => !dropA.has(i));
    results[blocks[k + 1].id].pre = B.filter((_, j) => !dropB.has(j));
    dupes += dropA.size + dropB.size;
  }
  return dupes;
}
