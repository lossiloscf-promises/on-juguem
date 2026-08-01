import { useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { useMyTeams, useMySlots, useAllSlots, useAllTeams } from "./hooks/useClubData";
import { useJornadas } from "./hooks/useJornadas";
import { useCierreSesionPorInactividad } from "./hooks/useCierreSesionPorInactividad";
import { t, getIdioma, setIdioma, IDIOMAS } from "./i18n";
import { getIdentidadActual, setIdentidadActual } from "./identidad";
import { CLAVES_COORDINADOR } from "./constants";
import Login from "./components/Login";
import CoordinadorView from "./components/CoordinadorView";
import ClubView from "./components/ClubView";
import CuadranteView from "./components/CuadranteView";
import TemporadaView from "./components/TemporadaView";
import AjustesView from "./components/AjustesView";
import TorneosView from "./components/TorneosView";
import CuadrantePublico from "./components/CuadrantePublico";
import "./styles.css";

export default function App() {
  const uidPublico = new URLSearchParams(window.location.search).get("publico");
  if (uidPublico) return <CuadrantePublico uidClub={uidPublico} />;

  const {
    user, profile, loading, signup, login, logout,
    updateContact, updateCoordinadores, actualizarEscudoLocal, recuperarContrasena, deleteAccount,
    comprobarNombreDuplicado, reenviarVerificacion, verificarClub,
  } = useAuth();
  const [role, setRole] = useState("coordinador");
  const [avisoVerificacion, setAvisoVerificacion] = useState("");
  const [identidadLista, setIdentidadLista] = useState(!!getIdentidadActual());

  const myTeams = useMyTeams(user?.uid);
  const allTeams = useAllTeams();
  const teamsPorClub = Object.fromEntries(allTeams.map((t) => [t.id, t]));
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

  const coordinadoresRellenados = CLAVES_COORDINADOR.filter((c) => {
    const co = profile.coordinadores?.[c.clave];
    return co && (co.nombre || co.telefono || co.email);
  });

  if (coordinadoresRellenados.length > 1 && !identidadLista) {
    return (
      <div className="cl-shell">
        <Header role={role} setRole={setRole} loggedIn={false} />
        <div className="cl-main">
          <PantallaQuienEres
            clubName={profile.clubName}
            escudoUrl={profile.escudoUrl}
            opciones={coordinadoresRellenados}
            onListo={() => setIdentidadLista(true)}
          />
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
        escudoUrl={profile.escudoUrl}
        onLogout={logout}
        avisos={mySlots.filter((s) =>
          s.status === "pendiente" ||
          (s.status === "pactado" && !s.sede) ||
          (s.status === "pactado" && s.sede === "local") ||
          (s.cancelacionPropuestaPor && s.cancelacionPropuestaPor !== user.uid) ||
          (s.cambioPropuestoPor && s.cambioPropuestoPor !== user.uid) ||
          (s.sedePropuestaPor && s.sedePropuestaPor !== user.uid)
        ).length}
        avisosClub={allSlots.filter((s) =>
          s.requestedByUid === user.uid && (
            (s.status === "pactado" && s.sede === "visitante") ||
            (s.cancelacionPropuestaPor && s.cancelacionPropuestaPor !== user.uid) ||
            (s.cambioPropuestoPor && s.cambioPropuestoPor !== user.uid) ||
            (s.sedePropuestaPor && s.sedePropuestaPor !== user.uid)
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
            miProfile={profile}
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
            miProfile={profile}
            escudoUrl={profile.escudoUrl}
          />
        )}
        {role === "torneos" && (
          <TorneosView
            uid={user.uid}
            clubName={profile.clubName}
            telefono={profile.telefono}
            email={profile.email}
            misEquipos={myTeams}
            jornadas={jornadas}
            teamsPorClub={teamsPorClub}
          />
        )}
        {role === "ajustes" && (
          <AjustesView
            uid={user.uid}
            profile={profile}
            onGuardarContacto={(datos) => updateContact(user.uid, datos)}
            onGuardarCoordinadores={(uid, datos) => updateCoordinadores(uid, datos)}
            onEscudoCambiado={actualizarEscudoLocal}
            onBorrarCuenta={(password) => deleteAccount(password)}
            onVerificar={verificarClub}
          />
        )}
      </div>
    </div>
  );
}

function PantallaQuienEres({ clubName, escudoUrl, opciones, onListo }) {
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
      {!escudoUrl && (
        <p style={{ fontSize: "12px", color: "var(--clay)", background: "#FDECEA", padding: "8px", borderRadius: "4px", marginBottom: "12px" }}>
          ⚠️ Todavía no has subido el escudo del club — puedes hacerlo cuando quieras en Ajustes.
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
        {opciones.map((op) => (
          <button
            key={op.clave}
            className="cl-btn"
            style={{
              justifyContent: "flex-start",
              background: elegido === op.label ? "var(--pitch)" : "white",
              color: elegido === op.label ? "white" : "var(--ink)",
              border: "1.5px solid var(--line)",
            }}
            onClick={() => setElegido(op.label)}
          >
            {op.label}
          </button>
        ))}
      </div>
      <button className="cl-btn cl-btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={continuar} disabled={!elegido}>
        {t("identidad.continuar")}
      </button>
    </div>
  );
}

function Header({ role, setRole, loggedIn, clubName, escudoUrl, onLogout, avisos, avisosClub }) {
  const cambiarIdioma = (codigo) => {
    setIdioma(codigo);
    window.location.reload();
  };

  return (
    <header className="cl-header">
      <div className="cl-header-inner">
        <div className="cl-row" style={{ alignItems: "center" }}>
          {loggedIn && escudoUrl && (
            <img src={escudoUrl} alt="" style={{ width: "68px", height: "68px", objectFit: "contain", flexShrink: 0 }} />
          )}
          <div>
            {loggedIn && (
              <p className="cl-mono" style={{ fontSize: "20px", fontWeight: 700, color: "white", marginBottom: "2px", lineHeight: 1.1 }}>
                {clubName}
              </p>
            )}
            <h1 className="cl-display cl-title" style={{ fontSize: loggedIn ? "30px" : undefined }}>ON JUGUEM</h1>
            <p className="cl-mono cl-subtitle">
              {loggedIn ? t("app.subtitulo_dentro") : t("app.subtitulo_fuera")}
            </p>
            <div className="cl-row" style={{ marginTop: "6px" }}>
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
            <button className={`cl-tab ${role === "torneos" ? "active" : ""}`} onClick={() => setRole("torneos")}>{t("nav.torneos")}</button>
            <button className={`cl-tab ${role === "ajustes" ? "active" : ""}`} onClick={() => setRole("ajustes")}>{t("nav.ajustes")}</button>
            <button className="cl-tab" onClick={onLogout}>{t("nav.salir")}</button>
          </div>
        )}
      </div>
    </header>
  );
}
