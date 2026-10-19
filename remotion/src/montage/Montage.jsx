// montage/Montage.jsx — DIE Render-Komposition. Lebt ausschließlich aus Props (montage.json), damit Dashboard-Player
// und Render dasselbe zeigen. v1: Kamera + Untertitel + Ton. S/T/Grafik/Keyword/SFX folgen als weitere Spuren.
import React from 'react';
import { AbsoluteFill, Audio, staticFile } from 'remotion';
import { CameraTrack } from './CameraTrack.jsx';
import { Subtitles } from './Subtitles.jsx';

export function Montage({ camera, frames, blocks, subtitles, chin, captionStyle }) {
  const src = staticFile(camera);
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <CameraTrack src={src} blocks={blocks} frames={frames} />
      {subtitles?.length ? <Subtitles pages={subtitles} chin={chin} style={captionStyle} /> : null}
      <Audio src={src} />
    </AbsoluteFill>
  );
}
