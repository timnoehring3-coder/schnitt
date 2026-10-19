// lib/paths.mjs — alle Orte, die die Engine kennt. Nichts davon ist hart auf einen Rechner gebunden.
import { homedir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

export const ENGINE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || resolve(ENGINE_ROOT, '..');
export const REMOTION_ROOT = resolve(PLUGIN_ROOT, 'remotion');
export const DASHBOARD_DIST = resolve(PLUGIN_ROOT, 'dashboard', 'dist');
export const CONFIG_DIR = process.env.SCHNITT_CONFIG || resolve(homedir(), '.config', 'schnitt');
export const PROJECTS_DIR = process.env.SCHNITT_PROJEKTE || resolve(homedir(), 'schnitt-projekte');
export const BIN_DIR = resolve(CONFIG_DIR, 'bin');
export const MODELS_DIR = resolve(CONFIG_DIR, 'models');

/** Whisper-Modell: Umgebungsvariable, dann Konfig-Ordner, dann Tims alter Ort. */
export function whisperModel(name = 'ggml-large-v3-turbo.bin') {
  const cands = [
    process.env.WHISPER_MODEL,
    resolve(MODELS_DIR, name),
    resolve(homedir(), 'whisper-models', name),
  ].filter(Boolean);
  return cands.find((p) => existsSync(p)) || cands[1];
}

/** Swift-Werkzeuge: kompiliert in ~/.config/schnitt/bin, sonst mitgelieferte Binaries. */
export function swiftTool(name) {
  const cands = [resolve(BIN_DIR, name), resolve(PLUGIN_ROOT, 'tools', 'swift', 'bin', name)];
  return cands.find((p) => existsSync(p)) || cands[0];
}
