// Monograma "OJ" — reconstruido en código a partir del icono real de la app
// (public/icon-512.png / favicon.svg: cuadrado azul redondeado + "OJ" en
// blanco), pero en Inter 800 para que case con la tipografía del vídeo en
// vez de con la fuente del favicon.
import React from "react";
import { theme } from "../theme";

export const LogoMark: React.FC<{ size?: number }> = ({ size = 96 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.26,
      background: theme.colors.primary,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: `0 ${size * 0.14}px ${size * 0.36}px -${size * 0.08}px rgba(11,58,100,0.45)`,
      flexShrink: 0,
    }}
  >
    <span
      style={{
        fontFamily: theme.fonts.display,
        fontWeight: 800,
        fontSize: size * 0.4,
        color: "#FFFFFF",
        letterSpacing: "-0.02em",
      }}
    >
      OJ
    </span>
  </div>
);

export const Wordmark: React.FC<{ size?: number; color?: string }> = ({
  size = 64,
  color = theme.colors.text,
}) => (
  <span
    style={{
      fontFamily: theme.fonts.display,
      fontWeight: 800,
      fontSize: size,
      color,
      letterSpacing: "-0.02em",
    }}
  >
    On Juguem
  </span>
);
