// Escena 6 — CIERRE + CTA (52-68s / 450 frames).
// Cierra el mismo gancho de la escena 1 ("WhatsApp" vuelve a resaltarse) y
// termina en un estado de reposo: el botón de CTA respira suavemente porque
// es lo último que se ve antes de que acabe el vídeo.
import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { SceneLayers, SafeArea } from "../components/Layers";
import { Entrance, WordReveal, useBreathe, useSceneExit } from "../components/Motion";
import { LogoMark, Wordmark } from "../components/LogoMark";
import { SCENES } from "../timing";

// Marcado de campo muy sutil en una esquina — mismo lenguaje de marca que la
// banda de CTA de la landing (public/inicio.html): un guiño al fútbol, no
// una foto de un campo.
const PitchMark: React.FC = () => (
  <div
    style={{
      position: "absolute",
      right: -180,
      top: 180,
      width: 520,
      height: 520,
      borderRadius: "50%",
      border: `1.5px solid ${theme.colors.primary}22`,
    }}
  />
);

const CtaButton: React.FC<{ delay: number }> = ({ delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: theme.spring.bouncy });
  const breathe = useBreathe(0.02, 0, 28);
  const glow = 0.25 + Math.sin(frame / 28) * 0.08;
  return (
    <div
      style={{
        opacity: p,
        transform: `translateY(${interpolate(p, [0, 1], [30, 0])}px) scale(${interpolate(
          p,
          [0, 1],
          [0.85, breathe.scale]
        )})`,
        background: theme.colors.primary,
        borderRadius: 999,
        padding: "26px 56px",
        boxShadow: `0 20px 50px -10px rgba(11,58,100,${glow})`,
      }}
    >
      <span style={{ fontFamily: theme.fonts.display, fontWeight: 800, fontSize: 34, color: "#FFFFFF" }}>
        Crea tu club gratis
      </span>
    </div>
  );
};

export const Scene6Outro: React.FC = () => {
  const exit = useSceneExit(SCENES.outro.duration, 16);
  return (
    <SceneLayers>
      <PitchMark />
      <SafeArea style={{ flexDirection: "column", gap: 40, ...exit }}>
        <Entrance delay={2} config={theme.spring.bouncy} y={20} scaleFrom={0.8}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <LogoMark size={62} />
            <Wordmark size={42} />
          </div>
        </Entrance>

        <WordReveal
          text="Deja el WhatsApp para lo importante"
          delay={14}
          per={3}
          highlight="WhatsApp"
          style={{
            fontFamily: theme.fonts.display,
            fontWeight: 800,
            fontSize: 62,
            lineHeight: 1.16,
            letterSpacing: "-0.02em",
            color: theme.colors.text,
            textAlign: "center",
          }}
        />

        <CtaButton delay={36} />

        <Entrance delay={48} y={14} config={theme.spring.smooth}>
          <span
            style={{
              fontFamily: theme.fonts.body,
              fontWeight: 600,
              fontSize: 22,
              color: theme.colors.textDim,
            }}
          >
            Gratis · en menos de 2 minutos
          </span>
        </Entrance>
      </SafeArea>
    </SceneLayers>
  );
};
