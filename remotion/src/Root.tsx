import React from 'react';
import { Composition } from 'remotion';
import { Tutorial, ThreeTest } from './compositions';

// Video settings
export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Tutorial"
        component={Tutorial}
        durationInFrames={90 * FPS} // 90 seconds
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="ThreeTest"
        component={ThreeTest}
        durationInFrames={15 * FPS} // 15 seconds - state transitions
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
