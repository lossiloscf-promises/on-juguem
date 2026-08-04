// Escena 5 — FUNCIÓN 3: avisos al momento (40-52s / 360 frames).
// Móvil estilizado (no una captura real) con una notificación push que
// llega, rebota al aterrizar y hace vibrar levemente el teléfono.
import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { SceneLayers, SafeArea } from "../components/Layers";
import { WordReveal, useBreathe, useSceneExit } from "../components/Motion";
import { LogoMark } from "../components/LogoMark";
import { SCENES } from "../timing";

const NOTIF_LAND_FRAME = 34;

const PhoneFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const breathe = useBreathe(0.012, 3, 32);
  // Vibración breve justo cuando la notificación aterriza.
  const buzzWindow = 10;
  const sinceLand = frame - NOTIF_LAND_FRAME;
  const buzz =
    sinceLand >= 0 && sinceLand <= buzzWindow
      ? Math.sin(sinceLand * 3.4) * interpolate(sinceLand, [0, buzzWindow], [4, 0])
      : 0;

  return (
    <div
      style={{
        position: "relative",
        width: 470,
        height: 940,
        borderRadius: 64,
        background: theme.colors.text,
        padding: 14,
        boxShadow: "0 50px 100px -30px rgba(15,23,42,0.4)",
        transform: `translateX(${buzz}px) scale(${breathe.scale})`,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 50,
          background: theme.colors.bg,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            marginLeft: -70,
            width: 140,
            height: 30,
            background: theme.colors.text,
            borderRadius: "0 0 20px 20px",
          }}
        />
        {children}
      </div>
    </div>
  );
};

const NotifBanner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - NOTIF_LAND_FRAME, fps, config: theme.spring.bouncy });
  const y = interpolate(p, [0, 1], [-260, 56]);
  // Pulso de escala justo al aterrizar, muy breve, para vender el "impacto".
  const sinceLand = frame - NOTIF_LAND_FRAME;
  const impact = sinceLand >= 0 && sinceLand <= 8 ? interpolate(sinceLand, [0, 3, 8], [1, 1.035, 1]) : 1;

  return (
    <div
      style={{
        position: "absolute",
        left: 20,
        right: 20,
        top: 0,
        opacity: p,
        transform: `translateY(${y}px) scale(${impact})`,
        background: "#FFFFFF",
        borderRadius: 24,
        padding: "18px 20px",
        boxShadow: "0 24px 50px -12px rgba(15,23,42,0.28)",
        border: `1px solid ${theme.colors.line}`,
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
      }}
    >
      <LogoMark size={46} />
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ fontFamily: theme.fonts.display, fontWeight: 700, fontSize: 17, color: theme.colors.text }}>
          On Juguem
        </span>
        <span
          style={{
            fontFamily: theme.fonts.body,
            fontWeight: 600,
            fontSize: 19,
            lineHeight: 1.32,
            color: theme.colors.text,
          }}
        >
          Torrellano te ha propuesto sede para el Juvenil
        </span>
      </div>
    </div>
  );
};

export const Scene5Notification: React.FC = () => {
  const exit = useSceneExit(SCENES.notification.duration);
  return (
    <SceneLayers>
      <SafeArea style={{ flexDirection: "column", gap: 44, ...exit }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
          <WordReveal
            text="Avisos al momento"
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
            text="En el móvil, sin abrir la app"
            delay={16}
            per={2}
            style={{
              fontFamily: theme.fonts.body,
              fontWeight: 600,
              fontSize: 28,
              color: theme.colors.textDim,
              textAlign: "center",
            }}
          />
        </div>

        <PhoneFrame>
          <NotifBanner />
        </PhoneFrame>
      </SafeArea>
    </SceneLayers>
  );
};
