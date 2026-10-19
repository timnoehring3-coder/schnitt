// Waveform.jsx — Canvas-Wellenform der Quelle aus peaks.json (Int8 je 5 ms), Blöcke und gewählte Segmente als Bänder,
// Zoom per Rad, Klick setzt den Abspielkopf. Virtualisiert: gezeichnet wird nur der sichtbare Ausschnitt.
import React, { useEffect, useRef, useState } from 'react';

export function Waveform({ peaks, duration, blocks, segments, cursor, onSeek, selected }) {
  const ref = useRef(null);
  const [view, setView] = useState({ t0: 0, t1: duration || 1 });
  useEffect(() => { if (duration) setView({ t0: 0, t1: duration }); }, [duration]);
  const data = useRef(null);
  useEffect(() => { if (!peaks) return; const bin = atob(peaks.data); const a = new Int8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); data.current = a; }, [peaks]);

  useEffect(() => {
    const c = ref.current; if (!c || !data.current) return;
    const dpr = devicePixelRatio || 1; const W = c.clientWidth, H = 160; c.width = W * dpr; c.height = H * dpr;
    const g = c.getContext('2d'); g.scale(dpr, dpr); g.fillStyle = '#050505'; g.fillRect(0, 0, W, H);
    const { t0, t1 } = view; const span = t1 - t0; const x = (t) => ((t - t0) / span) * W;
    const binMs = peaks.binMs, a = data.current, mid = H * 0.55;
    // Bänder: Blöcke (dunkel), Segmente (hell)
    for (const b of blocks || []) { if (b.t1 < t0 || b.t0 > t1) continue; g.fillStyle = '#1b1b1b'; g.fillRect(x(b.t0), 8, Math.max(1, x(b.t1) - x(b.t0)), H - 16); }
    for (const s of segments || []) { if (s.outSec < t0 || s.inSec > t1) continue; g.fillStyle = s.select === selected ? '#3a3a3a' : '#262626'; g.fillRect(x(s.inSec), 8, Math.max(1, x(s.outSec) - x(s.inSec)), H - 16); }
    // Welle
    const binsPerPx = (span * 1000 / binMs) / W;
    g.fillStyle = '#dcdcdc';
    for (let px = 0; px < W; px++) {
      const b0 = Math.floor((t0 * 1000 / binMs) + px * binsPerPx), b1 = Math.max(b0 + 1, Math.floor(b0 + binsPerPx));
      let m = 0; for (let i = b0; i < b1 && i < a.length; i++) { const v = Math.abs(a[i]); if (v > m) m = v; }
      const h = Math.max(1, (m / 127) * (H * 0.42)); g.fillRect(px, mid - h, 1, h * 2);
    }
    // Segment-Kanten
    for (const s of segments || []) { if (s.outSec < t0 || s.inSec > t1) continue; g.fillStyle = '#fff'; g.fillRect(Math.round(x(s.inSec)), 4, 1, H - 8); g.fillRect(Math.round(x(s.outSec)), 4, 1, H - 8); }
    // Abspielkopf
    if (cursor != null && cursor >= t0 && cursor <= t1) { g.fillStyle = '#fff'; g.fillRect(Math.round(x(cursor)), 0, 2, H); }
    // Zeitmarken
    g.fillStyle = '#8a8a8a'; g.font = '10px -apple-system, Helvetica';
    const step = span > 240 ? 60 : span > 60 ? 10 : span > 12 ? 2 : 0.5;
    for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) g.fillText(`${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}${step < 1 ? '.' + Math.round((t % 1) * 10) : ''}`, x(t) + 3, H - 4);
  }, [view, peaks, blocks, segments, cursor, selected]);

  const onWheel = (e) => {
    e.preventDefault();
    const c = ref.current; const W = c.clientWidth; const { t0, t1 } = view; const span = t1 - t0;
    const at = t0 + (e.offsetX / W) * span;
    if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      const f = Math.exp(e.deltaY * 0.0025); const ns = Math.min(duration, Math.max(1, span * f));
      let n0 = at - (at - t0) * (ns / span); n0 = Math.max(0, Math.min(duration - ns, n0)); setView({ t0: n0, t1: n0 + ns });
    } else { let n0 = t0 + (e.deltaX / W) * span; n0 = Math.max(0, Math.min(duration - span, n0)); setView({ t0: n0, t1: n0 + span }); }
  };
  useEffect(() => { const c = ref.current; c.addEventListener('wheel', onWheel, { passive: false }); return () => c.removeEventListener('wheel', onWheel); });
  const onClick = (e) => { const W = ref.current.clientWidth; onSeek?.(view.t0 + (e.nativeEvent.offsetX / W) * (view.t1 - view.t0)); };
  const focus = (t0, t1) => { const pad = Math.max(0.5, (t1 - t0) * 0.4); setView({ t0: Math.max(0, t0 - pad), t1: Math.min(duration, t1 + pad) }); };
  return <div className="wave"><canvas ref={ref} onClick={onClick} /><FocusBridge focus={focus} /></div>;
}
// kleine Brücke, damit der Elternknoten „zeige Segment X“ auslösen kann
const bridge = { focus: null };
function FocusBridge({ focus }) { bridge.focus = focus; return null; }
export const waveFocus = (t0, t1) => bridge.focus?.(t0, t1);
