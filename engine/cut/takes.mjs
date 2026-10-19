// cut/takes.mjs — Schritt 4: Versuche auf WORT-Ebene bilden (Neuansatz auch ohne Pause erkennen), zu Satzgruppen
// bündeln und je Gruppe den besten Versuch vorschlagen. Signale (CUT-STYLE 740–762): Zurufe des Sprechers
// („Geht doch“ = gut, „Blöd, Mann“ = verworfen) schlagen alles; sonst Vollständigkeit und Flüssigkeit vor Position.
// Das Ergebnis ist ein VORSCHLAG — der Take-Picker entscheidet.
import { readJson, writeJson } from '../lib/project.mjs';
import { loadCutProfile } from './profile.mjs';
import { simRatio, toks, jaccard, containment, normTok } from '../lib/text.mjs';
import { progress, log } from '../lib/progress.mjs';

/** Erste zwei verschiedenen Tokens (Wiederholungen wie „Was Was“ zählen einmal). */
function head(text, n = 2) {
  const out = [];
  for (const t of toks(text, 1)) { if (out[out.length - 1] !== t) out.push(t); if (out.length >= n) break; }
  return out;
}
const join = (a) => a.join('');

/** Gleicher Satz? Kurze Fassung steckt in der langen · gleicher Anfang + halbe Überlappung · oder starke Überlappung. */
export function sameSentence(a, b, sim = 0.6) {
  const A = toks(a), B = toks(b);
  if (!A.length || !B.length) return false;
  const c = containment(A, B);
  if (Math.min(new Set(A).size, new Set(B).size) <= 6) return c >= sim;
  const hs = simRatio(join(head(a)), join(head(b)));
  return (hs >= sim && c >= 0.5) || jaccard(A, B) >= sim;
}

function matchesPhrase(text, phrases) {
  const n = ' ' + String(text).toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim() + ' ';
  return phrases.some((p) => n.includes(' ' + p.toLowerCase() + ' '));
}

/**
 * Versuche aus der Wortliste. Neuer Versuch bei: neuem Take · Blockwechsel mit gleichem Satzanfang wie der Versuch
 * oder der Vorblock · innerhalb eines Blocks, wenn der Satzanfang (≥ 3 Wörter später) wiederkehrt.
 */
export function buildAttempts(words, blocks) {
  const attempts = [];
  let cur = null;
  const startNew = (i) => { cur = { i0: i, i1: i, blockIds: [words[i].block], take: words[i].take }; attempts.push(cur); };
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (!cur) { startNew(i); continue; }
    const prevW = words[i - 1];
    const curText = words.slice(cur.i0, i).map((x) => x.w).join(' ');
    const curHead = head(curText);
    const here = head(words.slice(i, i + 2).map((x) => x.w).join(' '));
    const hereStr = join(here);
    const sameHead = (h) => h.length && hereStr.length > 3 && simRatio(hereStr, join(h.slice(0, here.length))) >= 0.7;
    let restart = false;
    if (w.take !== cur.take) restart = true;
    else if (w.block !== prevW.block) {
      const prevBlockText = words.slice(cur.i0, i).filter((x) => x.block === prevW.block).map((x) => x.w).join(' ');
      restart = sameHead(curHead) || sameHead(head(prevBlockText));
    } else if (i - cur.i0 >= 3 && /[.!?,]$/.test(prevW.w) === false ? sameHead(curHead) && hereStr.length > 5 : sameHead(curHead)) {
      restart = i - cur.i0 >= 3 && sameHead(curHead);
    }
    if (restart) startNew(i);
    else { cur.i1 = i; if (!cur.blockIds.includes(w.block)) cur.blockIds.push(w.block); }
  }
  return attempts.map((a, k) => {
    const ws = words.slice(a.i0, a.i1 + 1);
    const blockGaps = a.blockIds.slice(1).map((id, j) => blocks[id].t0 - blocks[a.blockIds[j]].t1);
    return {
      id: k, i0: a.i0, i1: a.i1, blockIds: a.blockIds, take: a.take,
      text: ws.map((x) => x.w).join(' '), nWords: ws.length,
      t0: ws[0].t0, t1: ws[ws.length - 1].t1, dur: +(ws[ws.length - 1].t1 - ws[0].t0).toFixed(2),
      gaps: blockGaps.length, silence: +blockGaps.reduce((s, g) => s + g, 0).toFixed(2),
      flags: [...new Set(a.blockIds.flatMap((id) => blocks[id].flags || []))],
    };
  });
}

