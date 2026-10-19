import React, { useEffect, useState } from 'react';
import { api, fmt, STEP_LABEL } from '../api.js';

export function ProjectList({ live, tick }) {
  const [list, setList] = useState(null);
  const [src, setSrc] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState('raw');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { api.projects().then((d) => setList(d.projects)).catch(() => setList([])); }, [tick]);
  const create = async () => {
    setBusy(true); setErr('');
    try { const r = await api.create(src.trim().replace(/^file:\/\//, ''), name.trim() || undefined, kind); location.hash = `projekt/${r.id}`; }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <>
      <h1>Projekte</h1>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="row">
          <input style={{ flex: '1 1 420px' }} placeholder="Pfad zur Aufnahme (.mov/.mp4) — aus dem Finder hierher ziehen" value={src} onChange={(e) => setSrc(e.target.value)}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f?.path) setSrc(f.path); else { const t = e.dataTransfer.getData('text/plain'); if (t) setSrc(t); } }} onDragOver={(e) => e.preventDefault()} />
          <input style={{ width: 180 }} placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="raw">Rohaufnahme mit Takes</option>
            <option value="cut">fertig geschnitten</option>
          </select>
          <button className="primary" disabled={!src.trim() || busy} onClick={create}>Projekt anlegen</button>
        </div>
        {err ? <div className="muted" style={{ marginTop: 8 }}>{err}</div> : null}
      </div>
      {!list ? <div className="muted">Lade …</div> : !list.length ? <div className="empty">Noch kein Projekt. Oben eine Aufnahme eintragen.</div> : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {list.map((p) => {
            const steps = p.steps || {}; const done = Object.values(steps).filter((s) => s.status === 'done').length;
            const l = live[p.id];
            return (
              <div key={p.id} className="card clickable" onClick={() => (location.hash = `projekt/${p.id}`)}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{p.name || p.id}</div>
                <div className="kv">
                  <span className="muted">Quelle</span><span>{p.source?.kind === 'cut' ? 'fertig geschnitten' : 'Rohaufnahme'} · {p.source?.duration ? fmt(p.source.duration) : '–'}</span>
                  <span className="muted">Stand</span><span>{l?.status === 'running' ? `${STEP_LABEL[l.step] || l.step} ${l.pct}%` : steps.render?.status === 'done' ? 'gerendert' : steps.cut?.status === 'done' ? 'geschnitten' : `${done} Schritte`}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
