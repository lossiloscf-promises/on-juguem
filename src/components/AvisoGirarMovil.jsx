import { useState } from "react";
import { Smartphone, X } from "lucide-react";

// Franja descartable que sugiere girar el móvil, para pantallas con tablas
// anchas que se ven mejor en horizontal (Cuadrante, resultados de Busco
// Rival). Una vez cerrada queda recordado en localStorage por pantalla
// (storageKey), así no vuelve a salir ni en sesiones futuras. Elemento
// puramente visual, sin relación con la lógica de negociación ni filtros
// de la pantalla donde se usa.
export default function AvisoGirarMovil({ storageKey, texto }) {
  const [visible, setVisible] = useState(() => {
    try {
      return !localStorage.getItem(storageKey);
    } catch {
      return true;
    }
  });

  if (!visible) return null;

  const cerrar = () => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // si el navegador bloquea localStorage, simplemente no se recuerda
    }
    setVisible(false);
  };

  return (
    <div className="cl-aviso-girar no-print">
      <Smartphone size={18} className="cl-aviso-girar-icon" />
      <span>{texto}</span>
      <button className="cl-aviso-girar-cerrar" onClick={cerrar} aria-label="Cerrar aviso">
        <X size={14} />
      </button>
    </div>
  );
}
