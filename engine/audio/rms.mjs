// audio/rms.mjs — RMS-Hüllkurve in dBFS. hop 10 ms, Fenster 20 ms (CUT-STYLE: das Rezept, das beim Arcads-Video trug).
export function computeRms(pcm, sampleRate, { hopMs = 10, winMs = 20 } = {}) {
  const hop = Math.round(sampleRate * hopMs / 1000);
  const win = Math.round(sampleRate * winMs / 1000);
  const n = Math.max(0, Math.floor((pcm.length - win) / hop) + 1);
  const out = new Float32Array(n);
  // Präfixsumme der Quadrate → O(1) je Fenster
  const pre = new Float64Array(pcm.length + 1);
  for (let i = 0; i < pcm.length; i++) pre[i + 1] = pre[i] + pcm[i] * pcm[i];
  for (let k = 0; k < n; k++) {
    const a = k * hop, b = a + win;
    const ms = (pre[b] - pre[a]) / win;
    out[k] = ms > 1e-12 ? 10 * Math.log10(ms) : -120;
  }
  return out;
}

/** Perzentil einer Float32Array (kopiert und sortiert). */
export function percentile(arr, p) {
  const s = Float32Array.from(arr).sort();
  if (!s.length) return -120;
  const i = Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * p / 100)));
  return s[i];
}

/** Rauschboden und Hysterese-Schwellen. floor = 20. Perzentil; on = +12 dB, off = +8 dB. */
export function thresholds(rms, { percentile: pc = 20, onDb = 12, offDb = 8 } = {}) {
  // Rauschboden = 20. Perzentil, solange die leisesten Hops ein enges Bündel bilden (echte Stille: p20 − p2 ≤ 8 dB).
  // Material ohne Stille (fertiger Schnitt, Audio normalisiert) hat dieses Bündel nicht — dann liegt p20 mitten in
  // der Sprache; der Boden ist dann das 2. Perzentil + 4 dB.
  const p2 = percentile(rms, 2), p20 = percentile(rms, pc);
  const noSilence = p20 - p2 > 8;
  const floor = noSilence ? p2 + 4 : p20;
  const p50 = percentile(rms, 50), p95 = percentile(rms, 95);
  return { floor, on: floor + onDb, off: floor + offDb, p50, p95, dynamic: p95 - floor, noSilence };
}
