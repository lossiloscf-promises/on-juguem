import { useState } from "react";
import PoliticaPrivacidad from "./PoliticaPrivacidad";
import { telefonoValido, LIMITES } from "../validaciones";
import { useClubesOficiales, crearSolicitudClub } from "../hooks/useClubesOficiales";

function BuscadorDeClub({ clubElegido, setClubElegido }) {
  const clubes = useClubesOficiales();
  const [texto, setTexto] = useState("");
  const [mostrarLista, setMostrarLista] = useState(false);
  const [pidiendoAlta, setPidiendoAlta] = useState(false);
  const [nombreSolicitado, setNombreSolicitado] = useState("");
  const [telefonoSolicitud, setTelefonoSolicitud] = useState("");
  const [emailSolicitud, setEmailSolicitud] = useState("");
  const [solicitudEnviada, setSolicitudEnviada] = useState(false);
  const [errorSolicitud, setErrorSolicitud] = useState("");

  const coincidencias =
    texto.trim().length > 0
      ? clubes.filter((c) => c.nombre.toLowerCase().includes(texto.trim().toLowerCase())).slice(0, 8)
      : [];

  const enviarSolicitud = async () => {
    if (!nombreSolicitado.trim() || !telefonoSolicitud.trim() || !emailSolicitud.trim()) {
      setErrorSolicitud("Rellena los tres campos.");
      return;
    }
    setErrorSolicitud("");
    try {
      await crearSolicitudClub(nombreSolicitado, telefonoSolicitud, emailSolicitud);
      setSolicitudEnviada(true);
    } catch (err) {
      setErrorSolicitud(err.message || "No se ha podido enviar la solicitud.");
    }
  };

  if (clubElegido) {
    return (
      <div>
        <label className="cl-label">TU CLUB</label>
        <div className="cl-row" style={{ justifyContent: "space-between", background: "#EAF3EC", padding: "8px 10px", borderRadius: "4px" }}>
          <span>✅ {clubElegido.nombre}</span>
          <button type="button" className="cl-btn cl-btn-ghost" style={{ padding: "2px 8px" }} onClick={() => setClubElegido(null)}>
            Cambiar
          </button>
        </div>
      </div>
    );
  }

  if (pidiendoAlta) {
    if (solicitudEnviada) {
      return (
        <p style={{ fontSize: "13px", color: "var(--pitch)" }}>
          Hemos recibido tu solicitud — en cuanto la revisemos y añadamos vuestro club a la lista, podrás completar el registro. Te avisaremos al email que nos has dado.
        </p>
      );
    }
    return (
      <div className="cl-ticket">
        <p style={{ fontSize: "12px", color: "#888", marginBottom: "8px" }}>
          Dinos el nombre de tu club y un contacto, y lo añadimos a la lista para que puedas registrarte.
        </p>
        <input className="cl-input" placeholder="Nombre del club" value={nombreSolicitado} onChange={(e) => setNombreSolicitado(e.target.value)} maxLength={100} style={{ marginBottom: "6px" }} />
        <input className="cl-input" placeholder="Teléfono de contacto" value={telefonoSolicitud} onChange={(e) => setTelefonoSolicitud(e.target.value)} maxLength={20} style={{ marginBottom: "6px" }} />
        <input className="cl-input" placeholder="Email de contacto" value={emailSolicitud} onChange={(e) => setEmailSolicitud(e.target.value)} maxLength={100} style={{ marginBottom: "6px" }} />
        {errorSolicitud && <p style={{ color: "var(--clay)", fontSize: "12px", marginBottom: "6px" }}>{errorSolicitud}</p>}
        <div className="cl-row">
          <button type="button" className="cl-btn cl-btn-primary" onClick={enviarSolicitud}>Enviar solicitud</button>
          <button type="button" className="cl-btn cl-btn-ghost" onClick={() => setPidiendoAlta(false)}>Volver a buscar</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <label className="cl-label">TU CLUB</label>
      <input
        className="cl-input"
        placeholder="Escribe el nombre de tu club..."
        value={texto}
        onChange={(e) => { setTexto(e.target.value); setMostrarLista(true); }}
        onFocus={() => setMostrarLista(true)}
      />
      {mostrarLista && texto.trim().length > 0 && (
        <div className="cl-ticket" style={{ position: "absolute", zIndex: 10, width: "100%", maxHeight: "220px", overflowY: "auto", marginTop: "4px" }}>
          {coincidencias.length > 0 ? (
            coincidencias.map((c) => (
              <div
                key={c.id}
                style={{ padding: "6px 4px", cursor: "pointer", borderBottom: "1px solid var(--line)" }}
                onClick={() => { setClubElegido(c); setMostrarLista(false); setTexto(""); }}
              >
                {c.nombre} {c.localidad && <span style={{ color: "#888", fontSize: "12px" }}>· {c.localidad}</span>}
              </div>
            ))
          ) : (
            <p style={{ fontSize: "13px", color: "#888" }}>No aparece ningún club con ese nombre.</p>
          )}
          <button type="button" className="cl-btn cl-btn-ghost" style={{ marginTop: "6px", width: "100%", justifyContent: "center" }} onClick={() => { setPidiendoAlta(true); setMostrarLista(false); }}>
            Mi club no está en la lista
          </button>
        </div>
      )}
    </div>
  );
}

export default function Login({ onLogin, onSignup, onRecuperar, onComprobarDuplicado }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [clubElegido, setClubElegido] = useState(null);
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
    if (mode === "signup" && !clubElegido) {
      setError("Elige tu club de la lista antes de continuar.");
      return;
    }
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
        const clubName = clubElegido.nombre;
        if (onComprobarDuplicado) {
          const yaExiste = await onComprobarDuplicado(clubName);
          if (yaExiste) {
            const seguir = window.confirm(
              `Ya hay un club registrado con el nombre "${clubName}". Si no eres tú, contacta con el administrador. ¿Quieres seguir de todas formas?`
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
            <BuscadorDeClub clubElegido={clubElegido} setClubElegido={setClubElegido} />
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
