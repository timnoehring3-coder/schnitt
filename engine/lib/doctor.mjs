// lib/doctor.mjs — prüft nur, repariert nichts. Jede Zeile: {name, ok, detail, fix}.
import { existsSync, accessSync, constants, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { run, which } from './spawn.mjs';
import { node22 } from './node22.mjs';
import { CONFIG_DIR, PROJECTS_DIR, REMOTION_ROOT, DASHBOARD_DIST, whisperModel, BIN_DIR } from './paths.mjs';
import { status as licenseStatus } from './license.mjs';

async function ver(cmd, args, re) { try { const out = await run(cmd, args); const m = re.exec(out); return m ? m[1] : out.split('\n')[0].slice(0, 40); } catch { return null; } }

export async function doctor() {
  const rows = [];
  const add = (name, ok, detail, fix) => rows.push({ name, ok: Boolean(ok), detail, ...(ok ? {} : { fix }) });
  const ff = await ver('ffmpeg', ['-version'], /ffmpeg version (\S+)/); add('ffmpeg', ff, ff || 'fehlt', 'brew install ffmpeg');
  const fp = await which('ffprobe'); add('ffprobe', fp, fp || 'fehlt', 'brew install ffmpeg');
  const wc = await which('whisper-cli'); add('whisper-cli', wc, wc || 'fehlt', 'brew install whisper-cpp');
  const model = whisperModel(); add('Whisper-Modell', existsSync(model), existsSync(model) ? model : `${model} fehlt`, 'tools/install/setup.sh lädt ggml-large-v3-turbo.bin');
  const n22 = node22(); const nv = await ver(n22, ['-v'], /^(v\S+)/); add('node@22 (Remotion)', nv && nv.startsWith('v22'), nv ? `${nv} ${n22}` : 'fehlt', 'brew install node@22');
  const sw = await ver('swiftc', ['--version'], /version (\S+)/); add('swiftc (Apple Vision)', sw, sw || 'fehlt', 'xcode-select --install');
  const yt = await which('yt-dlp'); add('yt-dlp', yt, yt || 'fehlt (nur für Belege)', 'brew install yt-dlp');
  add('Remotion installiert', existsSync(resolve(REMOTION_ROOT, 'node_modules', 'remotion')), REMOTION_ROOT, 'cd remotion && npm install (mit node@22)');
  add('Dashboard gebaut', existsSync(resolve(DASHBOARD_DIST, 'index.html')), DASHBOARD_DIST, 'cd dashboard && npm run build');
  for (const t of ['detect-chin', 'person-cutout']) add(`Swift-Tool ${t}`, existsSync(resolve(BIN_DIR, t)), existsSync(resolve(BIN_DIR, t)) ? 'kompiliert' : 'wird beim ersten Aufruf kompiliert', '');
  try { mkdirSync(CONFIG_DIR, { recursive: true }); accessSync(CONFIG_DIR, constants.W_OK); add('Konfig-Ordner', true, CONFIG_DIR); } catch { add('Konfig-Ordner', false, CONFIG_DIR, 'Rechte prüfen'); }
  try { mkdirSync(PROJECTS_DIR, { recursive: true }); add('Projekt-Ordner', true, PROJECTS_DIR); } catch { add('Projekt-Ordner', false, PROJECTS_DIR, 'SCHNITT_PROJEKTE setzen'); }
  const lic = await licenseStatus(); add('Lizenz', lic.ok, lic.ok ? (lic.mode === 'dev' ? 'Entwicklungsmodus' : `${lic.variant || 'aktiv'}${lic.graceDaysLeft != null ? ` · Grace ${lic.graceDaysLeft} T` : ''}`) : lic.error, '/schnitt:lizenz <KEY>');
  const ok = rows.filter((r) => !r.ok && !/yt-dlp|Swift-Tool|Lizenz/.test(r.name)).length === 0;
  return { ok, rows };
}
