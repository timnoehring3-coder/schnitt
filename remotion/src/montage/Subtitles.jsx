// montage/Subtitles.jsx — die Ein-Wort-Untertitel (CAPTIONS.md): weiß, Bold 54, Fade-in 7 F, 34 px unter dem Kinn
// DES SEGMENTS (chin.json), nie über minTop. Keine Zeile, kein Karaoke, kein Highlight.
import React from 'react';
import { useCurrentFrame, interpolate, AbsoluteFill } from 'remotion';
import { SUBTITLE, H } from '../kit/geometry.js';
import { SUB_FAMILY } from '../kit/font.js';

export function Subtitles({ pages, chin, style }) {
  style = style || {};
  const frame = useCurrentFrame();
  const page = pages.find((p) => frame >= p.f0 && frame < p.f1);
  if (!page) return null;
  const seg = chin?.segments?.[page.segment];
  const chinY = seg?.chinY ?? chin?.median ?? 0.62;
  const top = Math.max(SUBTITLE.minTop, Math.round(chinY * H) + SUBTITLE.belowChinPx);
  const opacity = interpolate(frame - page.f0, [0, SUBTITLE.fadeFrames], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute', left: 0, right: 0, top, textAlign: 'center',
        fontFamily: style.fontFamily || SUB_FAMILY, fontWeight: style.weight || 700, fontSize: style.fontSize || SUBTITLE.fontSize,
        letterSpacing: `${SUBTITLE.tracking}em`, color: style.color || '#FFFFFF', opacity,
        textShadow: '0 4px 18px rgba(0,0,0,.5)', textTransform: style.case === 'upper' ? 'uppercase' : 'none',
      }}>{page.t}</div>
    </AbsoluteFill>
  );
}
