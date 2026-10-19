// lib/ffmpeg.mjs — ffprobe/ffmpeg-Helfer. Alle Zeiten in Sekunden, Frames nur, wo gesagt.
import { run, runBuffer } from './spawn.mjs';

/** Metadaten einer Mediendatei. fps als Zahl, rotation aus den Side-Data, falls vorhanden. */
export async function probe(file) {
  const out = await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]);
  const j = JSON.parse(out);
  const v = (j.streams || []).find((s) => s.codec_type === 'video');
  const a = (j.streams || []).find((s) => s.codec_type === 'audio');
  const fpsOf = (s) => { if (!s) return null; const [n, d] = String(s.avg_frame_rate || s.r_frame_rate || '0/1').split('/').map(Number); return d ? n / d : null; };
  const rot = v?.side_data_list?.find((s) => s.rotation != null)?.rotation ?? (v?.tags?.rotate != null ? Number(v.tags.rotate) : 0);
  return {
    duration: Number(j.format?.duration || v?.duration || 0),
    fps: fpsOf(v),
    width: v?.width || null,
    height: v?.height || null,
    rotation: Number(rot) || 0,
    codec: v?.codec_name || null,
    hasAudio: Boolean(a),
    audioRate: a ? Number(a.sample_rate) : null,
    audioChannels: a ? Number(a.channels) : null,
  };
}

/** Mono-PCM der Tonspur als Float32Array (Werte −1…1) bei sampleRate Hz. */
export async function pcmFloat(file, sampleRate = 16000) {
  const buf = await runBuffer('ffmpeg', ['-nostdin', '-v', 'error', '-i', file, '-vn', '-ac', '1', '-ar', String(sampleRate), '-f', 'f32le', '-']);
  return new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
}

/** Schreibt eine 16-kHz-Mono-WAV (für whisper-cli). */
export async function wav16k(file, out) {
  await run('ffmpeg', ['-nostdin', '-y', '-v', 'error', '-i', file, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', out]);
  return out;
}

export const secToFrame = (s, fps) => Math.round(s * fps);
export const frameToSec = (f, fps) => f / fps;
