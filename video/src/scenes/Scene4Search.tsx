// Escena 4 — FUNCIÓN 2: búsqueda por cercanía (28-40s / 360 frames).
// Elemento icónico de geolocalización (pin + ondas de radar + clubes
// alrededor) en vez de un mapa real — más rápido de leer sin sonido.
import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { SceneLayers, SafeArea } from "../components/Layers";
import { WordReveal, useBreathe, useSceneExit } from "../components/Motion";
import { SCENES } from "../timing";

const RadarPing: React.FC = () => {
  const frame = useCurrentFrame();
  const loop = 75;
  return (
    <>
      {[0, 1, 2].map((ring) => {
        const t = ((frame + ring * (loop / 3)) % loop) / loop;
        const scale = interpolate(t, [0, 1], [0.25, 2.1], { easing: theme.ease.out });
        const opacity = interpolate(t, [0, 0.12, 1], [0, 0.4, 0]);
        return (
          <div
            key={ring}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 260,
              height: 260,
              marginLeft: -130,
              marginTop: -130,
              borderRadius: "50%",
              border: `2px solid ${theme.colors.primary}`,
              opacity,
              transform: `scale(${scale})`,
            }}
          />
        );
      })}
    </>
  );
};

const PinMark: React.FC = () => {
  const breathe = useBreathe(0.03, 5, 24);
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 74,
        height: 74,
        marginLeft: -37,
        marginTop: -37 + breathe.float,
        borderRadius: "50% 50% 50% 0",
        background: theme.colors.primary,
        transform: `rotate(-45deg) scale(${breathe.scale})`,
        boxShadow: `0 14px 30px -4px ${theme.colors.glow}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: "#FFFFFF",
          transform: "rotate(45deg)",
        }}
      />
    </div>
  );
};

const ClubNode: React.FC<{ angle: number; radius: number; distance: string; delay: number }> = ({
  angle,
  radius,
  distance,
  delay,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: theme.spring.bouncy });
  const rad = (angle * Math.PI) / 180;
  const x = Math.cos(rad) * radius;
  const y = Math.sin(rad) * radius;
  const breathe = useBreathe(0.02, 4, 26 + delay);
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        marginLeft: x - 30,
        marginTop: y - 30,
        opacity: p,
        transform: `scale(${interpolate(p, [0, 1], [0.5, breathe.scale])})`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: 18,
          background: theme.colors.secondary,
          boxShadow: "0 10px 24px -6px rgba(22,163,74,0.45)",
        }}
      />
      <div
        style={{
          background: theme.colors.surface,
          border: `1px solid ${theme.colors.line}`,
          borderRadius: 999,
          padding: "5px 14px",
          fontFamily: theme.fonts.body,
          fontWeight: 700,
          fontSize: 18,
          color: theme.colors.text,
          whiteSpace: "nowrap",
        }}
      >
        {distance}
      </div>
    </div>
  );
};

export const Scene4Search: React.FC = () => {
  const exit = useSceneExit(SCENES.search.duration);
  return (
    <SceneLayers>
      <SafeArea style={{ flexDirection: "column", gap: 56, ...exit }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
          <WordReveal
            text="Encuentra rivales cerca de ti"
            delay={2}
            per={3}
            style={{
              fontFamily: theme.fonts.display,
              fontWeight: 800,
              fontSize: 58,
              letterSpacing: "-0.02em",
              color: theme.colors.text,
              textAlign: "center",
            }}
          />
          <WordReveal
            text="Filtra por categoría, nivel y distancia real"
            delay={16}
            per={2}
            style={{
              fontFamily: theme.fonts.body,
              fontWeight: 600,
              fontSize: 28,
              color: theme.colors.textDim,
              textAlign: "center",
              maxWidth: 620,
            }}
          />
        </div>

        <div style={{ position: "relative", width: 640, height: 640 }}>
          <RadarPing />
          <PinMark />
          <ClubNode angle={-58} radius={220} distance="2 km" delay={36} />
          <ClubNode angle={40} radius={260} distance="5 km" delay={44} />
          <ClubNode angle={165} radius={230} distance="8 km" delay={52} />
        </div>
      </SafeArea>
    </SceneLayers>
  );
};
