import React, { useEffect, useRef, useState } from 'react';
import { api, STEP_LABEL } from '../api.js';

export function StepRail({ project, live, logs }) {
  const [showLog, setShowLog] = useState(false);
  const logRef = useRef(null);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logs, showLog]);
  const running = live?.status === 'running';
  const run = (steps, force) => api.run(project.id, steps, { force }).catch((e) => alert(e.message));
  const chain = project.chain;
  const firstOpen = chain.find((s) => project.steps[s]?.status !== 'done');
  return (
    <div>
      <div className="steps">
        {chain.map((s) => {
          const st = project.steps[s];
          const isLive = running && live.step === s;
          const cls = isLive ? 'running' : st?.status === 'done' ? 'done' : st?.status === 'error' ? 'error' : '';
          const sum = st?.summary;
          return (
            <div key={s} className={`step ${cls}`}>
              <div className="name">{STEP_LABEL[s] || s}</div>
              <div className="st">{isLive ? `${live.stage || ''} ${live.pct}%` : st?.status === 'done' ? summaryLine(s, sum) : st?.status === 'error' ? 'Fehler' : 'offen'}</div>
              <div className="bar"><i style={{ width: `${isLive ? live.pct : st?.status === 'done' ? 100 : 0}%` }} /></div>
              <div className="row" style={{ gap: 4 }}>
                <button className="small" disabled={running} onClick={() => run([s], true)}>{st?.status === 'done' ? 'neu' : 'start'}</button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        {running ? <button onClick={() => api.stop(project.id)}>Abbrechen</button> : <button className="primary" onClick={() => run(['run'], false)}>{firstOpen ? `Alles bis Render (weiter bei ${STEP_LABEL[firstOpen]})` : 'Alles neu rendern'}</button>}
        <button className="ghost" onClick={() => setShowLog((v) => !v)}>{showLog ? 'Protokoll ausblenden' : 'Protokoll'}</button>
      </div>
      {showLog ? <div className="log" ref={logRef}>{logs.length ? logs.join('\n') : 'noch nichts'}</div> : null}
    </div>
  );
}

function summaryLine(step, s) {
  if (!s) return 'fertig';
  switch (step) {
    case 'analyse': return `${Math.round(s.seconds)} s · Boden ${Math.round(s.floorDb)} dB`;
    case 'blocks': return `${s.blocks} Blöcke · ${s.takes} Takes`;
    case 'asr': return `${s.words} Wörter`;
    case 'takes': return `${s.chosen}/${s.groups} Sätze · ${s.chosenSeconds} s`;
    case 'seams': return `${s.segments} Segmente`;
    case 'cut': return `${s.seconds} s · ${s.inCorridor}/${s.seams} Nähte`;
    case 'chin': return `${s.detected}/${s.segments} Gesichter`;
    case 'untertitel': return `${s.pages} Wörter`;
    case 'render': return `${s.seconds} s`;
    case 'splices': return `${s.count ?? s.splices} Klebestellen`;
    default: return 'fertig';
  }
}
