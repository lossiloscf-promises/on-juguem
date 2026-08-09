import { useEffect, useState } from "react";
import { ArrowDown, RefreshCw } from "lucide-react";
import usePullToRefresh from "../hooks/usePullToRefresh";

// Se monta una sola vez, a nivel global (ver main.jsx) — funciona en
// cualquier pantalla de la app sin repetirse en cada una.
export default function PullToRefresh() {
  const { distancia, lista, recargando, arrastrando, umbral } = usePullToRefresh();
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    if (distancia > 0 || recargando) {
      setMontado(true);
      return;
    }
    // La distancia volvió a 0 (se soltó sin llegar al umbral) — se queda
    // montado un poco más para que se vea el retroceso animado (misma
    // duración que la transición CSS) antes de quitarlo del todo del DOM.
    const id = window.setTimeout(() => setMontado(false), 220);
    return () => window.clearTimeout(id);
  }, [distancia, recargando]);

  if (!montado) return null;

  return (
    <div
      className={`cl-ptr ${arrastrando ? "" : "cl-ptr-animado"}`}
      style={{ transform: `translate(-50%, ${Math.min(distancia, umbral)}px)` }}
    >
      <div className={`cl-ptr-badge ${lista || recargando ? "lista" : ""}`}>
        {recargando ? (
          <RefreshCw size={18} className="cl-ptr-spin" />
        ) : (
          <ArrowDown size={18} style={{ transform: `rotate(${lista ? 180 : 0}deg)`, transition: "transform 150ms var(--ease-out)" }} />
        )}
      </div>
    </div>
  );
}