export function groupAttempts(attempts, words, { sentenceSim = 0.6, rejectWords = [], acceptWords = [] } = {}) {
  const content = [];
  for (const t of attempts) {
    const short = t.nWords <= 4;
    if (short && matchesPhrase(t.text, rejectWords)) { t.comment = 'reject'; if (content.length) content[content.length - 1].judged = 'reject'; continue; }
    if (short && matchesPhrase(t.text, acceptWords)) { t.comment = 'accept'; if (content.length) content[content.length - 1].judged = 'accept'; continue; }
    content.push(t);
  }
  const groups = [];
  for (let i = 0; i < content.length; i++) {
    const t = content[i];
    const g = groups.slice(-2).find((x) => sameSentence(t.text, x.longest.text, sentenceSim));
    if (g) { g.takes.push(t); if (t.nWords > g.longest.nWords) g.longest = t; t.group = g.id; continue; }
    const ng = { id: groups.length, takes: [t], longest: t }; groups.push(ng); t.group = ng.id;
  }
  // Gruppen, deren längste Fassung ganz in einer Nachbargruppe steckt (Teilsatz-Neuansatz), aufgehen lassen
  for (let k = groups.length - 1; k >= 0; k--) {
    const g = groups[k];
    const A = toks(g.longest.text);
    const host = [groups[k - 1], groups[k + 1]].find((h) => h && h.longest.nWords > g.longest.nWords && containment(A, toks(h.longest.text)) >= 0.8);
    if (host) { for (const t of g.takes) { t.group = host.id; host.takes.push(t); } groups.splice(k, 1); }
  }
  groups.forEach((g, k) => { g.id = k; for (const t of g.takes) t.group = k; g.takes.sort((a, b) => a.t0 - b.t0); });
  // Satzrest am Ende eines Versuchs, der schon der Anfang der NÄCHSTEN Gruppe ist („… gehst zu Arcads In Arcads“) → abschneiden
  for (let k = 0; k < groups.length - 1; k++) {
    const nextHead = head(groups[k + 1].longest.text);
    if (!nextHead.length) continue;
    for (const t of groups[k].takes) {
      const ws = words.slice(t.i0, t.i1 + 1).map((x) => normTok(x.w));
      for (let n = Math.min(3, ws.length - 2); n >= 1; n--) {
        const tail = ws.slice(-n), hd = nextHead.slice(0, n);
        const ok = hd.length === n && (n >= 2 ? simRatio(tail.join(''), hd.join('')) >= 0.85 : tail[0] === hd[0] && tail[0].length >= 4);
        if (ok) { t.i1 -= n; t.trimmed = n; break; }
      }
      if (t.trimmed) { const w2 = words.slice(t.i0, t.i1 + 1); t.text = w2.map((x) => x.w).join(' '); t.nWords = w2.length; t.t1 = w2[w2.length - 1].t1; t.dur = +(t.t1 - t.t0).toFixed(2); }
    }
  }
  for (const g of groups) {
    const max = Math.max(...g.takes.map((t) => t.nWords));
    if (max <= 2) { g.skipped = 'zu kurz'; continue; }
    // Konsens: Tokens, die in ≥ 2 Versuchen der Gruppe vorkommen (bei nur einem Versuch: alle)
    const count = new Map();
    for (const t of g.takes) for (const tok of new Set(toks(t.text))) count.set(tok, (count.get(tok) || 0) + 1);
    const consensus = [...count.entries()].filter(([, c]) => c >= Math.min(2, g.takes.length)).map(([tok]) => tok);
    for (const t of g.takes) {
      const T = new Set(toks(t.text));
      const covered = consensus.length ? consensus.filter((tok) => T.has(tok)).length / consensus.length : t.nWords / max;
      const complete = covered >= 0.85 ? 1 : covered;
      const raw = toks(t.text, 1);
      const stutters = raw.filter((tok, i) => i > 0 && tok === raw[i - 1]).length;
      t.stutters = stutters;
      t.score = +(complete - 0.15 * t.gaps - 0.05 * t.silence - 0.15 * stutters - (t.flags.includes('loop') ? 0.2 : 0) - (t.flags.includes('dense') ? 0.1 : 0) - 0.02 * Math.max(0, t.nWords - max)).toFixed(3);
    }
    const accepted = g.takes.filter((t) => t.judged === 'accept');
    const pool = accepted.length ? accepted : g.takes.filter((t) => t.judged !== 'reject');
    const cands = pool.length ? pool : g.takes;
    let best = cands[0];
    for (const t of cands) if (t.score > best.score || (t.score === best.score && t.t0 > best.t0)) best = t;
    best.chosen = true;
    best.reason = accepted.length ? 'Zuruf: gut' : best.score >= 0.99 ? 'vollständig und flüssig' : best.score >= 0.8 ? 'vollständig, mit Makel' : 'bester Kompromiss';
  }
  return { content, groups };
}

