// asr/whisper.mjs — whisper-cli je Sprechblock mit Offset/Dauer. Ein 3-Sekunden-Schnipsel halluziniert nicht (CUT-STYLE).
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../lib/spawn.mjs';
import { whisperModel } from '../lib/paths.mjs';

/** Transkribiert [fromSec, fromSec+durSec] der WAV. Gibt Wörter {w, t0, t1, p} in Quell-Sekunden. */
export async function transcribeSpan(wav, fromSec, durSec, { lang = 'de', model, prompt = '', threads } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'schnitt-asr-'));
  const outBase = join(dir, 'w');
  const args = ['-m', model || whisperModel(), '-f', wav,
    '-ot', String(Math.max(0, Math.round(fromSec * 1000))), '-d', String(Math.round(durSec * 1000)),
    '-l', lang, '-ml', '1', '-sow', '-ojf', '-of', outBase, '-np'];
  if (prompt) args.push('--prompt', prompt);
  if (threads) args.push('-t', String(threads));
  try {
    await run('whisper-cli', args);
    const j = JSON.parse(readFileSync(outBase + '.json', 'utf8'));
    const words = [];
    for (const seg of j.transcription || []) {
      const w = String(seg.text || '').trim();
      if (!w) continue;
      const p = seg.tokens?.length ? seg.tokens.reduce((s, t) => s + (t.p || 0), 0) / seg.tokens.length : null;
      words.push({ w, t0: seg.offsets.from / 1000, t1: seg.offsets.to / 1000, p: p == null ? null : Math.round(p * 1000) / 1000 });
    }
    return words;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
