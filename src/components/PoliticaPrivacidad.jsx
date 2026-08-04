import { X } from "lucide-react";

export default function PoliticaPrivacidad({ onCerrar }) {
  return (
    <div
      className="cl-modal-backdrop"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
      onClick={onCerrar}
    >
      <div
        className="cl-ticket cl-modal"
        style={{ maxWidth: "560px", maxHeight: "80vh", overflowY: "auto", background: "white" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cl-row" style={{ justifyContent: "space-between", marginBottom: "8px" }}>
          <h2 className="cl-display" style={{ fontSize: "22px", color: "var(--pitch-dark)" }}>PRIVACIDAD Y DATOS</h2>
          <button className="cl-btn cl-btn-ghost" onClick={onCerrar}><X size={14} /></button>
        </div>
        <div style={{ fontSize: "13px", lineHeight: 1.6, color: "#333" }}>
          <p><b>Qué datos guardamos.</b> Al crear una cuenta guardamos el nombre de tu club, tu email y tu teléfono de contacto. Al dar de alta equipos, guardamos su categoría, nivel y disponibilidad. Cuando reservas o gestionas un partido con otro club, ese club ve tu nombre de club, teléfono y email (y tú los suyos), para poder poneros de acuerdo.</p>
          <p><b>Para qué los usamos.</b> Únicamente para el funcionamiento de la app: identificarte, mostrar tu disponibilidad a otros coordinadores, y facilitar el contacto para cerrar amistosos. No se usan con fines publicitarios ni se venden a terceros.</p>
          <p><b>Quién puede verlos.</b> Solo coordinadores con una cuenta creada en la app (no es información pública de internet). El teléfono/email de un partido concreto solo lo ven los dos clubes implicados en ese partido.</p>
          <p><b>Cuánto tiempo se guardan.</b> Mientras tu cuenta esté activa. Si borras tu cuenta, tus equipos, tu calendario y tus huecos publicados se eliminan de forma permanente.</p>
          <p><b>Tus derechos.</b> Puedes editar tu teléfono/nombre de club en cualquier momento desde "Ajustes". Puedes borrar tu cuenta y todos tus datos por completo desde esa misma pantalla, sin necesidad de pedírselo a nadie.</p>
          <p style={{ color: "var(--text-secondary)" }}>Este es un resumen en lenguaje sencillo, pensado para que se entienda de un vistazo. Si tienes dudas sobre cómo se tratan tus datos, contacta con quien administra esta instancia de la app.</p>
        </div>
      </div>
    </div>
  );
}
