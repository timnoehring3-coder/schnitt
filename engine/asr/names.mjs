// asr/names.mjs — Namenswörterbuch: Whisper verhört Produktnamen zuverlässig („Cloud Code“ → Claude Code).
// names.json im Projekt: { "falsch": "richtig", "cloud code": "Claude Code" } — Schlüssel klein, auch Mehrwort.
import { existsSync } from 'node:fs';
import { readJson } from '../lib/project.mjs';
import { normTok, simRatio } from '../lib/text.mjs';

export function loadNames(project, profileNames = {}) {
  const file = project.path('names.json');
  const own = existsSync(file) ? readJson(file) : {};
  const map = {};
  for (const [k, v] of Object.entries({ ...profileNames, ...own })) map[k.toLowerCase().trim()] = v;
  return map;
}

/** Ersetzt Einzel- und Mehrwort-Treffer (bis 3 Wörter) in der Wortliste. Mehrwort → ein Wort mit Gesamtspanne. */
export function applyNames(words, map) {
  const keys = Object.keys(map);
  if (!keys.length) return { words, hits: 0 };
  const byLen = { 1: [], 2: [], 3: [] };
  for (const k of keys) { const n = k.split(/\s+/).length; if (byLen[n]) byLen[n].push(k); }
  const out = [];
  let hits = 0;
  for (let i = 0; i < words.length; i++) {
    let done = false;
    for (const n of [3, 2, 1]) {
      if (i + n > words.length) continue;
      const phrase = words.slice(i, i + n).map((w) => normTok(w.w)).join(' ');
      let k = byLen[n].find((key) => key.split(/\s+/).map(normTok).join(' ') === phrase);
      if (!k && n === 1 && phrase.length >= 4) k = byLen[1].find((key) => normTok(key).length >= 5 && simRatio(normTok(key), phrase) >= 0.72);
      if (k) {
        const last = words[i + n - 1];
        out.push({ ...words[i], w: map[k], t1: last.t1, p: words[i].p, fixed: true });
        i += n - 1; hits++; done = true; break;
      }
    }
    if (!done) out.push(words[i]);
  }
  return { words: out, hits };
}

/** Die richtigen Formen als Whisper-Prompt (hilft dem Modell, sie zu erkennen). */
export function promptFromNames(map, extra = []) {
  const forms = [...new Set([...Object.values(map), ...extra])];
  return forms.length ? forms.join(', ') + '.' : '';
}
