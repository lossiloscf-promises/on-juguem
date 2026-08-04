import { useState, useEffect } from "react";
import { t } from "../i18n";
import { Save, Trash2, Plus, Download, AlertTriangle, CheckCircle2 } from "lucide-react";
import PoliticaPrivacidad from "./PoliticaPrivacidad";
import { telefonoValido, LIMITES } from "../validaciones";
import { useInstalaciones, addInstalacion, deleteInstalacion } from "../hooks/useInstalaciones";
import { CLAVES_COORDINADOR } from "../constants";
import { subirEscudo, borrarEscudo } from "../hooks/useEscudo";
import { activarNotificaciones, notificacionesSoportadas } from "../hooks/useNotificaciones";
import { limpiarTemporada } from "../hooks/useClubData";
import { useClubesOficiales } from "../hooks/useClubesOficiales";


function PanelNotificaciones({ uid, titulo }) {
  const [estado, setEstado] = useState("inicial"); // inicial | activando | activado | error | no_soportado
  const [error, setError] = useState("");

  useEffect(() => {
    notificacionesSoportadas().then((ok) => { if (!ok) setEstado("no_soportado"); });
  }, []);

  const activar = async () => {
    setEstado("activando");
    setError("");
    try {
      await activarNotificaciones(uid);
      setEstado("activado");
    } catch (err) {
      setError(err.message || "No se ha podido activar.");
      setEstado("error");
    }
  };

  return (
    <div className="cl-ticket">
      {titulo && <h2 className="cl-settings-title">{titulo}</h2>}
      <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "8px" }}>
        Activa los avisos en este dispositivo concreto para enterarte al momento de solicitudes nuevas, aceptaciones,
        propuestas de sede/horario y cancelaciones — sin tener que estar mirando la app.
      </p>
      {estado === "no_soportado" && (
        <p style={{ fontSize: "12px", color: "var(--clay)" }}>
          Este navegador no admite notificaciones push. En iPhone, primero tienes que añadir la app a la pantalla de
          inicio (compartir → "Añadir a pantalla de inicio") y abrirla desde ahí.
        </p>
      )}
      {estado !== "no_soportado" && estado !== "activado" && (
        <button className="cl-btn cl-btn-primary" onClick={activar} disabled={estado === "activando"}>
          {estado === "activando" ? "Activando..." : "Activar notificaciones en este dispositivo"}
        </button>
      )}
      {estado === "activado" && (
        <p style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--pitch)" }}>
          <CheckCircle2 size={14} /> Notificaciones activadas en este dispositivo.
        </p>
      )}
      {error && <p style={{ color: "var(--clay)", fontSize: "12px", marginTop: "6px" }}>{error}</p>}
    </div>
  );
}

function PanelEscudo({ uid, profile, onEscudoCambiado, titulo }) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");

  const elegirArchivo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setSubiendo(true);
    try {
      const url = await subirEscudo(uid, file);
      onEscudoCambiado?.(url);
    } catch (err) {
      setError(err.message || "No se ha podido subir el escudo.");
    }
    setSubiendo(false);
    e.target.value = "";
  };

  const quitar = async () => {
    if (!window.confirm("¿Quitar el escudo del club?")) return;
    setError("");
    try {
      await borrarEscudo(uid);
      onEscudoCambiado?.(null);
    } catch (err) {
      setError(err.message || "No se ha podido quitar.");
    }
  };

  return (
    <div className="cl-ticket">
      {titulo && <h2 className="cl-settings-title" style={{ marginBottom: "12px" }}>{titulo}</h2>}
      <div className="cl-row" style={{ alignItems: "center" }}>
        {profile.escudoUrl ? (
          <img src={profile.escudoUrl} alt="Escudo del club" style={{ width: "64px", height: "64px", objectFit: "contain", borderRadius: "8px", border: "1px solid var(--line)" }} />
        ) : (
          <div style={{ width: "64px", height: "64px", borderRadius: "8px", border: "1px dashed var(--line)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "var(--text-secondary)" }}>
            Sin escudo
          </div>
        )}
        <div>
          <label className="cl-btn cl-btn-primary" style={{ cursor: "pointer", display: "inline-flex" }}>
            {subiendo ? "Subiendo..." : profile.escudoUrl ? "Cambiar escudo" : "Subir escudo"}
            <input type="file" accept="image/*" onChange={elegirArchivo} disabled={subiendo} style={{ display: "none" }} />
          </label>
          {profile.escudoUrl && (
            <button className="cl-btn cl-btn-ghost" onClick={quitar} style={{ marginLeft: "6px" }}>Quitar</button>
          )}
        </div>
      </div>
      <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "6px" }}>Imagen cuadrada, máximo 2 MB. Se ve en el directorio de clubes y en el enlace público.</p>
      {error && <p style={{ color: "var(--clay)", fontSize: "12px", marginTop: "4px" }}>{error}</p>}
    </div>
  );
}

