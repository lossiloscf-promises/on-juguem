// theme.ts — única fuente de verdad del vídeo. Paleta calcada de src/styles.css
// y public/inicio.html de la app On Juguem. Nunca colores/easings sueltos en escenas.
import { Easing } from "remotion";

export const theme = {
  colors: {
    bg: "#F8FAFC",
    surface: "#FFFFFF",
    primary: "#0F4C81", // color héroe — como mucho un elemento con este color por frame
    primaryDark: "#0B3A64",
    secondary: "#16A34A",
    text: "#0F172A",
    textDim: "#64748B",
    line: "#E2E8F0",
    stDisponible: "#E0F2FE",
    stDisponibleInk: "#075985",
    stCerrado: "#DCFCE7",
    stCerradoInk: "#166534",
    stPendiente: "#FEF3C7",
    stPendienteInk: "#92400E",
    glow: "rgba(15, 76, 129, 0.32)",
  },
  fonts: {
    // La marca usa Inter en toda la app — se respeta también aquí, cargada
    // vía @remotion/google-fonts (nunca la fuente de sistema por defecto).
    display: "Inter",
    body: "Inter",
  },
  ease: {
    out: Easing.bezier(0.16, 1, 0.3, 1), // easeOutExpo — entradas
    inOut: Easing.bezier(0.83, 0, 0.17, 1), // easeInOutQuint — movimientos, Ken Burns
    in: Easing.bezier(0.7, 0, 0.84, 0), // solo salidas
  },
  spring: {
    snappy: { damping: 14, stiffness: 160, mass: 0.6 },
    smooth: { damping: 20, stiffness: 90, mass: 1 },
    bouncy: { damping: 11, stiffness: 170, mass: 0.7 },
  },
} as const;
