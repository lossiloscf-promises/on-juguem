import { useEffect, useRef } from "react";

const MINUTOS_INACTIVIDAD = 30;
const EVENTOS = ["mousedown", "keydown", "touchstart", "scroll"];

export function useCierreSesionPorInactividad(activo, onCerrar) {
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!activo) return;

    const reiniciar = () => {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        onCerrar();
      }, MINUTOS_INACTIVIDAD * 60 * 1000);
    };

    EVENTOS.forEach((ev) => window.addEventListener(ev, reiniciar));
    reiniciar();

    return () => {
      clearTimeout(timeoutRef.current);
      EVENTOS.forEach((ev) => window.removeEventListener(ev, reiniciar));
    };
  }, [activo, onCerrar]);
}
