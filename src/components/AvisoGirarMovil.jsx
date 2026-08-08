import { useState } from "react";
import { Smartphone, X } from "lucide-react";

// Franja descartable que sugiere girar el móvil, para pantallas con tablas
// anchas que se ven mejor en horizontal (Cuadrante, resultados de Busco
// Rival). Empieza visible y se oculta al pulsar la X — sin memoria entre
// pantallas ni sesiones, así que vuelve a aparecer cada vez que se monta
// (al entrar de nuevo en la pantalla). Elemento puramente visual, sin
// relación con la lógica de negociación ni filtros de la pantalla donde
// se usa.
export default function AvisoGirarMovil({ texto }) {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="cl-aviso-girar no-print">
      <Smartphone size={18} className="cl-aviso-girar-icon" />
      <span>{texto}</span>
      <button className="cl-aviso-girar-cerrar" onClick={() => setVisible(false)} aria-label="Cerrar aviso">
        <X size={14} />
      </button>
    </div>
  );
}
