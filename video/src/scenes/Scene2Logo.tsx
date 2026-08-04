// Escena 2 — LOGO + ESLOGAN (8-15s / 210 frames).
// Esta escena EMPIEZA exactamente en el segundo 8 del vídeo, que es donde
// cae el pico de energía de sport.mp3 (fin de su arranque progresivo) — el
// frame 0 de esta escena es el "HIT" más fuerte de todo el vídeo: el
// destello (Spark) y el logo entran a la vez que la música llega a su plena
// energía sostenida. El destello es un estallido breve, no un fondo
// permanente: se centra solo sobre el badge (no sobre todo el bloque de
// texto) y se desvanece antes de que el eslogan termine de aparecer.
import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { SceneLayers, SafeArea } from "../components/Layers";
import { Entrance, WordReveal, useBreathe, useSceneExit } from "../components/Motion";
import { LogoMark, Wordmark } from "../components/LogoMark";
import { SCENES } from "../timing";

const RAYS = 12;

const Spark: React.FC<{ size: number }> = ({ size }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const container = spring({ frame, fps, config: theme.spring.bouncy });
  const rotation = interpolate(container, [0, 1], [-120, 0]);
  // Estalla y se retira: visible de sobra para vender el "hit" inicial,
  // pero fuera antes de que el eslogan aterrice (delay 22 + stagger + spring).
  const fadeOut = interpolate(frame, [34, 50], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        width: size,
        height: size,
        left: "50%",
        top: "50%",
        opacity: fadeOut,
        transform: `translate(-50%, -50%) scale(${container * interpolate(fadeOut, [0, 1], [1.15, 1])}) rotate(${rotation}deg)`,
        filter: `drop-shadow(0 0 ${size * 0.22}px ${theme.colors.glow})`,
      }}
    >
      {Array.from({ length: RAYS }).map((_, i) => {
        const p = spring({ frame: frame - i * 1.2, fps, config: theme.spring.snappy });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: size * 0.045,
              height: size * 0.42 * p,
              background: i % 3 === 0 ? theme.colors.secondary : theme.colors.primary,
              opacity: 0.85,
              borderRadius: size,
              transformOrigin: "50% 0%",
              transform: `translateX(-50%) rotate(${(360 / RAYS) * i}deg) translateY(${
                size * 0.16
              }px)`,
            }}
          />
        );
      })}
    </div>
  );
};

export const Scene2Logo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useSceneExit(SCENES.logo.duration);
  const breathe = useBreathe();

  const badgeSpring = spring({ frame, fps, config: theme.spring.bouncy });

  return (
    <SceneLayers>
      <SafeArea style={{ flexDirection: "column", gap: 28, ...exit }}>
        {/* El destello vive DENTRO de este contenedor del tamaño del badge,
            centrado sobre sí mismo — así los rayos siempre se anclan al
            badge, nunca al centro de todo el bloque logo+texto. */}
        <div style={{ position: "relative", width: 168, height: 168 }}>
          <Spark size={430} />
          <div
            style={{
              opacity: badgeSpring,
              transform: `scale(${interpolate(badgeSpring, [0, 1], [0.6, breathe.scale])}) translateY(${breathe.float}px)`,
            }}
          >
            <LogoMark size={168} />
          </div>
        </div>
        <Entrance delay={10} config={theme.spring.smooth} y={26}>
          <Wordmark size={76} />
        </Entrance>
        <WordReveal
          text="Amistosos sin líos de WhatsApp"
          delay={22}
          per={3}
          style={{
            fontFamily: theme.fonts.body,
            fontWeight: 600,
            fontSize: 34,
            color: theme.colors.textDim,
            textAlign: "center",
            maxWidth: 640,
          }}
        />
      </SafeArea>
    </SceneLayers>
  );
};
