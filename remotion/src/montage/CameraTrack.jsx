// montage/CameraTrack.jsx — die Kamera. v1: Vollbild (Modus C/W), Close-up-Zoom mit leichtem Drift aus kit/geometry.
import React from 'react';
import { OffthreadVideo, Sequence, useCurrentFrame, interpolate, AbsoluteFill, staticFile } from 'remotion';
import { CLOSEUP, W, H } from '../kit/geometry.js';

function Shot({ src, from, duration, scale, drift }) {
  const frame = useCurrentFrame();
  const s = scale * (1 + interpolate(frame, [0, Math.max(1, duration)], [0, drift], { extrapolateRight: 'clamp' }));
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <OffthreadVideo src={src} startFrom={from} style={{ width: W, height: H, objectFit: 'cover', transform: `scale(${s})`, transformOrigin: `${CLOSEUP.cx * 100}% ${CLOSEUP.cy * 100}%` }} muted />
    </AbsoluteFill>
  );
}

export function CameraTrack({ src, blocks, frames }) {
  // blocks: [{f0, f1, mode}] — ohne Blockplan ein einziger Block über alles
  const list = blocks?.length ? blocks : [{ f0: 0, f1: frames, mode: 'W' }];
  return (
    <>
      {list.map((b, i) => (
        <Sequence key={i} from={b.f0} durationInFrames={Math.max(1, b.f1 - b.f0)}>
          <Shot src={src} from={b.f0} duration={b.f1 - b.f0} scale={b.mode === 'C' ? (b.cta ? CLOSEUP.cta : CLOSEUP.scale) : 1} drift={b.mode === 'C' ? CLOSEUP.drift : 0} />
        </Sequence>
      ))}
    </>
  );
}
