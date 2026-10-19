// lib/spawn.mjs — Kindprozesse starten. Übernommen aus Tim OS (system/worker/claude.mjs::spawnStage):
// stdout zeilenweise an onLine, stderr durchreichen, AbortSignal killt hart.
import { spawn } from 'node:child_process';

const EXTRA_PATH = ['/opt/homebrew/bin', '/opt/homebrew/opt/node@22/bin', '/usr/local/bin', process.env.HOME + '/.local/bin'];
export const RUN_PATH = [...EXTRA_PATH, ...(process.env.PATH || '').split(':')].filter(Boolean).join(':');

export function spawnStage(cmd, args, onLine, signal, { cwd, env } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('abgebrochen')); return; }
    const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env, PATH: RUN_PATH } });
    let buf = '', err = '', done = false;
    const finish = (fn, v) => { if (done) return; done = true; signal?.removeEventListener('abort', onAbort); fn(v); };
    const onAbort = () => { try { child.kill('SIGKILL'); } catch { /* ignore */ } finish(reject, new Error('abgebrochen')); };
    signal?.addEventListener('abort', onAbort, { once: true });
    child.stdout.on('data', (d) => {
      buf += d.toString();
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, nl); buf = buf.slice(nl + 1); try { onLine?.(line); } catch { /* ignore */ } }
    });
    child.stderr.on('data', (d) => { err += d.toString(); if (err.length > 20000) err = err.slice(-10000); });
    child.on('close', (code) => {
      if (buf.trim()) { try { onLine?.(buf); } catch { /* ignore */ } }
      if (code === 0) finish(resolve, undefined);
      else { const lines = err.trim().split('\n'); const hit = lines.find((l) => /Error|error:|✗/.test(l)) || lines.slice(-3).join(' '); finish(reject, new Error(`${cmd} exit ${code}: ${hit.slice(0, 300)}`)); }
    });
    child.on('error', (e) => finish(reject, new Error(String(e?.message || e))));
  });
}

/** Führt ein Kommando aus und liefert stdout als String (stderr nur im Fehlerfall). */
export function run(cmd, args, { cwd, env, maxBuffer = 64 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env, PATH: RUN_PATH } });
    const out = [], err = [];
    let size = 0;
    child.stdout.on('data', (d) => { size += d.length; if (size <= maxBuffer) out.push(d); });
    child.stderr.on('data', (d) => { err.push(d); });
    child.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(out).toString());
      else reject(new Error(`${cmd} ${args.slice(0, 4).join(' ')}… exit ${code}: ${Buffer.concat(err).toString().trim().split('\n').slice(-3).join(' ').slice(0, 400)}`));
    });
    child.on('error', (e) => reject(new Error(String(e?.message || e))));
  });
}

/** Wie run(), liefert aber stdout als Buffer (für rohe Audio-/Bilddaten). */
export function runBuffer(cmd, args, { cwd, env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env, PATH: RUN_PATH } });
    const out = [], err = [];
    child.stdout.on('data', (d) => out.push(d));
    child.stderr.on('data', (d) => err.push(d));
    child.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new Error(`${cmd} exit ${code}: ${Buffer.concat(err).toString().trim().split('\n').slice(-3).join(' ').slice(0, 400)}`));
    });
    child.on('error', (e) => reject(new Error(String(e?.message || e))));
  });
}

/** Prüft, ob ein Kommando im PATH liegt. */
export async function which(cmd) {
  try { return (await run('/usr/bin/which', [cmd])).trim(); } catch { return null; }
}