function PanelCoordinadores({ uid, profile, onGuardar, titulo, descripcion }) {
  const [datos, setDatos] = useState(() => {
    const inicial = {};
    CLAVES_COORDINADOR.forEach((c) => {
      inicial[c.clave] = profile.coordinadores?.[c.clave] || { nombre: "", email: "", telefono: "" };
    });
    return inicial;
  });
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState("");

  const cambiar = (clave, campo, valor) => {
    setDatos((prev) => ({ ...prev, [clave]: { ...prev[clave], [campo]: valor } }));
  };

  const guardar = async () => {
    setGuardando(true);
    setError("");
    try {
      await onGuardar(uid, datos);
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2000);
    } catch (err) {
      setError(err.message || "No se ha podido guardar.");
    }
    setGuardando(false);
  };

  return (
    <div className="cl-ticket">
      {titulo && <h2 className="cl-settings-title">{titulo}</h2>}
      {descripcion && <p className="cl-settings-desc">{descripcion}</p>}
      {CLAVES_COORDINADOR.map((c) => (
        <div key={c.clave} style={{ marginBottom: "16px", paddingBottom: "12px", borderBottom: "1px solid var(--line)" }}>
          <label className="cl-label">{c.label.toUpperCase()}</label>
          <div className="cl-row" style={{ flexWrap: "wrap" }}>
            <input
              className="cl-input"
              placeholder="Nombre y apellidos"
              value={datos[c.clave].nombre}
              onChange={(e) => cambiar(c.clave, "nombre", e.target.value)}
              maxLength={80}
              style={{ minWidth: "180px" }}
            />
            <input
              className="cl-input"
              placeholder="Email"
              value={datos[c.clave].email}
              onChange={(e) => cambiar(c.clave, "email", e.target.value)}
              maxLength={100}
              style={{ minWidth: "180px" }}
            />
            <input
              className="cl-input"
              placeholder="Teléfono"
              value={datos[c.clave].telefono}
              onChange={(e) => cambiar(c.clave, "telefono", e.target.value)}
              maxLength={20}
              style={{ minWidth: "140px" }}
            />
          </div>
        </div>
      ))}
      {error && <p style={{ color: "var(--clay)", fontSize: "12px", marginBottom: "8px" }}>{error}</p>}
      <button className="cl-btn cl-btn-primary" onClick={guardar} disabled={guardando}>
        <Save size={14} /> {guardando ? "Guardando..." : guardado ? "¡Guardado!" : "Guardar coordinadores"}
      </button>
    </div>
  );
}

function PanelLimpiarTemporada({ uid, titulo }) {
  const [confirmando, setConfirmando] = useState(false);
  const [limpiando, setLimpiando] = useState(false);
  const [resultado, setResultado] = useState("");
  const [error, setError] = useState("");

  const limpiar = async () => {
    setLimpiando(true);
    setError("");
    try {
      const n = await limpiarTemporada(uid);
      setResultado(`Hecho — ${n} hueco${n !== 1 ? "s" : ""} vuelto${n !== 1 ? "s" : ""} a "Disponible".`);
      setConfirmando(false);
    } catch (err) {
      setError(err.message || "No se ha podido limpiar.");
    }
    setLimpiando(false);
  };

  return (
    <div className="cl-ticket cl-ticket-danger" style={{ marginBottom: "12px" }}>
      {titulo && <h2 className="cl-settings-title">{titulo}</h2>}
      {!confirmando ? (
        <>
          <p style={{ fontSize: "13px", marginBottom: "10px" }}>
            Vuelve todos tus huecos a "Disponible" de golpe (incluidos los ya pactados o cerrados con otros clubes) —
            tus equipos, sus niveles y tu calendario de jornadas no se tocan. Pensado para empezar una temporada de cero.
          </p>
          <button className="cl-btn cl-btn-ghost" onClick={() => setConfirmando(true)}>
            Limpiar pre/postemporada
          </button>
        </>
      ) : (
        <>
          <p style={{ display: "flex", gap: "6px", fontSize: "13px", marginBottom: "8px", color: "var(--clay)" }}>
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: "1px" }} />
            <span>
              Esto rompe también cualquier partido ya pactado o cerrado con otros clubes, sin pedirles acuerdo —
              aunque a los clubes implicados les llegará un aviso automático de que su partido ha vuelto a estar
              libre (si tienen las notificaciones activadas). Si tienes partidos importantes en marcha, avísales
              también tú por WhatsApp para asegurarte. No se puede deshacer.
            </span>
          </p>
          <div className="cl-row">
            <button className="cl-btn cl-btn-ghost" onClick={() => setConfirmando(false)}>Cancelar</button>
            <button className="cl-btn cl-btn-danger" onClick={limpiar} disabled={limpiando}>
              {limpiando ? "Limpiando..." : "Sí, limpiar de verdad"}
            </button>
          </div>
        </>
      )}
      {resultado && <p style={{ color: "var(--pitch)", fontSize: "12px", marginTop: "8px" }}>{resultado}</p>}
      {error && <p style={{ color: "var(--clay)", fontSize: "12px", marginTop: "8px" }}>{error}</p>}
    </div>
  );
}

