import { useState } from "react";
import PoliticaPrivacidad from "./PoliticaPrivacidad";
import { telefonoValido, LIMITES } from "../validaciones";

export default function Login({ onLogin, onSignup, onRecuperar, onComprobarDuplicado }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [clubName, setClubName] = useState("");
  const [telefono, setTelefono] = useState("");
  const [aceptaPrivacidad, setAceptaPrivacidad] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [loading, setLoading] = useState(false);
  const [verPolitica, setVerPolitica] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setAviso("");
    if (mode === "signup" && !aceptaPrivacidad) {
      setError("Tienes que aceptar la política de privacidad para crear tu club.");
      return;
    }
    if (mode === "signup" && !telefonoValido(telefono)) {
      setError("Ese teléfono no parece válido — escribe solo el número, con 9 a 15 dígitos (puede llevar + al principio).");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        await onLogin(email, password);
      } else {
        if (onComprobarDuplicado) {
          const yaExiste = await onComprobarDuplicado(clubName);
          if (yaExiste) {
            const seguir = window.confirm(
              `Ya hay un club registrado con el nombre "${clubName}". Si no eres tú, elige un nombre algo distinto para no confundiros (ej. añadiendo la localidad). ¿Quieres seguir de todas formas?`
            );
            if (!seguir) {
              setLoading(false);
              return;
            }
          }
        }
        await onSignup(email, password, clubName, telefono);
      }
    } catch (err) {
      setError(traducirError(err.code));
    }
    setLoading(false);
  };

  const recuperar = async () => {
    if (!email) {
      setError("Escribe tu email arriba primero, y luego pulsa este enlace.");
      return;
    }
    setError("");
    try {
      await onRecuperar(email);
      setAviso("Te hemos enviado un email para restablecer tu contraseña. Revisa tu bandeja de entrada (y el spam, por si acaso).");
    } catch (err) {
      setError(traducirError(err.code));
    }
  };

  return (
    <div className="cl-auth-box cl-ticket">
      <h2 className="cl-display" style={{ fontSize: "26px", color: "var(--pitch-dark)" }}>
        {mode === "login" ? "ENTRAR" : "CREAR CLUB"}
      </h2>
      <form onSubmit={submit} className="cl-grid-2" style={{ gridTemplateColumns: "1fr", gap: "10px", marginTop: "12px" }}>
        {mode === "signup" && (
          <>
            <div>
              <label className="cl-label">NOMBRE DE TU CLUB</label>
              <input className="cl-input" value={clubName} onChange={(e) => setClubName(e.target.value)} maxLength={LIMITES.clubName} required />
            </div>
            <div>
              <label className="cl-label">TELÉFONO DE CONTACTO</label>
              <input
                type="tel"
                className="cl-input"
                placeholder="Ej. 612 345 678"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                maxLength={LIMITES.telefono}
                required
              />
            </div>
          </>
        )}
        <div>
          <label className="cl-label">EMAIL</label>
          <input type="email" className="cl-input" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="cl-label">CONTRASEÑA</label>
          <input type="password" className="cl-input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </div>

        {mode === "signup" && (
          <label className="cl-row" style={{ fontSize: "12px", alignItems: "flex-start", cursor: "pointer" }}>
            <input type="checkbox" checked={aceptaPrivacidad} onChange={(e) => setAceptaPrivacidad(e.target.checked)} style={{ marginTop: "3px" }} />
            <span>
              He leído y acepto la{" "}
              <a href="#" onClick={(e) => { e.preventDefault(); setVerPolitica(true); }}>política de privacidad</a>
              , y entiendo que otros clubes verán mi teléfono y email al cerrar un partido conmigo.
            </span>
          </label>
        )}

        {error && <p style={{ color: "var(--clay)", fontSize: "13px" }}>{error}</p>}
        {aviso && <p style={{ color: "var(--pitch)", fontSize: "13px" }}>{aviso}</p>}

        <button className="cl-btn cl-btn-primary" disabled={loading} style={{ justifyContent: "center" }}>
          {loading ? "Un momento..." : mode === "login" ? "Entrar" : "Crear mi club"}
        </button>
      </form>

      {mode === "login" && (
        <p style={{ fontSize: "12px", textAlign: "center", marginTop: "8px" }}>
          <a href="#" onClick={(e) => { e.preventDefault(); recuperar(); }}>¿Has olvidado tu contraseña?</a>
        </p>
      )}

      <p style={{ fontSize: "13px", marginTop: "14px", textAlign: "center" }}>
        {mode === "login" ? (
          <>¿Aún no tienes club? <a href="#" onClick={(e) => { e.preventDefault(); setMode("signup"); }}>Crea uno</a></>
        ) : (
          <>¿Ya tienes cuenta? <a href="#" onClick={(e) => { e.preventDefault(); setMode("login"); }}>Entra</a></>
        )}
      </p>

      {verPolitica && <PoliticaPrivacidad onCerrar={() => setVerPolitica(false)} />}
    </div>
  );
}

function traducirError(code) {
  const map = {
    "auth/invalid-email": "Ese email no es válido.",
    "auth/user-not-found": "Email o contraseña incorrectos.",
    "auth/wrong-password": "Email o contraseña incorrectos.",
    "auth/invalid-credential": "Email o contraseña incorrectos.",
    "auth/email-already-in-use": "Ya hay una cuenta con ese email.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/too-many-requests": "Demasiados intentos. Espera un momento y vuelve a probar.",
  };
  return map[code] || "Algo ha ido mal. Inténtalo de nuevo.";
}
