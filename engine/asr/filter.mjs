// asr/filter.mjs — Whisper-Artefakte aussortieren. Erkenntnis aus den Block-Läufen: Dauer-0-Wörter sind in
// KURZEN Spannen oft echte Wörter mit kollabiertem Timing — also nicht blind verwerfen. Verworfen wird:
// Nicht-Sprache ([BLANK_AUDIO], (Musik), Amara-Untertitel) · Schleifen (gleiche Wortfolge ≥ 3×) → eine ·
// unplausible Dichte (> maxWordsPerSec) → Block-Flag „dense“, Text bleibt.
const NON_SPEECH = /^(\[.*\]|\(.*\)|\*.*\*|♪.*|\.{2,}|[-–—]+|Untertitel.*|Amara\.org.*|Vielen Dank\.?|Copyright.*)$/i;

export { normTok } from '../lib/text.mjs';
import { normTok } from '../lib/text.mjs';

export function filterWords(words, { maxWordsPerSec = 6, spanSec = null } = {}) {
  const flags = [];
  let out = words.filter((w) => !NON_SPEECH.test(w.w) && normTok(w.w).length);
  if (out.length !== words.length) flags.push({ rule: 'nonspeech', n: words.length - out.length });
  for (let win = 1; win <= 4; win++) {
    let i = 0;
    while (i + win * 3 <= out.length) {
      const key = out.slice(i, i + win).map((w) => normTok(w.w)).join(' ');
      let reps = 1;
      while (i + (reps + 1) * win <= out.length && out.slice(i + reps * win, i + (reps + 1) * win).map((w) => normTok(w.w)).join(' ') === key) reps++;
      if (reps >= 3 && key.replace(/\s/g, '').length) {
        out.splice(i + win, (reps - 1) * win);
        flags.push({ rule: 'loop', phrase: key, reps });
      }
      i++;
    }
  }
  if (spanSec && out.length / spanSec > maxWordsPerSec) flags.push({ rule: 'dense', wps: +(out.length / spanSec).toFixed(1) });
  return { words: out, flags };
}
