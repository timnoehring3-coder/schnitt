// TakePicker.jsx — Satzgruppen → Versuche an/aus, Reihenfolge, Kanten je Segment (1-F-Raster), Vorhören, Namen.
// Schreibt ausschließlich selects.json (und names.json); „Schnitt bauen“ ruft seams → cut → chin → untertitel.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api, fmt } from '../api.js';
import { Waveform, waveFocus } from './Waveform.jsx';

export function TakePicker({ project, running, tick }) {
  const id = project.id, fps = project.fps;
  const [sel, setSel] = useState(null);         // selects.json
  const [blocks, setBlocks] = useState(null);
  const [peaks, setPeaks] = useState(null);
  const [words, setWords] = useState(null);
  const [names, setNames] = useState({});
  const [cur, setCur] = useState(null);         // gewähltes Select (id)
  const [dirty, setDirty] = useState(false);
  const [cursor, setCursor] = useState(null);
  const audio = useRef(null);
  useEffect(() => {
    api.fileOrNull(id, 'selects.json').then((d) => { setSel(d); setDirty(false); });
    api.fileOrNull(id, 'blocks.json').then(setBlocks);
    api.fileOrNull(id, 'audio/peaks.json').then(setPeaks);
    api.fileOrNull(id, 'words-src.json').then(setWords);
    api.fileOrNull(id, 'names.json').then((d) => setNames(d || {}));
  }, [id, tick]);
  useEffect(() => { const a = audio.current; if (!a) return; const f = () => setCursor(a.currentTime); a.addEventListener('timeupdate', f); return () => a.removeEventListener('timeupdate', f); });

  const enabled = useMemo(() => (sel?.selects || []).filter((s) => s.enabled).sort((a, b) => (a.order ?? a.t0) - (b.order ?? b.t0)), [sel]);
  const segments = useMemo(() => enabled.flatMap((s) => (s.segments || [{ inSec: s.t0, outSec: s.t1 }]).map((g) => ({ ...g, select: s.id }))), [enabled]);
  const total = segments.reduce((a, g) => a + (g.outSec - g.inSec), 0);
  const current = sel?.selects.find((s) => s.id === cur) || null;

  const update = (fn) => { setSel((s) => { const n = structuredClone(s); fn(n); return n; }); setDirty(true); };
  const toggle = (s) => update((n) => { const t = n.selects.find((x) => x.id === s.id); t.enabled = !t.enabled; if (t.enabled && t.order == null) t.order = t.t0; });
  const play = (t0, t1) => { const a = audio.current; if (!a) return; a.currentTime = t0; a.play(); const stop = () => { if (a.currentTime >= t1) { a.pause(); a.removeEventListener('timeupdate', stop); } }; a.addEventListener('timeupdate', stop); };
  const nudge = (k, edge, df) => update((n) => { const t = n.selects.find((x) => x.id === cur); const g = t.segments[k]; g[edge] = Math.max(0, g[edge] + df); if (g.out <= g.in + 2) g[edge === 'in' ? 'out' : 'in'] = edge === 'in' ? g.in + 3 : g.out - 3; g.inSec = +(g.in / fps).toFixed(3); g.outSec = +(g.out / fps).toFixed(3); t.locked = true; });
  const unlock = () => update((n) => { const t = n.selects.find((x) => x.id === cur); t.locked = false; });
  const move = (s, dir) => update((n) => { const list = n.selects.filter((x) => x.enabled).sort((a, b) => (a.order ?? a.t0) - (b.order ?? b.t0)); const i = list.findIndex((x) => x.id === s.id); const j = i + dir; if (j < 0 || j >= list.length) return; list.forEach((x, k) => { x.order = k; }); const a = list[i].order; list[i].order = list[j].order; list[j].order = a; });
  const save = async () => { await api.save(id, 'selects.json', sel); setDirty(false); };
  const build = async () => { if (dirty) await save(); await api.run(id, ['seams', 'cut', 'chin', 'untertitel']); };

  if (sel === undefined || !sel) return <div className="empty">{project.steps.takes?.status === 'done' ? 'Lade …' : 'Noch keine Takes. Erst die Schritte bis „Takes“ ausführen.'}</div>;
  return (
    <>
      <audio ref={audio} src={api.media(id, 'media/audio16k.wav')} preload="auto" />
      <Waveform peaks={peaks} duration={project.source.duration} blocks={blocks?.blocks} segments={segments} cursor={cursor} selected={cur} onSeek={(t) => { const a = audio.current; a.currentTime = t; a.play(); }} />
      <div className="row" style={{ margin: '10px 0 16px' }}>
        <span className="dim">{enabled.length} Versuche gewählt · {fmt(total)} ({total.toFixed(1)} s)</span>
        <span className="muted">Rad = Zoom · Shift+Rad = schieben · Klick = abspielen · Doppelklick auf Versuch = vorhören</span>
        <span style={{ marginLeft: 'auto' }} />
        <button onClick={save} disabled={!dirty || running}>Speichern</button>
        <button className="primary" onClick={build} disabled={running}>Schnitt bauen</button>
      </div>
      <div className="groups">
        {sel.groups.map((g) => {
          const takes = g.takes.map((i) => sel.selects[i]).filter(Boolean);
          return (
            <div className="group" key={g.id}>
              <div className="text"><span className="muted mono">S{g.id}</span> {g.skipped ? <span className="muted">({g.skipped})</span> : null}<br /><b>{(takes.find((t) => t.enabled) || takes[0])?.text}</b></div>
              <div className="takes">
                {takes.map((t) => (
                  <div key={t.id} className={`take ${t.enabled ? 'on' : ''} ${cur === t.id ? 'sel' : ''} ${t.judged === 'reject' ? 'rej' : ''} ${t.locked ? 'locked' : ''}`}
                    title={`${t.text}\n${t.t0.toFixed(2)}–${t.t1.toFixed(2)} s · ${t.nWords} Wörter${t.reason ? ` · ${t.reason}` : ''}${t.comment ? ` · „${t.comment}“` : ''}`}
                    onClick={() => { setCur(t.id); waveFocus(t.t0, t.t1); }} onDoubleClick={() => play(t.t0, t.t1)}>
                    {t.id}<span className="d">{t.dur.toFixed(1)} s · {t.nWords} W{t.judged === 'accept' ? ' · ok' : ''}</span>
                    <button className="small ghost" style={{ marginLeft: 8, padding: '0 6px' }} onClick={(e) => { e.stopPropagation(); toggle(t); }}>{t.enabled ? 'aus' : 'an'}</button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <h2>Reihenfolge</h2>
      <table><tbody>
        {enabled.map((s, i) => (
          <tr key={s.id}><td className="num">{i + 1}</td><td className="mono">{s.id}</td><td>{s.text}</td><td className="num">{s.dur.toFixed(1)} s</td>
            <td style={{ whiteSpace: 'nowrap' }}><button className="small ghost" onClick={() => move(s, -1)} disabled={i === 0}>hoch</button> <button className="small ghost" onClick={() => move(s, 1)} disabled={i === enabled.length - 1}>runter</button></td></tr>
        ))}
      </tbody></table>
      <h2>Namen</h2>
      <NamesEditor id={id} names={names} setNames={setNames} />
      {current ? (
        <div className="detail">
          <div><b>{current.id}</b> <span className="muted">Block {current.blockIds.join(', ')} · {current.t0.toFixed(2)}–{current.t1.toFixed(2)} s</span>{current.locked ? <span className="pill" style={{ marginLeft: 8 }}>Hand-Kanten</span> : null}</div>
          <div className="words">{words ? words.words.slice(current.words[0], current.words[1] + 1).map((w, i) => <span key={i}>{w.w}</span>) : current.text}</div>
          {(current.segments || []).map((g, k) => (
            <div className="edge" key={k}>
              <span className="muted">Ein</span>
              <button className="small" onClick={() => nudge(k, 'in', -5)}>−5</button><button className="small" onClick={() => nudge(k, 'in', -1)}>−1</button>
              <span className="v">{g.in} F</span>
              <button className="small" onClick={() => nudge(k, 'in', 1)}>+1</button><button className="small" onClick={() => nudge(k, 'in', 5)}>+5</button>
              <span className="muted" style={{ marginLeft: 10 }}>Aus</span>
              <button className="small" onClick={() => nudge(k, 'out', -5)}>−5</button><button className="small" onClick={() => nudge(k, 'out', -1)}>−1</button>
              <span className="v">{g.out} F</span>
              <button className="small" onClick={() => nudge(k, 'out', 1)}>+1</button><button className="small" onClick={() => nudge(k, 'out', 5)}>+5</button>
              <button className="small ghost" onClick={() => play(Math.max(0, g.in / fps - 0.4), g.in / fps + 0.6)}>Ein hören</button>
              <button className="small ghost" onClick={() => play(Math.max(0, g.out / fps - 0.6), g.out / fps + 0.4)}>Aus hören</button>
            </div>
          ))}
          {!current.segments?.length ? <span className="muted">Kanten entstehen beim Schritt „Nähte“.</span> : null}
          {current.locked ? <button className="small ghost" onClick={unlock}>Kanten wieder automatisch</button> : null}
          <button className="small ghost" onClick={() => setCur(null)}>schließen</button>
        </div>
      ) : null}
    </>
  );
}

function NamesEditor({ id, names, setNames }) {
  const [k, setK] = useState(''); const [v, setV] = useState('');
  const save = async (n) => { setNames(n); await api.save(id, 'names.json', n); };
  return (
    <div className="card">
      <div className="row">
        {Object.entries(names).map(([a, b]) => <span key={a} className="pill">{a} → {b} <button className="small ghost" style={{ padding: '0 4px' }} onClick={() => { const n = { ...names }; delete n[a]; save(n); }}>×</button></span>)}
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <input placeholder="gehört (z. B. cloud)" value={k} onChange={(e) => setK(e.target.value)} style={{ width: 200 }} />
        <input placeholder="gemeint (z. B. Claude)" value={v} onChange={(e) => setV(e.target.value)} style={{ width: 200 }} />
        <button disabled={!k.trim() || !v.trim()} onClick={() => { save({ ...names, [k.trim().toLowerCase()]: v.trim() }); setK(''); setV(''); }}>hinzufügen</button>
        <span className="muted">wirkt beim nächsten „Transkript“-Lauf</span>
      </div>
    </div>
  );
}
