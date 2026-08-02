import { useState, useEffect } from "react";
import { Shield, CalendarDays, Search, LayoutGrid, Trophy, SlidersHorizontal, LogOut } from "lucide-react";
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
import { escucharEnPrimerPlano, activarNotificaciones } from "./hooks/useNotificaciones";
import { useEstadoApp } from "./hooks/useEstadoApp";
import "./styles.css";

export default function App() {
  const uidPublico = new URLSearchParams(window.location.search).get("publico");
  if (uidPublico) return <CuadrantePublico uidClub={uidPublico} />;

  const estadoApp = useEstadoApp();
  if (estadoApp.mantenimiento) {
    return (
      <div className="cl-shell">
        <Header role="coordinador" setRole={() => {}} loggedIn={false} />
        <div className="cl-main">
          <div className="cl-auth-box cl-ticket" style={{ textAlign: "center" }}>
            <h2 className="cl-display" style={{ fontSize: "24px", color: "var(--pitch-dark)" }}>UN MOMENTO...</h2>
            <p style={{ fontSize: "14px", color: "#64748B", marginTop: "10px" }}>
              {estadoApp.mensaje || "Estamos mejorando la aplicación — en breves momentos podrás volver a utilizarla."}
            </p>
          </div>
        </div>
      </div>
    );
  }

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

  const [recienRegistrado, setRecienRegistrado] = useState(false);
  const onSignupYRecordar = async (...args) => {
    await signup(...args);
    setRecienRegistrado(true);
  };
  // Para no repetir esto en cada pantalla dentro de la misma sesión una vez
  // que ya se ha visto (aceptada o no) — pero si vuelve a entrar otro día y
  // sigue sin tener ningún dispositivo guardado, se lo volvemos a ofrecer.
  const [notifVistaEstaSesion, setNotifVistaEstaSesion] = useState(() => {
    try { return sessionStorage.getItem("cl_notif_vista") === "1"; } catch { return false; }
  });
  const marcarNotifVista = () => {
    try { sessionStorage.setItem("cl_notif_vista", "1"); } catch { /* nada */ }
    setNotifVistaEstaSesion(true);
    setRecienRegistrado(false);
  };

  useCierreSesionPorInactividad(!!user, logout);
  useEffect(() => {
    if (user) escucharEnPrimerPlano();
  }, [user]);

  if (loading) return null;

  if (!user || !profile) {
    return (
      <div className="cl-shell">
        <Header role={role} setRole={setRole} loggedIn={false} />
        <div className="cl-main">
          <Login onLogin={login} onSignup={onSignupYRecordar} onRecuperar={recuperarContrasena} onComprobarDuplicado={comprobarNombreDuplicado} />
        </div>
      </div>
    );
  }

  const tieneAlgunDispositivoActivado = !!(
    profile.fcmTokensPorCategoria && Object.values(profile.fcmTokensPorCategoria).some((arr) => Array.isArray(arr) && arr.length > 0)
  );

  if (recienRegistrado || (!tieneAlgunDispositivoActivado && !notifVistaEstaSesion)) {
    return (
      <div className="cl-shell">
        <Header role={role} setRole={setRole} loggedIn={false} />
        <div className="cl-main">
          <PantallaActivarNotificaciones uid={user.uid} esNueva={recienRegistrado} onListo={marcarNotifVista} />
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

function PantallaActivarNotificaciones({ uid, esNueva, onListo }) {
  const [estado, setEstado] = useState("inicial"); // inicial | activando | error
  const [error, setError] = useState("");

  const activar = async () => {
    setEstado("activando");
    setError("");
    try {
      await activarNotificaciones(uid);
      onListo();
    } catch (err) {
      // No dejamos a nadie encallado aquí para siempre: si el navegador no
      // puede activarlas (o la persona lo rechaza en el aviso del sistema),
      // avisamos y dejamos seguir de todas formas — podrá intentarlo otra
      // vez cuando quiera desde Ajustes.
      setError((err.message || "No se ha podido activar.") + " Puedes intentarlo más tarde desde Ajustes → Notificaciones.");
      setEstado("error");
    }
  };

  return (
    <div className="cl-auth-box cl-ticket">
      <h2 className="cl-display" style={{ fontSize: "24px", color: "var(--pitch-dark)" }}>
        {esNueva ? "¡CLUB CREADO!" : "ACTIVA LAS NOTIFICACIONES"}
      </h2>
      <p style={{ fontSize: "13px", color: "#64748B", marginBottom: "16px" }}>
        Un último paso muy importante — activa los avisos en este dispositivo para enterarte al momento de
        solicitudes nuevas, aceptaciones y cancelaciones. Es la mejor forma de no llevarte un disgusto por no
        haberte enterado a tiempo.
      </p>
      {error && <p style={{ color: "var(--clay)", fontSize: "12px", marginBottom: "10px" }}>{error}</p>}
      <button className="cl-btn cl-btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={activar} disabled={estado === "activando"}>
        {estado === "activando" ? "Activando..." : estado === "error" ? "Reintentar" : "Activar notificaciones"}
      </button>
      {estado === "error" && (
        <button className="cl-btn cl-btn-ghost" style={{ width: "100%", justifyContent: "center", marginTop: "8px" }} onClick={onListo}>
          Continuar de todas formas
        </button>
      )}
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
      <p style={{ fontSize: "13px", color: "#64748B", marginBottom: "12px" }}>
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
    <>
      <header className="cl-header">
        <div className="cl-header-inner">
          <div className="cl-row" style={{ alignItems: "center" }}>
            {loggedIn && escudoUrl && (
              <img src={escudoUrl} alt="" style={{ width: "44px", height: "44px", objectFit: "contain", flexShrink: 0, borderRadius: "10px" }} />
            )}
            <div>
              {loggedIn && (
                <p className="cl-mono" style={{ fontSize: "15px", fontWeight: 700, color: "var(--text)", marginBottom: "0px", lineHeight: 1.1 }}>
                  {clubName}
                </p>
              )}
              <h1 className="cl-display cl-title" style={{ fontSize: loggedIn ? "13px" : undefined, color: loggedIn ? "var(--text-secondary)" : undefined, fontWeight: loggedIn ? 500 : undefined }}>
                {loggedIn ? "On Juguem" : "ON JUGUEM"}
              </h1>
              {!loggedIn && <p className="cl-mono cl-subtitle">{t("app.subtitulo_fuera")}</p>}
            </div>
          </div>
          <select
            className="cl-input"
            style={{ fontSize: "12px", padding: "6px 10px", width: "auto" }}
            value={getIdioma()}
            onChange={(e) => cambiarIdioma(e.target.value)}
            title="Idioma"
          >
            {IDIOMAS.map((i) => <option key={i.codigo} value={i.codigo}>{i.nombre}</option>)}
          </select>
        </div>
      </header>
      {loggedIn && (
        <nav className="cl-tabs">
          <button className={`cl-tab ${role === "coordinador" ? "active" : ""}`} onClick={() => setRole("coordinador")}>
            <Shield />
            {t("nav.mi_club")}
            {avisos > 0 && <span className="cl-badge-aviso">{avisos}</span>}
          </button>
          <button className={`cl-tab ${role === "temporada" ? "active" : ""}`} onClick={() => setRole("temporada")}>
            <CalendarDays />
            {t("nav.temporada")}
          </button>
          <button className={`cl-tab ${role === "club" ? "active" : ""}`} onClick={() => setRole("club")}>
            <Search />
            {t("nav.busco_rival")}
            {avisosClub > 0 && <span className="cl-badge-aviso">{avisosClub}</span>}
          </button>
          <button className={`cl-tab ${role === "cuadrante" ? "active" : ""}`} onClick={() => setRole("cuadrante")}>
            <LayoutGrid />
            {t("nav.cuadrante")}
          </button>
          <button className={`cl-tab ${role === "torneos" ? "active" : ""}`} onClick={() => setRole("torneos")}>
            <Trophy />
            {t("nav.torneos")}
          </button>
          <button className={`cl-tab ${role === "ajustes" ? "active" : ""}`} onClick={() => setRole("ajustes")}>
            <SlidersHorizontal />
            {t("nav.ajustes")}
          </button>
          <button className="cl-tab" onClick={onLogout}>
            <LogOut />
            {t("nav.salir")}
          </button>
        </nav>
      )}
    </>
  );
}
