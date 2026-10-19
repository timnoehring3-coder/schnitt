import React from 'react';
import { Composition, getInputProps } from 'remotion';
import { Montage } from './montage/Montage.jsx';
import { W, H } from './kit/geometry.js';

export const Root = () => {
  const props = getInputProps();
  const fps = props.fps || 30, frames = props.frames || 300;
  return (
    <Composition id="Montage" component={Montage} width={W} height={H} fps={fps} durationInFrames={frames} defaultProps={props} />
  );
};
