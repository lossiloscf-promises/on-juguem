import { useEffect, useRef, useState } from "react";

// Distancia de arrastre (ya con resistencia aplicada) necesaria para que,
// al soltar, se dispare la recarga.
const UMBRAL = 70;
// El indicador se mueve más despacio que el dedo (misma sensación que el
// pull-to-refresh nativo de las apps), y no puede estirarse sin límite.
const RESISTENCIA = 0.5;
const TOPE = UMBRAL * 1.6;

// Deslizar hacia abajo para recargar — solo en pantallas estrechas (se
// comprueba en JS, no solo con CSS, porque disparar una recarga sin que se
// vea ningún indicador sería confuso en un portátil/tablet táctil ancho) y
// solo cuando la página está arriba del todo (si no, un deslizamiento hacia
// abajo es scroll normal). Usa "bloqueo de dirección": en cuanto un gesto
// se mueve lo bastante para saber si es más horizontal que vertical, se
// marca como tal y se deja de tocar preventDefault el resto del gesto —
// así nunca interfiere con el scroll horizontal de las pestañas ni del
// cuadrante, que también viven dentro de la misma página.
export default function usePullToRefresh() {
  const [distancia, setDistancia] = useState(0);
  const [recargando, setRecargando] = useState(false);
  // Mientras el dedo sigue en pantalla, el indicador sigue el dedo 1:1 (sin
  // transición, para no ir con retraso). Solo al soltar — con o sin llegar
  // al umbral — se anima el movimiento (de vuelta arriba, o quedarse fijo
  // mientras recarga), así que el CSS solo aplica la transición cuando
  // arrastrando es false.
  const [arrastrando, setArrastrando] = useState(false);

  const distanciaRef = useRef(0);
  const recargandoRef = useRef(false);
  const inicioY = useRef(null);
  const inicioX = useRef(null);
  const siguiendo = useRef(false); // gesto confirmado como pull vertical
  const bloqueadoHorizontal = useRef(false); // gesto confirmado como horizontal — no tocar

  useEffect(() => {
    const esMovil = () => window.matchMedia("(max-width: 640px)").matches;

    const reset = () => {
      inicioY.current = null;
      inicioX.current = null;
      siguiendo.current = false;
      bloqueadoHorizontal.current = false;
      distanciaRef.current = 0;
      setDistancia(0);
      setArrastrando(false);
    };

    const onTouchStart = (e) => {
      if (recargandoRef.current) return;
      if (e.touches.length !== 1) return;
      if (!esMovil()) return;
      if (window.scrollY > 0) return;
      inicioY.current = e.touches[0].clientY;
      inicioX.current = e.touches[0].clientX;
      siguiendo.current = false;
      bloqueadoHorizontal.current = false;
    };

    const onTouchMove = (e) => {
      if (inicioY.current == null) return;
      if (e.touches.length !== 1) return;
      const dy = e.touches[0].clientY - inicioY.current;
      const dx = e.touches[0].clientX - inicioX.current;

      if (!siguiendo.current && !bloqueadoHorizontal.current) {
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
          bloqueadoHorizontal.current = true; // scroll horizontal (pestañas, cuadrante) — no tocar
          return;
        }
        if (dy > 10) { siguiendo.current = true; setArrastrando(true); }
      }
      if (bloqueadoHorizontal.current || !siguiendo.current) return;
      if (window.scrollY > 0 || dy <= 0) { reset(); return; }

      e.preventDefault();
      const d = Math.min(dy * RESISTENCIA, TOPE);
      distanciaRef.current = d;
      setDistancia(d);
    };

    const onTouchEnd = () => {
      if (siguiendo.current && distanciaRef.current >= UMBRAL) {
        recargandoRef.current = true;
        setArrastrando(false);
        setRecargando(true);
        // Pequeña pausa para que se vea el estado "listo" antes de recargar.
        window.setTimeout(() => window.location.reload(), 200);
      } else {
        reset();
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", reset, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", reset);
    };
  }, []);

  return { distancia, lista: distancia >= UMBRAL, recargando, arrastrando, umbral: UMBRAL };
}
