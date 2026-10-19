// audio/onset.mjs — Kanten im Ton finden. Energie-Senken (dips) stammen aus Tims align-words.py;
// Onset/Offset sind neu: eine Flanke statt eines Wortanfangs aus dem Transkript.
//
// Alle Positionen sind Hop-Indizes (10 ms) in der RMS-Kurve.

/** Lokale Energie-Senken: Minimum über ±3 Hops und ≥ 5 dB unter dem Nachbar-Maximum (8 Hops). */
export function dips(rms, a, b) {
  const out = [];
  for (let x = a + 3; x < b - 3; x++) {
    let isMin = true;
    for (let d = -3; d <= 3; d++) if (rms[x + d] < rms[x]) { isMin = false; break; }
    if (!isMin) continue;
    let left = -Infinity, right = -Infinity;
    for (let d = 1; d <= 8; d++) { if (x - d >= a) left = Math.max(left, rms[x - d]); if (x + d < b) right = Math.max(right, rms[x + d]); }
    if (rms[x] < Math.max(left, right) - 5) out.push(x);
  }
  return out;
}

/**
 * Einsatz (Anlaut) in [from, to]: erster Hop über `on`, dessen Flanke gegenüber Hop−2 mindestens flankDb beträgt.
 * Fällt die Flankenprüfung durch, gilt der erste Hop über `on`. Gibt null, wenn nichts über `on` liegt.
 */
export function findOnset(rms, from, to, { on, flankDb = 6 }) {
  const a = Math.max(2, from), b = Math.min(rms.length - 1, to);
  let firstAbove = null;
  for (let x = a; x <= b; x++) {
    if (rms[x] > on) {
      if (firstAbove === null) firstAbove = x;
      if (rms[x] - rms[x - 2] >= flankDb) return x;
    }
  }
  return firstAbove;
}

/** Auslaut: letzter Hop in [from, to] über `off`. null, wenn keiner. */
export function findOffset(rms, from, to, { off }) {
  const a = Math.max(0, from), b = Math.min(rms.length - 1, to);
  for (let x = b; x >= a; x--) if (rms[x] > off) return x;
  return null;
}
