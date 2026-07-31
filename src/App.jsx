import { useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { useMyTeams, useMySlots, useAllSlots } from "./hooks/useClubData";
import { useJornadas } from "./hooks/useJornadas";
import { useCierreSesionPorInactividad } from "./hooks/useCierreSesionPorInactividad";
import { getIdentidadActual, setIdentidadActual, IDENTIDADES_SUGERIDAS } from "./identidad";
import { t, getIdioma, setIdioma, IDIOMAS } from "./i18n";
import Login from "./components/Login";
import CoordinadorView from "./components/CoordinadorView";
import ClubView from "./components/ClubView";
import CuadranteView from "./components/CuadranteView";
import TemporadaView from "./components/TemporadaView";
import AjustesView from "./components/AjustesView";
import CuadrantePublico from "./components/CuadrantePublico";
import "./styles.css";

export default function App() {
  const uidPublico = new URLSearchParams(window.location.search).get("publico");
  if (uidPublico) return <CuadrantePublico uidClub={uidPublico} />;

  const {
    user, profile, loading, signup, login, logout,
    updateContact, recuperarContrasena, deleteAccount,
    comprobarNombreDuplicado, reenviarVerificacion, verificarClub,
  } = useAuth();
  const [role, setRole] = useState("coordinador");
  const [avisoVerificacion, setAvisoVerificacion] = useState("");

  const myTeams = useMyTeams(user?.uid);
  const mySlots = useMySlots(user?.uid);
  const allSlots = useAllSlots();
  const jornadas = useJornadas(user?.uid);
  const [identidadLista, setIdentidadLista] = useState(!!getIdentidadActual());

  useCierreSesionPorInactividad(!!user, logout);

  if (loading) return null;

  if (!user || !profile) {
    return (
      <div className="cl-shell">
        <Header role={role} setRole={setRole} loggedIn={false} />
        <div className="cl-main">
          <Login onLogin={login} onSignup={signup} onRecuperar={recuperarContrasena} onComprobarDuplicado={comprobarNombreDuplicado} />
        </div>
      </div>
    );
  }

  if (!identidadLista) {
    return (
      <div className="cl-shell">
        <Header role={role} setRole={setRole} loggedIn={false} />
        <div className="cl-main">
          <PantallaQuienEres clubName={profile.clubName} onListo={() => setIdentidadLista(true)} />
        </div>
      </div>
    );
  }

  const reenviar = async () => {
    try {
      await reenviarVerificacion();
      setAvisoVerificacion("Te hemos vuelto a enviar el email de verificación.");
    } catch {
      setAvisoVerificacion("No se ha podido reenviar ahora mismo, prueba en un rato.");
    }
  };

  return (
    <div className="cl-shell">
      <Header
        role={role}
        setRole={setRole}
        loggedIn={true}
        clubName={profile.clubName}
        onLogout={logout}
        avisos={mySlots.filter((s) =>
          s.status === "pendiente" ||
          (s.status === "pactado" && !s.sede) ||
          (s.status === "pactado" && s.sede === "local") ||
          (s.cancelacionPropuestaPor && s.cancelacionPropuestaPor !== user.uid) ||
          (s.cambioPropuestoPor && s.cambioPropuestoPor !== user.uid)
        ).length}
        avisosClub={allSlots.filter((s) =>
          s.requestedByUid === user.uid && (
            (s.status === "pactado" && s.sede === "visitante") ||
            (s.cancelacionPropuestaPor && s.cancelacionPropuestaPor !== user.uid)
          )
        ).length}
      />
      <div className="cl-main">
        {user && !user.emailVerified && (
          <div className="cl-ticket no-print" style={{ borderColor: "var(--gold)", background: "#FBF6E8" }}>
            <p style={{ fontSize: "13px" }}>
              Todavía no has verificado tu email ({user.email}). Revisa tu bandeja de entrada, o{" "}
              <a href="#" onClick={(e) => { e.preventDefault(); reenviar(); }}>reenvía el email de verificación</a>.
            </p>
            {avisoVerificacion && <p style={{ fontSize: "12px", color: "var(--pitch)" }}>{avisoVerificacion}</p>}
          </div>
        )}
        {role === "coordinador" && (
          <CoordinadorView
            uid={user.uid}
            clubName={profile.clubName}
            telefono={profile.telefono}
            email={profile.email}
            teams={myTeams}
            slots={mySlots}
            jornadas={jornadas}
            allSlots={allSlots}
          />
        )}
        {role === "temporada" && <TemporadaView uid={user.uid} jornadas={jornadas} slots={mySlots} teams={myTeams} />}
        {role === "club" && (
          <ClubView
            uid={user.uid}
            clubName={profile.clubName}
            telefono={profile.telefono}
            email={profile.email}
            allSlots={allSlots}
            misEquipos={myTeams}
            misJornadas={jornadas}
            misVerificado={profile.verificado}
          />
        )}
        {role === "cuadrante" && (
          <CuadranteView
            clubName={profile.clubName}
            teams={myTeams}
            slots={mySlots}
            jornadas={jornadas}
            modo="propio"
            allSlots={allSlots}
            uid={user.uid}
          />
        )}
        {role === "ajustes" && (
          <AjustesView
            uid={user.uid}
            profile={profile}
            onGuardarContacto={(datos) => updateContact(user.uid, datos)}
            onBorrarCuenta={(password) => deleteAccount(password)}
            onVerificar={verificarClub}
          />
        )}
      </div>
    </div>
  );
}

function PantallaQuienEres({ clubName, onListo }) {
  const [elegido, setElegido] = useState("");

  const continuar = () => {
    if (!elegido) return;
    setIdentidadActual(elegido);
    onListo();
  };

  return (
    <div className="cl-auth-box cl-ticket">
      <h2 className="cl-display" style={{ fontSize: "24px", color: "var(--pitch-dark)" }}>{t("identidad.titulo")}</h2>
      <p style={{ fontSize: "13px", color: "#666", marginBottom: "12px" }}>
        {clubName} — {t("identidad.explicacion")}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
        {IDENTIDADES_SUGERIDAS.map((op) => (
          <button
            key={op}
            className="cl-btn"
            style={{
              justifyContent: "flex-start",
              background: elegido === op ? "var(--pitch)" : "white",
              color: elegido === op ? "white" : "var(--ink)",
              border: "1.5px solid var(--line)",
            }}
            onClick={() => setElegido(op)}
          >
            {op}
          </button>
        ))}
      </div>
      <button className="cl-btn cl-btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={continuar} disabled={!elegido}>
        {t("identidad.continuar")}
      </button>
    </div>
  );
}

function Header({ role, setRole, loggedIn, clubName, onLogout, avisos, avisosClub }) {
  const [identidad, setIdentidad] = useState(getIdentidadActual());

  const cambiarIdentidad = (valor) => {
    setIdentidad(valor);
    setIdentidadActual(valor);
  };

  const cambiarIdioma = (codigo) => {
    setIdioma(codigo);
    window.location.reload();
  };

  return (
    <header className="cl-header">
      <div className="cl-header-inner">
        <div>
          <h1 className="cl-display cl-title">ON JUGUEM</h1>
          <p className="cl-mono cl-subtitle">
            {loggedIn ? `${clubName} · ${t("app.subtitulo_dentro")}` : t("app.subtitulo_fuera")}
          </p>
          <div className="cl-row" style={{ marginTop: "6px" }}>
            {loggedIn && (
              <select
                className="cl-input"
                style={{ fontSize: "12px", padding: "3px 6px", width: "auto" }}
                value={identidad}
                onChange={(e) => cambiarIdentidad(e.target.value)}
                title="Quién eres — solo para que el historial sepa distinguir, si compartís el mismo login"
              >
                <option value="">¿Quién eres? (opcional)</option>
                {IDENTIDADES_SUGERIDAS.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            )}
            <select
              className="cl-input"
              style={{ fontSize: "12px", padding: "3px 6px", width: "auto" }}
              value={getIdioma()}
              onChange={(e) => cambiarIdioma(e.target.value)}
              title="Idioma"
            >
              {IDIOMAS.map((i) => <option key={i.codigo} value={i.codigo}>{i.nombre}</option>)}
            </select>
          </div>
        </div>
        {loggedIn && (
          <div className="cl-tabs">
            <button className={`cl-tab ${role === "coordinador" ? "active" : ""}`} onClick={() => setRole("coordinador")}>
              {t("nav.mi_club")}
              {avisos > 0 && <span className="cl-badge-aviso">{avisos}</span>}
            </button>
            <button className={`cl-tab ${role === "temporada" ? "active" : ""}`} onClick={() => setRole("temporada")}>{t("nav.temporada")}</button>
            <button className={`cl-tab ${role === "club" ? "active" : ""}`} onClick={() => setRole("club")}>
              {t("nav.busco_rival")}
              {avisosClub > 0 && <span className="cl-badge-aviso">{avisosClub}</span>}
            </button>
            <button className={`cl-tab ${role === "cuadrante" ? "active" : ""}`} onClick={() => setRole("cuadrante")}>{t("nav.cuadrante")}</button>
            <button className={`cl-tab ${role === "ajustes" ? "active" : ""}`} onClick={() => setRole("ajustes")}>{t("nav.ajustes")}</button>
            <button className="cl-tab" onClick={onLogout}>{t("nav.salir")}</button>
          </div>
        )}
      </div>
    </header>
  );
}