export default async function takesStep(project) {
  const prof = loadCutProfile(project);
  const bj = readJson(project.path('blocks.json'));
  const ws = readJson(project.path('words-src.json'));
  const kind = project.json.source.kind;
  progress(20, 'Versuche');
  let selects, groups = [];
  if (kind === 'cut') {
    selects = bj.blocks.map((b, i) => {
      const idx = ws.words.map((w, k) => (w.block === b.id ? k : -1)).filter((k) => k >= 0);
      return { id: `S${i + 1}`, group: i, blockIds: [b.id], words: idx.length ? [idx[0], idx[idx.length - 1]] : null, text: b.text || '', nWords: b.nWords || 0, t0: b.t0, t1: b.t1, enabled: true, order: i, seamMode: 'normalize', score: 1, reason: 'fertig geschnitten' };
    });
  } else {
    const attempts = buildAttempts(ws.words, bj.blocks);
    const r = groupAttempts(attempts, ws.words, prof.takes);
    groups = r.groups.map((g) => ({ id: g.id, text: g.longest.text, takes: g.takes.map((t) => t.id), chosen: g.takes.find((t) => t.chosen)?.id ?? null, skipped: g.skipped || null }));
    let order = 0;
    selects = attempts.map((t) => ({
      id: `V${t.id + 1}`, group: t.group ?? null, blockIds: t.blockIds, text: t.text, nWords: t.nWords, t0: t.t0, t1: t.t1, dur: t.dur, gaps: t.gaps, silence: t.silence,
      comment: t.comment || null, judged: t.judged || null, score: t.score ?? null, reason: t.reason || null, stutters: t.stutters || 0, trimmed: t.trimmed || 0, words: [t.i0, t.i1],
      enabled: Boolean(t.chosen), order: t.chosen ? order++ : null, seamMode: 'normalize',
    }));
  }
  writeJson(project.path('selects.json'), { fps: project.json.fps, kind, groups, selects });
  const chosen = selects.filter((s) => s.enabled);
  const summary = { attempts: selects.length, groups: groups.length, chosen: chosen.length, chosenSeconds: +chosen.reduce((s, x) => s + (x.t1 - x.t0), 0).toFixed(1), words: chosen.reduce((s, x) => s + x.nWords, 0) };
  log(`takes: ${summary.attempts} Versuche · ${summary.groups} Satzgruppen · ${summary.chosen} gewählt · ${summary.chosenSeconds}s · ${summary.words} Wörter`);
  return { summary };
}
