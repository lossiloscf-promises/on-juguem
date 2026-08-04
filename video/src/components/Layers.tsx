// Capas base reutilizadas en cada escena: fondo con textura, veladura de
// color, grano y viñeta. Nunca un fondo plano a secas (regla del skill).
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { theme } from "../theme";

// Fondo con dos manchas radiales (azul/verde de marca) muy difuminadas que
// derivan lentamente, más una retícula de puntos sutil — mismo lenguaje que
// el fondo del hero de la landing, pero vivo en vez de estático.
export const BgMesh: React.FC = () => {
  const frame = useCurrentFrame();
  const d1 = Math.sin(frame / 140) * 60;
  const d2 = Math.cos(frame / 170) * 50;
  return (
    <AbsoluteFill style={{ background: theme.colors.bg }}>
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(circle, ${theme.colors.line} 1.6px, transparent 1.6px)`,
          backgroundSize: "46px 46px",
          opacity: 0.55,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 1100,
          height: 1100,
          borderRadius: "50%",
          top: -380,
          left: -260 + d1,
          filter: "blur(90px)",
          background: `radial-gradient(circle, ${theme.colors.primary}22, transparent 62%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          borderRadius: "50%",
          bottom: -360,
          right: -220 - d2,
          filter: "blur(100px)",
          background: `radial-gradient(circle, ${theme.colors.secondary}1c, transparent 65%)`,
        }}
      />
    </AbsoluteFill>
  );
};

// Veladura de color por encima de todo el contenido, por debajo del grano.
// Opacidad baja: estamos en un tema claro, no oscuro (0.10-0.15 recomendado).
export const Grade: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <AbsoluteFill
      style={{
        backgroundColor: theme.colors.primary,
        mixBlendMode: "soft-light",
        opacity: 0.08,
      }}
    />
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(180deg, rgba(15,23,42,0.05), transparent 26%, transparent 74%, rgba(15,23,42,0.08))",
      }}
    />
  </AbsoluteFill>
);

// Grano procedural (sin archivo de imagen) — parpadeo de película muy leve.
export const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  const noise = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        backgroundImage: noise,
        backgroundSize: "220px",
        backgroundPosition: `${(frame * 7) % 220}px ${(frame * 13) % 220}px`,
        opacity: 0.035,
        mixBlendMode: "multiply",
      }}
    />
  );
};

// Viñeta muy sutil (capa superior) — sobre fondo claro se hace con azul de
// marca oscurecido, nunca negro puro, para que siga leyendo como "premium
// claro" y no como una foto subexpuesta.
export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background:
        "radial-gradient(ellipse at center, transparent 58%, rgba(11,58,100,0.16) 100%)",
    }}
  />
);

// Envoltorio de una escena completa: BgMesh -> children -> Grade -> Grain -> Vignette.
export const SceneLayers: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill>
    <BgMesh />
    <AbsoluteFill>{children}</AbsoluteFill>
    <Grade />
    <Grain />
    <Vignette />
  </AbsoluteFill>
);

// Zona segura 9:16: el contenido crítico se queda en el 75% central en
// vertical (la UI de la plataforma tapa arriba/abajo en Reels/Shorts/TikTok).
export const SafeArea: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({
  children,
  style,
}) => (
  <AbsoluteFill
    style={{
      justifyContent: "center",
      alignItems: "center",
      paddingTop: "12.5%",
      paddingBottom: "12.5%",
      paddingLeft: 64,
      paddingRight: 64,
      ...style,
    }}
  >
    {children}
  </AbsoluteFill>
);
