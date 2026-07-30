import { useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { useMyTeams, useMySlots, useAllSlots } from "./hooks/useClubData";
import { useJornadas } from "./hooks/useJornadas";
import { useCierreSesionPorInactividad } from "./hooks/useCierreSesionPorInactividad";
import { getIdentidadActual, setIdentidadActual, IDENTIDADES_SUGERIDAS } from "./identidad";
import Login from "./components/Login";
import CoordinadorView from "./components/CoordinadorView";
import ClubView from "./components/ClubView";
import CuadranteView from "./components/CuadranteView";
import TemporadaView from "./components/TemporadaView";
import AjustesView from "./components/AjustesView";
import "./styles.css";

export default function App() {
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
          (s.status === "pactado" && s.sede === "local") ||
          (s.cancelacionPropuestaPor && s.cancelacionPropuestaPor !== user.uid)
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

function Header({ role, setRole, loggedIn, clubName, onLogout, avisos, avisosClub }) {
  const [identidad, setIdentidad] = useState(getIdentidadActual());

  const cambiarIdentidad = (valor) => {
    setIdentidad(valor);
    setIdentidadActual(valor);
  };

  return (
    <header className="cl-header">
      <div className="cl-header-inner">
        <div>
          <h1 className="cl-display cl-title">ON JUGUEM</h1>
          <p className="cl-mono cl-subtitle">
            {loggedIn ? `${clubName} · amistosos sin líos de whatsapp` : "amistosos pretemporada · sin líos de whatsapp"}
          </p>
          {loggedIn && (
            <select
              className="cl-input"
              style={{ marginTop: "6px", fontSize: "12px", padding: "3px 6px", width: "auto" }}
              value={identidad}
              onChange={(e) => cambiarIdentidad(e.target.value)}
              title="Quién eres — solo para que el historial sepa distinguir, si compartís el mismo login"
            >
              <option value="">¿Quién eres? (opcional)</option>
              {IDENTIDADES_SUGERIDAS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          )}
        </div>
        {loggedIn && (
          <div className="cl-tabs">
            <button className={`cl-tab ${role === "coordinador" ? "active" : ""}`} onClick={() => setRole("coordinador")}>
              MI CLUB
              {avisos > 0 && <span className="cl-badge-aviso">{avisos}</span>}
            </button>
            <button className={`cl-tab ${role === "temporada" ? "active" : ""}`} onClick={() => setRole("temporada")}>PRE/POST TEMPORADA</button>
            <button className={`cl-tab ${role === "club" ? "active" : ""}`} onClick={() => setRole("club")}>
              BUSCO RIVAL
              {avisosClub > 0 && <span className="cl-badge-aviso">{avisosClub}</span>}
            </button>
            <button className={`cl-tab ${role === "cuadrante" ? "active" : ""}`} onClick={() => setRole("cuadrante")}>CUADRANTE</button>
            <button className={`cl-tab ${role === "ajustes" ? "active" : ""}`} onClick={() => setRole("ajustes")}>AJUSTES</button>
            <button className="cl-tab" onClick={onLogout}>SALIR</button>
          </div>
        )}
      </div>
    </header>
  );
}
