import { useState } from "react";
import { Save, Trash2 } from "lucide-react";
import PoliticaPrivacidad from "./PoliticaPrivacidad";
import { telefonoValido, LIMITES } from "../validaciones";

export default function AjustesView({ profile, onGuardarContacto, onBorrarCuenta }) {
  const [clubName, setClubName] = useState(profile.clubName);
  const [telefono, setTelefono] = useState(profile.telefono || "");
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
  const [verPolitica, setVerPolitica] = useState(false);

  const [borrando, setBorrando] = useState(false);
  const [passwordBorrar, setPasswordBorrar] = useState("");
  const [errorBorrar, setErrorBorrar] = useState("");

  const guardar = async () => {
    setAviso("");
    setError("");
    if (!telefonoValido(telefono)) {
      setError("Ese teléfono no parece válido — solo dígitos, 9 a 15 (puede llevar + al principio).");
      return;
    }
    setGuardando(true);
    try {
      await onGuardarContacto({ clubName: clubName.trim(), telefono: telefono.trim() });
      setAviso("Guardado.");
    } catch (err) {
      setError(err.message || "No se ha podido guardar.");
    }
    setGuardando(false);
  };

  const confirmarBorrado = async () => {
    if (!window.confirm("Esto borra tu cuenta, tus equipos, tu calendario y todos tus huecos de forma PERMANENTE. ¿Seguro?")) return;
    setErrorBorrar("");
    try {
      await onBorrarCuenta(passwordBorrar);
    } catch (err) {
      setErrorBorrar(err.message?.includes("auth/wrong-password") || err.code === "auth/wrong-password" ? "Contraseña incorrecta." : (err.message || "No se ha podido borrar la cuenta."));
    }
  };

  return (
    <div className="cl-grid-3">
      <div>
        <h2 className="cl-display" style={{ fontSize: "22px", color: "var(--pitch-dark)" }}>DATOS DE CONTACTO</h2>
        <div className="cl-ticket">
          <label className="cl-label">NOMBRE DEL CLUB</label>
          <input className="cl-input" value={clubName} onChange={(e) => setClubName(e.target.value)} maxLength={LIMITES.clubName} style={{ marginBottom: "8px" }} />
          <label className="cl-label">TELÉFONO</label>
          <input className="cl-input" value={telefono} onChange={(e) => setTelefono(e.target.value)} maxLength={LIMITES.telefono} style={{ marginBottom: "8px" }} />
          <p style={{ fontSize: "11px", color: "#888", marginBottom: "8px" }}>
            Los equipos que ya has publicado no se actualizan solos con el nuevo teléfono — solo afecta a lo nuevo que publiques a partir de ahora.
          </p>
          <button className="cl-btn cl-btn-primary" onClick={guardar} disabled={guardando} style={{ width: "100%", justifyContent: "center" }}>
            <Save size={14} /> {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
          {aviso && <p style={{ color: "var(--pitch)", fontSize: "12px", marginTop: "6px" }}>{aviso}</p>}
          {error && <p style={{ color: "var(--clay)", fontSize: "12px", marginTop: "6px" }}>{error}</p>}
        </div>

        <p style={{ fontSize: "13px" }}>
          <a href="#" onClick={(e) => { e.preventDefault(); setVerPolitica(true); }}>Ver política de privacidad</a>
        </p>
      </div>

      <div>
        <h2 className="cl-display" style={{ fontSize: "22px", color: "var(--clay)" }}>ZONA PELIGROSA</h2>
        {!borrando ? (
          <div className="cl-ticket" style={{ borderColor: "var(--clay)" }}>
            <p style={{ fontSize: "13px", marginBottom: "10px" }}>
              Borrar tu cuenta elimina de forma permanente tu club, tus equipos, tu calendario de jornadas y todos tus huecos publicados. No se puede deshacer.
            </p>
            <button className="cl-btn cl-btn-ghost" onClick={() => setBorrando(true)}>
              <Trash2 size={14} /> Borrar mi cuenta
            </button>
          </div>
        ) : (
          <div className="cl-ticket" style={{ borderColor: "var(--clay)" }}>
            <p style={{ fontSize: "13px", marginBottom: "8px" }}>
              Para confirmar, escribe tu contraseña actual:
            </p>
            <input
              type="password"
              className="cl-input"
              value={passwordBorrar}
              onChange={(e) => setPasswordBorrar(e.target.value)}
              style={{ marginBottom: "8px" }}
            />
            <div className="cl-row">
              <button className="cl-btn cl-btn-ghost" onClick={() => { setBorrando(false); setPasswordBorrar(""); setErrorBorrar(""); }}>
                Cancelar
              </button>
              <button className="cl-btn" style={{ background: "var(--clay)", color: "white" }} onClick={confirmarBorrado}>
                <Trash2 size={14} /> Confirmar borrado definitivo
              </button>
            </div>
            {errorBorrar && <p style={{ color: "var(--clay)", fontSize: "12px", marginTop: "6px" }}>{errorBorrar}</p>}
          </div>
        )}
      </div>

      {verPolitica && <PoliticaPrivacidad onCerrar={() => setVerPolitica(false)} />}
    </div>
  );
}
