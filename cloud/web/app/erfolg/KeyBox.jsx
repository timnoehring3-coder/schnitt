'use client';
import { useEffect, useState } from 'react';

export default function KeyBox({ sessionId }) {
  const [state, setState] = useState({ pending: true });
  useEffect(() => {
    if (!sessionId) { setState({ error: 'keine Bestellung in der Adresse' }); return; }
    let tries = 0, stop = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/key?session_id=${encodeURIComponent(sessionId)}`).then((x) => x.json());
        if (stop) return;
        if (r.key) { setState(r); return; }
        if (r.error && !r.pending) { setState({ error: r.error }); return; }
      } catch { /* nochmal */ }
      if (++tries < 30 && !stop) setTimeout(tick, 2000); else if (!stop) setState({ error: 'Schlüssel noch nicht da — er kommt per Mail' });
    };
    tick();
    return () => { stop = true; };
  }, [sessionId]);
  if (state.key) return (
    <div className="card" style={{ marginTop: 20 }}>
      <h3>Dein Schlüssel{state.plan ? ` (${state.plan === 'monthly' ? 'monatlich' : 'Lifetime'})` : ''}</h3>
      <pre style={{ userSelect: 'all', wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>{state.key}</pre>
      <p className="muted">Steht auch in der Mail. Zwei Geräte je Schlüssel.</p>
    </div>
  );
  return <p className="lead">{state.error ? state.error : 'Schlüssel wird ausgestellt …'}</p>;
}
