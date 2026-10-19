import React, { useEffect, useState } from 'react';
import { api, subscribe } from './api.js';
import { ProjectList } from './components/ProjectList.jsx';
import { Project } from './components/Project.jsx';

function useHash() {
  const [h, setH] = useState(location.hash.slice(1));
  useEffect(() => { const f = () => setH(location.hash.slice(1)); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return h;
}

export function App() {
  const hash = useHash();
  const [status, setStatus] = useState(null);
  const [live, setLive] = useState({});            // projectId → {step, pct, stage, status}
  const [logs, setLogs] = useState({});            // projectId → [lines]
  const [tick, setTick] = useState(0);             // zählt hoch, wenn ein Schritt endet oder eine Datei sich ändert
  useEffect(() => { api.status().then(setStatus).catch(() => setStatus({ error: 'Server nicht erreichbar' })); }, [tick]);
  useEffect(() => subscribe({
    progress: (d) => setLive((l) => ({ ...l, [d.project]: { ...(l[d.project] || {}), step: d.step, pct: d.pct, stage: d.stage, status: 'running' } })),
    step: (d) => { setLive((l) => ({ ...l, [d.project]: d.status === 'running' ? { step: d.step, pct: 0, stage: d.step, status: 'running' } : { step: d.step, status: d.status, pct: 100 } })); if (d.status !== 'running') setTick((t) => t + 1); },
    log: (d) => setLogs((l) => ({ ...l, [d.project]: [...(l[d.project] || []).slice(-300), `[${d.step}] ${d.line}`] })),
    file: () => setTick((t) => t + 1),
  }), []);
  const [, id] = /^projekt\/(.+)$/.exec(hash) || [];
  return (
    <>
      <header className="taskbar">
        <a href="#" className="brand" style={{ textDecoration: 'none' }}><Globe /> schnitt</a>
        <nav className="nav">
          <button className={!id ? 'active' : ''} onClick={() => (location.hash = '')}>Projekte</button>
        </nav>
        <div className="right">
          {status?.license ? <span>{status.license.ok ? (status.license.mode === 'dev' ? 'Entwicklung' : `Lizenz ${status.license.variant || 'aktiv'}`) : 'keine Lizenz'}</span> : null}
          {status?.error ? <span>{status.error}</span> : null}
        </div>
      </header>
      <main className="page">
        {id ? <Project id={decodeURIComponent(id)} live={live[decodeURIComponent(id)]} logs={logs[decodeURIComponent(id)] || []} tick={tick} /> : <ProjectList live={live} tick={tick} />}
      </main>
    </>
  );
}

function Globe() {
  return <svg width="18" height="18" viewBox="0 0 32 32"><g fill="#fff"><circle cx="10" cy="10" r="2"/><circle cx="16" cy="10" r="2"/><circle cx="22" cy="10" r="2"/><circle cx="8" cy="16" r="2"/><circle cx="16" cy="16" r="2.4"/><circle cx="24" cy="16" r="2"/><circle cx="10" cy="22" r="2"/><circle cx="16" cy="22" r="2"/><circle cx="22" cy="22" r="2"/></g></svg>;
}