export default function AjustesView({ uid, profile, onGuardarContacto, onGuardarCoordinadores, onEscudoCambiado, onBorrarCuenta }) {
  const instalaciones = useInstalaciones(uid);
  const [nuevaInstalacion, setNuevaInstalacion] = useState("");
  const [nuevaDireccion, setNuevaDireccion] = useState("");
  const [enlaceCopiado, setEnlaceCopiado] = useState(false);
  const [errorInstalacion, setErrorInstalacion] = useState("");

  const añadirInstalacion = async () => {
    if (!nuevaInstalacion.trim()) return;
    setErrorInstalacion("");
    try {
      await addInstalacion(uid, nuevaInstalacion, nuevaDireccion);
      setNuevaInstalacion("");
      setNuevaDireccion("");
    } catch (err) {
      setErrorInstalacion(err.message || "No se ha podido añadir.");
    }
  };
  const [clubName, setClubName] = useState(profile.clubName);
  const [telefono, setTelefono] = useState(profile.telefono || "");
  const [emailContacto, setEmailContacto] = useState(profile.emailContacto || "");
  const clubesOficiales = useClubesOficiales();
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
      await onGuardarContacto({ clubName: clubName.trim(), telefono: telefono.trim(), emailContacto: emailContacto.trim() });
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
    <div>
      <div className="cl-settings-wrap">
        <div className="cl-ticket" style={{ background: "#EAF3EC", borderColor: "var(--pitch)" }}>
          <p style={{ fontSize: "13px" }}>
            <Download size={14} style={{ verticalAlign: "-2px" }} />{" "}
            <a href={`${window.location.pathname.replace(/\/$/, "")}/On-Juguem-Manual.pdf`} target="_blank" rel="noreferrer" download>
              <b>Descargar el manual completo de instrucciones (PDF)</b>
            </a>
          </p>
        </div>

        <section className="cl-settings-section">
          <div className="cl-ticket">
            <h2 className="cl-settings-title">{t("ajustes.datos_contacto")}</h2>
            <p className="cl-settings-desc">Estos datos identifican a tu club dentro de On Juguem.</p>
            <label className="cl-label">NOMBRE DEL CLUB</label>
            <select className="cl-input" value={clubName} onChange={(e) => setClubName(e.target.value)} style={{ marginBottom: "8px" }}>
              <option value={clubName}>{clubName}</option>
              {clubesOficiales
                .filter((c) => c.nombre !== clubName)
                .sort((a, b) => a.nombre.localeCompare(b.nombre))
                .map((c) => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
            </select>
            <label className="cl-label">TELÉFONO DEL CLUB</label>
            <input className="cl-input" value={telefono} onChange={(e) => setTelefono(e.target.value)} maxLength={LIMITES.telefono} style={{ marginBottom: "8px" }} />
            <label className="cl-label">CORREO DEL CLUB</label>
            <input className="cl-input" type="email" value={emailContacto} onChange={(e) => setEmailContacto(e.target.value)} maxLength={100} style={{ marginBottom: "8px" }} placeholder="Distinto del correo de acceso, si hace falta" />
            <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "8px" }}>
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
        </section>

        <section className="cl-settings-section">
          <PanelCoordinadores
            uid={uid}
            profile={profile}
            onGuardar={onGuardarCoordinadores}
            titulo={t("ajustes.coordinadores")}
            descripcion={'Rellena al menos el "Coordinador general" — si tenéis a alguien distinto por categoría, rellénalo también y se usará ese en vez del general para esa categoría. Los partidos de una categoría sin ningún contacto rellenado (ni específico ni general) no se pueden reservar ni aceptar.'}
          />
        </section>

        <section className="cl-settings-section">
        <div className="cl-ticket">
          <h2 className="cl-settings-title">{t("ajustes.instalaciones")}</h2>
          <p className="cl-settings-desc">
            Guarda aquí los campos que usáis habitualmente, para elegirlos rápido al cerrar un partido en vez de escribirlos cada vez.
          </p>
          <div className="cl-row" style={{ marginBottom: "10px", flexWrap: "wrap" }}>
            <input
              className="cl-input"
              placeholder="Nombre (ej. Camp Municipal Silla — pista 1)"
              value={nuevaInstalacion}
              onChange={(e) => setNuevaInstalacion(e.target.value)}
              maxLength={60}
            />
            <input
              className="cl-input"
              placeholder="Dirección"
              value={nuevaDireccion}
              onChange={(e) => setNuevaDireccion(e.target.value)}
              maxLength={100}
            />
            <button className="cl-btn cl-btn-primary" onClick={añadirInstalacion}><Plus size={14} /> Añadir</button>
          </div>
          {errorInstalacion && <p style={{ color: "var(--clay)", fontSize: "12px", marginBottom: "8px" }}>{errorInstalacion}</p>}
          {instalaciones.length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Todavía no has añadido ninguna.</p>
          ) : (
            instalaciones.map((i) => (
              <div key={i.id} className="cl-row" style={{ justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                <span style={{ fontSize: "13px" }}>{i.nombre}{i.direccion && <span style={{ color: "var(--text-secondary)" }}> · {i.direccion}</span>}</span>
                <button className="cl-btn cl-btn-ghost" style={{ padding: "2px 6px" }} onClick={() => deleteInstalacion(i.id)}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>
        </section>

        <section className="cl-settings-section">
          <PanelNotificaciones uid={uid} titulo={t("ajustes.notificaciones")} />
        </section>

        <section className="cl-settings-section">
          <PanelEscudo uid={uid} profile={profile} onEscudoCambiado={onEscudoCambiado} titulo={t("ajustes.escudo")} />
        </section>

        <section className="cl-settings-section">
        <div className="cl-ticket">
          <h2 className="cl-settings-title">{t("ajustes.enlace_publico")}</h2>
          <p className="cl-settings-desc">
            Compártelo con quien quieras (directiva, padres, otros clubes) — se ve sin necesitar cuenta, y nunca muestra teléfonos ni emails.
          </p>
          <div className="cl-row">
            <input className="cl-input" readOnly value={`${window.location.origin}${window.location.pathname}?publico=${uid}`} onClick={(e) => e.target.select()} />
            <button
              className="cl-btn cl-btn-primary"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?publico=${uid}`);
                setEnlaceCopiado(true);
                setTimeout(() => setEnlaceCopiado(false), 2000);
              }}
            >
              {enlaceCopiado ? "¡Copiado!" : "Copiar enlace"}
            </button>
          </div>
        </div>
        </section>

        <section className="cl-settings-section">
        <PanelLimpiarTemporada uid={uid} titulo={t("ajustes.zona_peligrosa")} />

        {!borrando ? (
          <div className="cl-ticket cl-ticket-danger">
            <p style={{ fontSize: "13px", marginBottom: "10px" }}>
              Borrar tu cuenta elimina de forma permanente tu club, tus equipos, tu calendario de jornadas y todos tus huecos publicados. No se puede deshacer.
            </p>
            <button className="cl-btn cl-btn-ghost" style={{ color: "var(--clay)", borderColor: "var(--danger-bg)" }} onClick={() => setBorrando(true)}>
              <Trash2 size={14} /> Borrar mi cuenta
            </button>
          </div>
        ) : (
          <div className="cl-ticket cl-ticket-danger">
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
              <button className="cl-btn cl-btn-danger" onClick={confirmarBorrado}>
                <Trash2 size={14} /> Confirmar borrado definitivo
              </button>
            </div>
            {errorBorrar && <p style={{ color: "var(--clay)", fontSize: "12px", marginTop: "6px" }}>{errorBorrar}</p>}
          </div>
        )}
        </section>
      </div>

      {verPolitica && <PoliticaPrivacidad onCerrar={() => setVerPolitica(false)} />}
    </div>
  );
}
