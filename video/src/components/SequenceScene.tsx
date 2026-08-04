// Envuelve cada escena en un <Sequence>: dentro, useCurrentFrame() empieza
// en 0 para esa escena, así ninguna escena necesita saber su offset global.
import React from "react";
import { Sequence } from "remotion";

export const SequenceScene: React.FC<{
  from: number;
  duration: number;
  children: React.ReactNode;
}> = ({ from, duration, children }) => (
  <Sequence from={from} durationInFrames={duration} name="scene">
    {children}
  </Sequence>
);
