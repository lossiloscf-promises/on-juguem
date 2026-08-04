// Primitivas de movimiento reutilizadas por todas las escenas. Nunca
// linear(); toda entrada anima 2-3 propiedades a la vez; toda salida es más
// rápida que la entrada correspondiente.
import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";

type SpringConfig = (typeof theme.spring)[keyof typeof theme.spring];

// Entrada estándar: fade + subida + escala, con spring.
export const Entrance: React.FC<{
  delay?: number;
  config?: SpringConfig;
  y?: number;
  scaleFrom?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ delay = 0, config = theme.spring.smooth, y = 42, scaleFrom = 0.94, style, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config });
  return (
    <div
      style={{
        opacity: p,
        transform: `translateY(${interpolate(p, [0, 1], [y, 0])}px) scale(${interpolate(
          p,
          [0, 1],
          [scaleFrom, 1]
        )})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// Revelado palabra a palabra (para titulares/ganchos). 3 frames de stagger.
export const WordReveal: React.FC<{
  text: string;
  delay?: number;
  per?: number;
  highlight?: string;
  style?: React.CSSProperties;
}> = ({ text, delay = 0, per = 3, highlight, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", justifyContent: "center", ...style }}>
      {text.split(" ").map((word, i) => {
        const p = spring({ frame: frame - delay - i * per, fps, config: theme.spring.snappy });
        const isHighlight = highlight && word.replace(/[¿?.,]/g, "") === highlight;
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: p,
              transform: `translateY(${interpolate(p, [0, 1], [30, 0])}px)`,
              color: isHighlight ? theme.colors.primary : "inherit",
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

// Salida genérica: más rápida que cualquier entrada de este proyecto (~12
// frames), aplicada a los últimos frames de una escena.
export const useSceneExit = (durationInFrames: number, exitFrames = 12) => {
  const frame = useCurrentFrame();
  const start = durationInFrames - exitFrames - 2;
  const end = durationInFrames - 1;
  const opacity = interpolate(frame, [start, end], [1, 0], {
    easing: theme.ease.in,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame, [start, end], [0, -36], {
    easing: theme.ease.in,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { opacity, transform: `translateY(${y}px)` };
};

// Respiración para elementos que permanecen en pantalla más de ~2s.
export const useBreathe = (ampScale = 0.014, ampFloat = 4, speed = 26) => {
  const frame = useCurrentFrame();
  const scale = 1 + Math.sin(frame / speed) * ampScale;
  const float = Math.sin(frame / (speed + 4)) * ampFloat;
  return { scale, float };
};
