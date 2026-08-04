// Carga Inter vía @remotion/google-fonts — nunca la fuente de sistema por
// defecto en un render server-side (el skill lo marca como fallo común).
import { loadFont } from "@remotion/google-fonts/Inter";

export const { fontFamily: interFontFamily } = loadFont("normal", {
  weights: ["400", "600", "700", "800", "900"],
  subsets: ["latin"],
});
