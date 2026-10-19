import React, { useEffect, useState } from 'react';
import { api, fmt } from '../api.js';
import { StepRail } from './StepRail.jsx';
import { TakePicker } from './TakePicker.jsx';
import { SeamReport } from './SeamReport.jsx';
import { Preview } from './Preview.jsx';

export function Project({ id, live, logs, tick }) {
  const [p, setP] = useState(null);
  const [tab, setTab] = useState('takes');
  const [err, setErr] = useState('');
  useEffect(() => { api.project(id).then(setP).catch((e) => setErr(e.message)); }, [id, tick]);
  if (err) return <div className="empty">{err}</div>;
  if (!p) return <div className="muted">Lade …</div>;
  const running = live?.status === 'running';
  return (
    <>
      <div className="row" style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0 }}>{p.name || p.id}</h1>
        <span className="muted">{p.source.kind === 'cut' ? 'fertig geschnitten' : 'Rohaufnahme'} · {fmt(p.source.duration)} · {p.source.width}×{p.source.height} · {p.fps} fps</span>
        <span className="muted mono" style={{ marginLeft: 'auto' }}>{p.dir}</span>
      </div>
      <StepRail project={p} live={live} logs={logs} />
      <div className="tabs" style={{ marginTop: 22 }}>
        {[['takes', 'Takes'], ['seams', 'Nähte'], ['preview', 'Vorschau']].map(([k, l]) => <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'takes' ? <TakePicker project={p} running={running} tick={tick} /> : null}
      {tab === 'seams' ? <SeamReport project={p} tick={tick} /> : null}
      {tab === 'preview' ? <Preview project={p} tick={tick} /> : null}
    </>
  );
}
