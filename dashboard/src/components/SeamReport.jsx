import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export function SeamReport({ project, tick }) {
  const [m, setM] = useState(undefined);
  useEffect(() => { api.fileOrNull(project.id, 'check/seams.json').then(setM); }, [project.id, tick]);
  if (m === undefined) return <div className="muted">Lade …</div>;
  if (!m) return <div className="empty">Noch kein Schnitt. Erst „Schnitt“ ausführen.</div>;
  const soft = m.seams.filter((s) => !s.hard);
  return (
    <>
      <div className="row" style={{ gap: 24, marginBottom: 14 }}>
        <Stat l="Härte" v={m.haerte} />
        <Stat l="Nähte im Korridor" v={`${m.inCorridor}/${m.nSeams}`} sub={`${m.corridorMs[0]}–${m.corridorMs[1]} ms · Median ${m.medianMs} ms`} />
        <Stat l="harte Nähte" v={m.hardSeams} sub="Schnitt mitten im Satz" />
        <Stat l="Stille" v={`${m.silenceSec} s`} sub={`von ${m.durationSec} s`} />
        <Stat l="Tempo" v={`${m.wpm} WPM`} sub={`${m.words} Wörter`} />
        {m.haerte !== 'hart' ? <Stat l="Anlaut / Auslaut heiß" v={`${m.startsHot.length} / ${m.endsHot.length}`} /> : null}
      </div>
      <table>
        <thead><tr><th>#</th><th className="num">Frame</th><th className="num">Zeit</th><th>von Block</th><th>nach Block</th><th className="num">Stille</th><th>Urteil</th></tr></thead>
        <tbody>
          {m.seams.map((s) => (
            <tr key={s.i}><td>{s.i}</td><td className="num">{s.frame}</td><td className="num">{(s.frame / project.fps).toFixed(2)} s</td><td>{s.from}</td><td>{s.to}</td><td className="num">{s.hard ? '–' : `${s.ms} ms`}</td><td className={s.ok ? 'ok' : 'bad'}>{s.hard ? 'hart (im Satz)' : s.ok ? 'im Korridor' : s.ms < m.corridorMs[0] ? 'zu knapp' : 'zu lang'}</td></tr>
          ))}
        </tbody>
      </table>
      {soft.length === 0 ? <div className="muted" style={{ marginTop: 10 }}>Keine weichen Nähte.</div> : null}
    </>
  );
}
function Stat({ l, v, sub }) { return <div><div className="muted" style={{ fontSize: 12 }}>{l}</div><div style={{ fontSize: 20, fontWeight: 600 }}>{v}</div>{sub ? <div className="muted" style={{ fontSize: 12 }}>{sub}</div> : null}</div>; }
