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
export function alignWords(words, rms, a, b, { hopMs = 10, snapHops = 12, hybrid = true } = {}) {
  if (!words.length) return [];
  const W = words.map((w) => weight(w.w));
  const total = W.reduce((s, x) => s + x, 0);
  const d = dips(rms, a, b);
  // Whisper-Zeiten als Ziel, wenn sie plausibel sind: monoton, und die Whisper-Spanne des Blocks deckt sich mit der
  // Energie-Spanne (0,7…1,3). In kurzen, gepaddeten Blöcken sind sie gedehnt → dann Verteilung nach Zeichengewicht.
  const blockSec = (b - a) * hopMs / 1000, t0Block = a * hopMs / 1000;
  const hasTimes = words.every((w) => Number.isFinite(w.t0) && Number.isFinite(w.t1));
  const mono = hasTimes && words.every((w, i) => i === 0 || w.t0 >= words[i - 1].t0 - 0.02);
  // Spanne aus Wortanfängen (Whisper dehnt das letzte Wort gern über das Blockende hinaus), Ende = letzter Anfang +
  // dessen Dauer, aber höchstens das Blockende; die Gate-Prüfung 0,7–1,3 fängt gedehnte kurze Blöcke ab.
  const first = hasTimes ? words[0].t0 : 0, lastW = words[words.length - 1];
  const last = hasTimes ? Math.min(lastW.t1, Math.max(lastW.t0, t0Block + blockSec)) : 0;
  const span = hasTimes ? last - first : 0;
  const useWhisper = hybrid && hasTimes && mono && words.length >= 3 && span > 0 && span / blockSec >= 0.7 && span / blockSec <= 1.3;
  const bounds = [a];
  let acc = 0;
  for (let t = 0; t < words.length - 1; t++) {
    acc += W[t];
    // Hybrid: Whisper-Absolutzeit direkt in Hops (Block und Whisper-Fenster teilen die Zeitachse), auf den Block geklemmt.
    const target = useWhisper ? Math.min(b, Math.max(a, words[t + 1].t0 * 1000 / hopMs)) : a + (b - a) * acc / total;
    const near = d.filter((x) => Math.abs(x - target) <= snapHops && x > bounds[bounds.length - 1] + 3);
    const pick = near.length ? near.reduce((best, x) => (Math.abs(x - target) < Math.abs(best - target) ? x : best), near[0]) : Math.round(target);
    bounds.push(Math.max(bounds[bounds.length - 1] + 1, pick));
  }
  bounds.push(b);
  return words.map((w, i) => ({ ...w, h0: bounds[i], h1: bounds[i + 1], ...(useWhisper ? { byWhisper: true } : {}) }));
}
