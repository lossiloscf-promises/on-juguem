// Escena 3 — FUNCIÓN 1: calendario claro (15-29s / 420 frames).
// Cuadrícula estilizada de pastillas de estado (no una captura literal de la
// app) apareciendo una a una: azul = disponible, ámbar = pendiente,
// verde = cerrado. Categorías reales de fútbol base (constants.js).
import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { SceneLayers, SafeArea } from "../components/Layers";
import { WordReveal, useBreathe, useSceneExit } from "../components/Motion";
import { SCENES } from "../timing";

type Status = "disponible" | "pendiente" | "cerrado";

const STATUS_STYLE: Record<Status, { bg: string; ink: string; label: string }> = {
  disponible: { bg: theme.colors.stDisponible, ink: theme.colors.stDisponibleInk, label: "Disponible" },
  pendiente: { bg: theme.colors.stPendiente, ink: theme.colors.stPendienteInk, label: "Pendiente" },
  cerrado: { bg: theme.colors.stCerrado, ink: theme.colors.stCerradoInk, label: "Cerrado" },
};

const PILLS: Array<{ team: string; status: Status }> = [
  { team: "Amateur", status: "disponible" },
  { team: "Juvenil", status: "pendiente" },
  { team: "Cadete", status: "cerrado" },
  { team: "Infantil", status: "disponible" },
  { team: "Alevín", status: "pendiente" },
  { team: "Benjamín", status: "cerrado" },
  { team: "Prebenjamín", status: "disponible" },
  { team: "Querubín", status: "cerrado" },
];

const Pill: React.FC<{ team: string; status: Status; delay: number }> = ({ team, status, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = STATUS_STYLE[status];
  const p = spring({ frame: frame - delay, fps, config: theme.spring.snappy });
  const breathe = useBreathe(0.012, 3, 30 + delay);
  return (
    <div
      style={{
        opacity: p,
        transform: `translateY(${interpolate(p, [0, 1], [26, 0])}px) scale(${interpolate(
          p,
          [0, 1],
          [0.85, breathe.scale]
        )})`,
        background: s.bg,
        borderRadius: 16,
        padding: "18px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        minHeight: 92,
        justifyContent: "center",
      }}
    >
      <span style={{ fontFamily: theme.fonts.display, fontWeight: 700, fontSize: 22, color: theme.colors.text }}>
        {team}
      </span>
      <span style={{ fontFamily: theme.fonts.body, fontWeight: 700, fontSize: 16, color: s.ink }}>
        {s.label}
      </span>
    </div>
  );
};

export const Scene3Calendar: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const exit = useSceneExit(SCENES.calendar.duration);
  const cardZoom = interpolate(frame, [0, SCENES.calendar.duration], [1, 1.035], {
    easing: theme.ease.inOut,
  });

  return (
    <SceneLayers>
      <SafeArea style={{ flexDirection: "column", gap: 48, ...exit }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
          <WordReveal
            text="Calendario claro"
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
            text="Qué está libre, pendiente o cerrado, de un vistazo"
            delay={16}
            per={2}
            style={{
              fontFamily: theme.fonts.body,
              fontWeight: 600,
              fontSize: 28,
              color: theme.colors.textDim,
              textAlign: "center",
              maxWidth: 620,
              gap: "0.24em",
            }}
          />
        </div>

        <div
          style={{
            background: theme.colors.surface,
            borderRadius: 32,
            padding: 36,
            width: 900,
            boxShadow: "0 40px 90px -30px rgba(15,23,42,0.28)",
            border: `1px solid ${theme.colors.line}`,
            transform: `scale(${cardZoom})`,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {PILLS.map((pill, i) => (
              <Pill key={pill.team} team={pill.team} status={pill.status} delay={34 + i * 5} />
            ))}
          </div>
        </div>
      </SafeArea>
    </SceneLayers>
  );
};
