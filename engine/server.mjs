// server.mjs — der lokale Dashboard-Server. 127.0.0.1 only, kein Auth (nur dieser Rechner). Liefert dashboard/dist,
// eine kleine JSON-API über der Bühne und einen SSE-Strom (/events) mit Fortschritt und Logs laufender Schritte.
// Schritte laufen als Kindprozess der CLI, damit Dashboard und Claude exakt denselben Code treffen.
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync, readFileSync } from 'node:fs';
import { resolve, extname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { listProjects, loadProject, createProject, readJson, writeJson } from './lib/project.mjs';
import { chain, STEPS } from './steps.mjs';
import { DASHBOARD_DIST, ENGINE_ROOT, PROJECTS_DIR } from './lib/paths.mjs';
import { parseLine, log } from './lib/progress.mjs';
import { status as licenseStatus } from './lib/license.mjs';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const clients = new Set();
const running = new Map();   // projectId → {step, child, pct, stage, startedAt}

function sse(ev, data) { const msg = `event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`; for (const c of clients) c.write(msg); }
function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); }
async function body(req) { let s = ''; for await (const ch of req) s += ch; return s ? JSON.parse(s) : {}; }

function serveFile(req, res, file, { download = false } = {}) {
  if (!existsSync(file)) return json(res, 404, { error: 'nicht gefunden' });
  const st = statSync(file), type = MIME[extname(file).toLowerCase()] || 'application/octet-stream';
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store', ...(download ? { 'Content-Disposition': `attachment; filename="${file.split('/').pop()}"` } : {}) };
  if (range) {
    const start = range[1] ? Number(range[1]) : 0, end = range[2] ? Number(range[2]) : st.size - 1;
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
    return createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...headers, 'Content-Length': st.size });
  createReadStream(file).pipe(res);
}

function startSteps(project, steps, opts = {}) {
  const [first, ...rest] = steps;
  const st = startStep(project, first, opts);
  if (rest.length) st.child.on('close', (code) => { if (code === 0) { try { startSteps(loadProject(project.dir), rest, opts); } catch (e) { sse('log', { project: project.json.id, step: rest[0], line: `✗ ${e.message}` }); } } });
  return st;
}

function startStep(project, step, opts = {}) {
  if (running.has(project.json.id)) throw new Error(`läuft bereits: ${running.get(project.json.id).step}`);
  const args = [resolve(ENGINE_ROOT, 'cli.mjs'), step === 'run' ? 'run' : step, project.dir];
  if (opts.force) args.push('--force');
  if (opts.bis) args.push('--bis', opts.bis);
  const child = spawn(process.execPath, args, { env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'] });
  const state = { step, pct: 0, stage: step, startedAt: Date.now(), child };
  running.set(project.json.id, state);
  sse('step', { project: project.json.id, step, status: 'running', pct: 0 });
  let out = '', err = '';
  child.stdout.on('data', (d) => { out += d; let i; while ((i = out.indexOf('\n')) >= 0) { const line = out.slice(0, i); out = out.slice(i + 1); const p = parseLine(line); if (p?.type === 'progress') { state.pct = p.pct; state.stage = p.stage; sse('progress', { project: project.json.id, step, pct: p.pct, stage: p.stage }); } } });
  child.stderr.on('data', (d) => { err += d; let i; while ((i = err.indexOf('\n')) >= 0) { const line = err.slice(0, i); err = err.slice(i + 1); if (line.trim()) sse('log', { project: project.json.id, step, line }); } });
  child.on('close', (code) => { running.delete(project.json.id); sse('step', { project: project.json.id, step, status: code === 0 ? 'done' : 'error', code }); });
  return state;
}

export async function serve({ port = 4747, open = true } = {}) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const p = url.pathname;
    try {
      if (p === '/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
        res.write(':ok\n\n'); clients.add(res); req.on('close', () => clients.delete(res));
        for (const [id, s] of running) res.write(`event: progress\ndata: ${JSON.stringify({ project: id, step: s.step, pct: s.pct, stage: s.stage })}\n\n`);
        return;
      }
      if (p === '/api/status') return json(res, 200, { ok: true, projectsDir: PROJECTS_DIR, steps: Object.keys(STEPS), license: await licenseStatus(), running: [...running].map(([id, s]) => ({ project: id, step: s.step, pct: s.pct })) });
      if (p === '/api/projekte' && req.method === 'GET') return json(res, 200, { projects: listProjects() });
      if (p === '/api/projekte' && req.method === 'POST') {
        const b = await body(req);
        const { dir, json: pj } = await createProject(b.source, { name: b.name, kind: b.kind === 'cut' ? 'cut' : 'raw', fps: b.fps || 30 });
        return json(res, 200, { ok: true, dir, id: pj.id });
      }
      const m = /^\/api\/projekt\/([^/]+)(?:\/(.*))?$/.exec(p);
      if (m) {
        const project = loadProject(decodeURIComponent(m[1]));
        const rest = m[2] || '';
        if (!rest && req.method === 'GET') return json(res, 200, { ...project.json, chain: chain(project.json.source.kind), running: running.get(project.json.id) ? { step: running.get(project.json.id).step, pct: running.get(project.json.id).pct } : null });
        if (rest === 'run' && req.method === 'POST') { const b = await body(req); startSteps(project, Array.isArray(b.steps) && b.steps.length ? b.steps : [b.step || 'run'], b); return json(res, 200, { ok: true }); }
        if (rest === 'stop' && req.method === 'POST') { const s = running.get(project.json.id); if (s) s.child.kill('SIGTERM'); return json(res, 200, { ok: true, stopped: Boolean(s) }); }
        if (rest.startsWith('datei/')) {
          const name = rest.slice(6);
          if (!/^[\w./-]+\.json$/.test(name) || name.includes('..')) return json(res, 400, { error: 'nur JSON der Bühne' });
          const file = project.path(name);
          if (req.method === 'GET') return existsSync(file) ? json(res, 200, readJson(file)) : json(res, 404, { error: 'fehlt' });
          if (req.method === 'PUT') { writeJson(file, await body(req)); sse('file', { project: project.json.id, file: name }); return json(res, 200, { ok: true }); }
        }
        if (rest.startsWith('media/') || rest.startsWith('out/') || rest.startsWith('check/')) {
          if (rest.includes('..')) return json(res, 400, { error: 'Pfad' });
          return serveFile(req, res, project.path(rest), { download: url.searchParams.has('download') });
        }
        return json(res, 404, { error: 'unbekannte Route' });
      }
      // Dashboard (statisch) + SPA-Fallback
      let file = join(DASHBOARD_DIST, p === '/' ? 'index.html' : p);
      if (!existsSync(file) || statSync(file).isDirectory()) file = join(DASHBOARD_DIST, 'index.html');
      if (!existsSync(file)) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end('<!doctype html><title>schnitt</title><body style="font:16px -apple-system;background:#000;color:#fff;padding:40px">Dashboard nicht gebaut — <code>cd dashboard && npm run build</code>. Die API läuft: <a style="color:#fff" href="/api/status">/api/status</a></body>'); }
      serveFile(req, res, file);
    } catch (e) { json(res, 500, { error: String(e?.message || e) }); }
  });
  await new Promise((ok) => server.listen(port, '127.0.0.1', ok));
  const url = `http://127.0.0.1:${port}`;
  log(`schnitt-Dashboard: ${url}`);
  process.stdout.write(`@@READY ${url}\n`);
  if (open) spawn('open', [url], { stdio: 'ignore' }).on('error', () => {});
  return new Promise(() => {});
}
