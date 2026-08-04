// Escena 1 — GANCHO (0-8s / 240 frames a 30fps).
// Movimiento dentro de los primeros 15 frames (regla del skill). El titular
// hace de subtítulo incrustado: el mensaje se entiende sin sonido.
import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { SceneLayers, SafeArea } from "../components/Layers";
import { WordReveal, useSceneExit } from "../components/Motion";
import { SCENES } from "../timing";

const ChatGhost: React.FC<{ x: number; y: number; w: number; delay: number; rot: number }> = ({
  x,
  y,
  w,
  delay,
  rot,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: theme.spring.smooth });
  const wobble = Math.sin((frame - delay) / 34) * 3;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: w * 0.42,
        borderRadius: 18,
        background: theme.colors.surface,
        border: `1px solid ${theme.colors.line}`,
        opacity: interpolate(p, [0, 1], [0, 0.9]),
        transform: `scale(${interpolate(p, [0, 1], [0.85, 1])}) rotate(${rot + wobble}deg)`,
        boxShadow: "0 14px 30px rgba(15,23,42,0.06)",
      }}
    />
  );
};

export const Scene1Hook: React.FC = () => {
  const exit = useSceneExit(SCENES.hook.duration);
  return (
    <SceneLayers>
      <ChatGhost x={70} y={330} w={230} delay={34} rot={-6} />
      <ChatGhost x={760} y={480} w={190} delay={48} rot={5} />
      <ChatGhost x={110} y={1420} w={200} delay={40} rot={4} />
      <ChatGhost x={720} y={1500} w={240} delay={56} rot={-4} />
      <SafeArea style={{ ...exit }}>
        <WordReveal
          text="¿Cuántos amistosos se te han liado por WhatsApp?"
          delay={4}
          per={3}
          highlight="WhatsApp?"
          style={{
            fontFamily: theme.fonts.display,
            fontWeight: 800,
            fontSize: 70,
            lineHeight: 1.16,
            letterSpacing: "-0.02em",
            color: theme.colors.text,
            textAlign: "center",
          }}
        />
      </SafeArea>
    </SceneLayers>
  );
};
