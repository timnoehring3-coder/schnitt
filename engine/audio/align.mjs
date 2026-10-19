// audio/align.mjs — Wörter innerhalb eines Sprechblocks zeitlich verteilen. Whisper-Zeiten in einem Block sind
// gedehnt und versetzt (CUT-STYLE: „unterschiedlich“ 3,45 s); der Text stimmt. Also: Verteilung nach
// Zeichengewicht über die Sprechspanne, Grenzen rasten an Energie-Senken ein (aus Tims align-words.py).
import { dips } from './onset.mjs';

export function weight(w) {
  const core = String(w).replace(/[^\p{L}\p{N}]/gu, '');
  return Math.max(1, core.length) + (/[.,?!]$/.test(w) ? 1 : 0);
}

/**
 * words: [{w}], a/b: Hop-Indizes der Sprechspanne, rms: Kurve. Liefert [{w, h0, h1}] (Hops).
 * Grenzen nur zwischen Wörtern; die erste beginnt bei a, die letzte endet bei b.
 */
export function alignWords(words, rms, a, b, { hopMs = 10, snapHops = 12 } = {}) {
  if (!words.length) return [];
  const W = words.map((w) => weight(w.w));
  const total = W.reduce((s, x) => s + x, 0);
  const d = dips(rms, a, b);
  const bounds = [a];
  let acc = 0;
  for (let t = 0; t < words.length - 1; t++) {
    acc += W[t];
    const target = a + (b - a) * acc / total;
    const near = d.filter((x) => Math.abs(x - target) <= snapHops && x > bounds[bounds.length - 1] + 3);
    const pick = near.length ? near.reduce((best, x) => (Math.abs(x - target) < Math.abs(best - target) ? x : best), near[0]) : Math.round(target);
    bounds.push(Math.max(bounds[bounds.length - 1] + 1, pick));
  }
  bounds.push(b);
  return words.map((w, i) => ({ ...w, h0: bounds[i], h1: bounds[i + 1] }));
}
