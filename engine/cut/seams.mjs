// cut/seams.mjs — Schritt 5: Kanten je Segment aus der Energie. Ein Segment = die Wörter eines Versuchs innerhalb
// EINES Blocks. Einstieg = Flanke (Anlaut-Schutz) minus 2 Frames, Ausstieg = letzter Hop über `off` plus 3 Frames,
// Atem davor abgeschnitten, nie in Nachbarwort oder Nachbarblock hinein. Zielnaht 4–6 Frames (CUT-STYLE 764–782).
import { readJson, writeJson } from '../lib/project.mjs';
import { loadRms } from '../audio/analyse.mjs';
import { findOnset, findOffset } from '../audio/onset.mjs';
import { findBreath } from '../audio/breath.mjs';
import { pcmFloat } from '../lib/ffmpeg.mjs';
import { loadCutProfile } from './profile.mjs';
import { progress, log } from '../lib/progress.mjs';

export default async function seams(project) {
  const prof = loadCutProfile(project);
  const fps = project.json.fps;
  const { db, hopMs } = loadRms(project);
  const th = readJson(project.path('audio/floor.json'));
  const bj = readJson(project.path('blocks.json'));
  const ws = readJson(project.path('words-src.json'));
  const sj = readJson(project.path('selects.json'));
  const S = prof.seam, B = prof.breath;
  progress(10, 'Ton lesen');
  const pcm = await pcmFloat(project.path('media/audio16k.wav'), prof.sampleRate);
  const toHop = (sec) => Math.round(sec * 1000 / hopMs);
  const hopSec = (h) => h * hopMs / 1000;
  const ms = (x) => Math.round(x / hopMs);
  const enabled = sj.selects.filter((s) => s.enabled).sort((a, b) => a.order - b.order);
  let n = 0, breaths = 0, flanks = 0;
  for (const sel of enabled) {
    // Wortbereich in Block-Läufe teilen
    const runs = [];
    if (sel.words) {
      for (let i = sel.words[0]; i <= sel.words[1]; i++) {
        const w = ws.words[i];
        const r = runs[runs.length - 1];
        if (r && r.block === w.block) r.b = i; else runs.push({ block: w.block, a: i, b: i });
      }
    } else for (const id of sel.blockIds) runs.push({ block: id, a: null, b: null });
    sel.segments = [];
    for (let k = 0; k < runs.length; k++) {
      const r = runs[k];
      const blk = bj.blocks[r.block];
      const nextBlk = bj.blocks[r.block + 1];
      const first = r.a != null ? ws.words[r.a] : null, last = r.b != null ? ws.words[r.b] : null;
      const prevW = r.a != null ? ws.words[r.a - 1] : null, nextW = r.b != null ? ws.words[r.b + 1] : null;
      const startSec = first ? first.t0 : blk.t0, endSec = last ? last.t1 : blk.t1;
      const prevSameBlock = prevW && prevW.block === r.block, nextSameBlock = nextW && nextW.block === r.block;
      // Einstieg: Fenster um den Wortanfang, nie vor dem Ende des Vorworts im selben Block
      const onLo = Math.max(prevSameBlock ? toHop(prevW.t1) : 0, toHop(startSec) + ms(S.onsetSearchMs[0]));
      const onset = findOnset(db, onLo, toHop(startSec) + ms(S.onsetSearchMs[1]), { on: th.on, flankDb: S.flankDb });
      const onsetHop = onset ?? toHop(startSec);
      if (onset !== null && db[onsetHop] - db[onsetHop - 2] >= S.flankDb) flanks++;
      let inF = Math.floor(hopSec(onsetHop) * fps) - S.leadFrames;
      if (prevSameBlock) inF = Math.max(inF, Math.ceil(prevW.t1 * fps));
      // Ausstieg: letzter Hop über `off` vor dem Nachbarwort/-block
      const offHi = Math.min(toHop(endSec) + ms(S.offsetSearchMs[1]), nextSameBlock ? toHop(nextW.t0) - 1 : nextBlk ? toHop(nextBlk.t0) - 2 : Infinity);
      const offset = findOffset(db, toHop(endSec) + ms(S.offsetSearchMs[0]), offHi, { off: th.off });
      const offsetHop = offset ?? Math.min(toHop(endSec), offHi);
      let outF = Math.ceil(hopSec(offsetHop) * fps) + S.tailFrames;
      const br = findBreath(pcm, db, offsetHop + 1, toHop(outF / fps) + ms(200), { sampleRate: prof.sampleRate, hopMs, floor: th.floor, ...B });
      let breath = null;
      if (br && Math.floor(hopSec(br.h0) * fps) < outF) { outF = Math.max(Math.ceil(hopSec(offsetHop) * fps) + 1, Math.floor(hopSec(br.h0) * fps)); breath = { t0: +hopSec(br.h0).toFixed(3), t1: +hopSec(br.h1).toFixed(3) }; breaths++; }
      if (nextSameBlock) outF = Math.min(outF, Math.floor(nextW.t0 * fps));
      else if (nextBlk) outF = Math.min(outF, Math.floor(nextBlk.t0 * fps) - 1);
      if (k > 0) inF = Math.max(inF, sel.segments[k - 1].out);
      inF = Math.max(0, inF);
      if (outF <= inF) outF = inF + 1;
      sel.segments.push({ block: r.block, words: r.a != null ? [r.a, r.b] : null, in: inF, out: outF, inSec: +(inF / fps).toFixed(3), outSec: +(outF / fps).toFixed(3), onsetSec: +hopSec(onsetHop).toFixed(3), offsetSec: +hopSec(offsetHop).toFixed(3), breath, hardIn: Boolean(prevSameBlock), hardOut: Boolean(nextSameBlock) });
      n++;
    }
    sel.in = sel.segments[0].in; sel.out = sel.segments[sel.segments.length - 1].out;
    progress(10 + 85 * (enabled.indexOf(sel) + 1) / enabled.length, 'Nähte');
  }
  writeJson(project.path('selects.json'), sj);
  const summary = { segments: n, flanks, breaths, frames: enabled.reduce((s, x) => s + x.segments.reduce((a, g) => a + (g.out - g.in), 0), 0) };
  summary.seconds = +(summary.frames / fps).toFixed(2);
  log(`seams: ${n} Segmente · ${flanks} Flanken erkannt · ${breaths} Atemzüge abgeschnitten · ${summary.seconds}s`);
  return { summary };
}
