import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export function Preview({ project, tick }) {
  const hasFinal = project.steps.render?.status === 'done';
  const hasCam = project.steps.cut?.status === 'done';
  const rel = hasFinal ? 'out/final.mp4' : hasCam ? 'media/camera.mp4' : null;
  const [v, setV] = useState(0);
  useEffect(() => setV((x) => x + 1), [tick]);
  if (!rel) return <div className="empty">Noch kein Schnitt.</div>;
  return (
    <div className="preview">
      <video key={`${rel}-${v}`} controls src={`${api.media(project.id, rel)}?v=${v}`} />
      <div>
        <div className="kv">
          <span className="muted">Datei</span><span className="mono">{rel}</span>
          <span className="muted">Länge</span><span>{project.steps[hasFinal ? 'render' : 'cut']?.summary?.seconds} s</span>
          {hasFinal ? null : <><span className="muted">Hinweis</span><span>Kamera-Schnitt ohne Untertitel. „Render“ baut das fertige Video.</span></>}
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <a href={`${api.media(project.id, rel)}?download`}><button className="primary">Herunterladen</button></a>
          <button className="ghost" onClick={() => navigator.clipboard?.writeText(`${project.dir}/${rel}`)}>Pfad kopieren</button>
        </div>
      </div>
    </div>
  );
}
