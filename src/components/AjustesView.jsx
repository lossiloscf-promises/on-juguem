import { useState, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { Save, Trash2, Plus, ShieldCheck, AlertTriangle, Download, Check } from "lucide-react";
import PoliticaPrivacidad from "./PoliticaPrivacidad";
import { telefonoValido, LIMITES } from "../validaciones";
import { useInstalaciones, addInstalacion, deleteInstalacion } from "../hooks/useInstalaciones";
import { CLAVES_COORDINADOR } from "../constants";
import { subirEscudo, borrarEscudo } from "../hooks/useEscudo";
import { activarNotificaciones, notificacionesSoportadas } from "../hooks/useNotificaciones";
import { useEstadoApp, cambiarMantenimiento } from "../hooks/useEstadoApp";
import { limpiarTemporada } from "../hooks/useClubData";
import { useTodosLosClubes } from "../hooks/useAuth";
import {
  useClubesOficiales,
  useSolicitudesClub,
  añadirClubOficial,
  eliminarClubOficial,
  importarClubesSemilla,
  marcarSolicitudAtendida,
} from "../hooks/useClubesOficiales";

function PanelAvisoGlobal() {
  const [titulo, setTitulo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState("");
  const [error, setError] = useState("");

  const enviar = async () => {
    if (!titulo.trim() || !mensaje.trim()) {
      setError("Rellena título y mensaje.");
      return;
    }
    if (!window.confirm(`¿Enviar este aviso a TODOS los clubes de la plataforma?\n\n"${titulo}"\n${mensaje}`)) return;
    setEnviando(true);
    setError("");
    setResultado("");
    try {
      const fn = httpsCallable(functions, "enviarAvisoGlobal");
      const r = await fn({ titulo: titulo.trim(), cuerpo: mensaje.trim() });
      setResultado(`Enviado a ${r.data.enviados} de ${r.data.total} dispositivos.`);
      setTitulo("");
      setMensaje("");
    } catch (err) {
      setError(err.message || "No se ha podido enviar.");
    }
    setEnviando(false);
  };

  return (
    <div className="cl-ticket" style={{ marginBottom: "16px" }}>
      <p style={{ fontSize: "13px", fontWeight: 700, marginBottom: "6px" }}>Aviso a todos los clubes</p>
      <p style={{ fontSize: "12px", color: "#888", marginBottom: "8px" }}>
        Manda una notificación push a todos los dispositivos activados de la plataforma, sea cual sea su
        categoría — para avisos generales, novedades, o cuando termine el mantenimiento.
      </p>
      <input className="cl-input" placeholder="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={60} style={{ marginBottom: "6px" }} />
      <textarea className="cl-input" placeholder="Mensaje" value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={2} maxLength={200} style={{ marginBottom: "8px", width: "100%" }} />
      <button className="cl-btn cl-btn-primary" onClick={enviar} disabled={enviando}>
        {enviando ? "Enviando..." : "Enviar a todos"}
      </button>
      {resultado && <p style={{ color: "var(--pitch)", fontSize: "12px", marginTop: "6px" }}>{resultado}</p>}
      {error && <p style={{ color: "var(--clay)", fontSize: "12px", marginTop: "6px" }}>{error}</p>}
    </div>
  );
}

function PanelMantenimiento() {
  const estado = useEstadoApp();
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const activarBloqueo = async () => {
    setGuardando(true);
    setError("");
    try {
      await cambiarMantenimiento(true, mensaje.trim() || "Estamos mejorando la aplicación — en breves momentos podrás volver a utilizarla.");
    } catch (err) {
      setError(err.message || "No se ha podido activar.");
    }
    setGuardando(false);
  };

  const quitarBloqueo = async () => {
    setGuardando(true);
    setError("");
    try {
      await cambiarMantenimiento(false, "");
    } catch (err) {
      setError(err.message || "No se ha podido desactivar.");
    }
    setGuardando(false);
  };

  return (
    <div className="cl-ticket" style={{ borderColor: estado.mantenimiento ? "var(--clay)" : "var(--line)", marginBottom: "16px" }}>
      <p style={{ fontSize: "13px", fontWeight: 700, marginBottom: "6px" }}>
        Modo mantenimiento {estado.mantenimiento && <span style={{ color: "var(--clay)" }}>— ACTIVO AHORA MISMO</span>}
      </p>
      <p style={{ fontSize: "12px", color: "#888", marginBottom: "8px" }}>
        Mientras esté activo, nadie puede usar la app (ni siquiera entrar) — solo ven el mensaje que pongas
        aquí. Úsalo mientras arreglamos algo importante.
      </p>
      {!estado.mantenimiento ? (
        <>
          <textarea
            className="cl-input"
            placeholder="Mensaje a mostrar (opcional, hay uno por defecto)"
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            rows={2}
            style={{ marginBottom: "8px", width: "100%" }}
          />
          <button className="cl-btn" style={{ background: "var(--clay)", color: "white" }} onClick={activarBloqueo} disabled={guardando}>
            {guardando ? "Activando..." : "Activar modo mantenimiento"}
          </button>
        </>
      ) : (
        <button className="cl-btn cl-btn-primary" onClick={quitarBloqueo} disabled={guardando}>
          {guardando ? "Quitando..." : "Ya está arreglado — quitar bloqueo"}
        </button>
      )}
      {error && <p style={{ color: "var(--clay)", fontSize: "12px", marginTop: "6px" }}>{error}</p>}
    </div>
  );
}

function PanelAdmin({ onVerificar }) {
  const clubes = useTodosLosClubes();
  const clubesOficiales = useClubesOficiales();
  const solicitudes = useSolicitudesClub();
  const [error, setError] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevaLocalidad, setNuevaLocalidad] = useState("");
  const [importando, setImportando] = useState(false);
  const [avisoImport, setAvisoImport] = useState("");

  const cambiar = async (uidClub, valor) => {
    setError("");
    try {
      await onVerificar(uidClub, valor);
    } catch (err) {
      setError(err.message || "No se ha podido cambiar.");
    }
  };

  // Detectar posibles duplicados por nombre de club, para la alarma.
  const contador = {};
  clubes.forEach((c) => {
    const key = (c.clubNameLower || c.clubName || "").trim();
    if (!key) return;
    contador[key] = (contador[key] || 0) + 1;
  });
  const nombresDuplicados = new Set(Object.keys(contador).filter((k) => contador[k] > 1));
  const clubesDuplicados = clubes.filter((c) => nombresDuplicados.has((c.clubNameLower || c.clubName || "").trim()));

  const importar = async () => {
    setImportando(true);
    setAvisoImport("");
    try {
      const n = await importarClubesSemilla();
      setAvisoImport(`Importados ${n} clubes nuevos (los que ya existían no se han tocado).`);
    } catch (err) {
      setAvisoImport(err.message || "No se ha podido importar.");
    }
    setImportando(false);
  };

  const añadirManual = async () => {
    if (!nuevoNombre.trim()) return;
    setError("");
    try {
      await añadirClubOficial(nuevoNombre, nuevaLocalidad);
      setNuevoNombre("");
      setNuevaLocalidad("");
    } catch (err) {
      setError(err.message || "No se ha podido añadir.");
    }
  };

  const atenderSolicitud = async (s) => {
    setError("");
    try {
      await añadirClubOficial(s.nombreSolicitado, "");
      await marcarSolicitudAtendida(s.id);
    } catch (err) {
      setError(err.message || "No se ha podido procesar la solicitud.");
    }
  };

  return (
    <div>
      <h2 className="cl-display" style={{ fontSize: "22px", color: "var(--pitch-dark)" }}>
        <ShieldCheck size={18} style={{ verticalAlign: "-3px" }} /> ADMINISTRACIÓN
      </h2>
      {error && <p style={{ color: "var(--clay)", fontSize: "12px" }}>{error}</p>}

      <PanelAvisoGlobal />
      <PanelMantenimiento />

      {clubesDuplicados.length > 0 && (
        <div className="cl-ticket" style={{ borderColor: "var(--clay)", background: "#FDECEA" }}>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--clay)" }}>
            <AlertTriangle size={14} style={{ verticalAlign: "-2px" }} /> Nombres de club duplicados — revisar antes de verificar
          </p>
          {clubesDuplicados.map((c) => (
            <p key={c.uid} style={{ fontSize: "13px", marginTop: "4px" }}>
              <b>{c.clubName}</b> · {c.telefono} · {c.email} {c.verificado && "✅ ya verificado"}
            </p>
          ))}
        </div>
      )}

      <h3 className="cl-display" style={{ fontSize: "18px", color: "var(--pitch-dark)", marginTop: "16px" }}>VERIFICAR TELÉFONOS</h3>
      <p style={{ fontSize: "12px", color: "#888", marginBottom: "10px" }}>
        Un club no puede reservar ni ser reservado hasta que confirmes su teléfono a mano (llamada o WhatsApp) y le des el visto bueno aquí.
      </p>
      <div className="cl-ticket">
        {clubes.map((c) => (
          <div key={c.uid} className="cl-row" style={{ justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
            <div>
              <b>{c.clubName}</b>{" "}
              <span className="cl-mono" style={{ fontSize: "12px", color: "#888" }}>· {c.telefono} · {c.email}</span>
            </div>
            {c.verificado ? (
              <button className="cl-btn cl-btn-ghost" onClick={() => cambiar(c.uid, false)}>Quitar verificación</button>
            ) : (
              <button className="cl-btn cl-btn-primary" onClick={() => cambiar(c.uid, true)}>Verificar</button>
            )}
          </div>
        ))}
      </div>

      {solicitudes.length > 0 && (
        <>
          <h3 className="cl-display" style={{ fontSize: "18px", color: "var(--gold)", marginTop: "16px" }}>
            SOLICITUDES DE ALTA EN LA LISTA ({solicitudes.length})
          </h3>
          <div className="cl-ticket">
            {solicitudes.map((s) => (
              <div key={s.id} className="cl-row" style={{ justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                <span style={{ fontSize: "13px" }}><b>{s.nombreSolicitado}</b> · {s.telefono} · {s.email}</span>
                <button className="cl-btn cl-btn-primary" onClick={() => atenderSolicitud(s)}><Check size={13} /> Añadir a la lista</button>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 className="cl-display" style={{ fontSize: "18px", color: "var(--pitch-dark)", marginTop: "16px" }}>LISTA OFICIAL DE CLUBES ({clubesOficiales.length})</h3>
      <div className="cl-ticket">
        <button className="cl-btn cl-btn-gold" onClick={importar} disabled={importando} style={{ marginBottom: "8px" }}>
          <Download size={14} /> {importando ? "Importando..." : "Importar/actualizar lista base"}
        </button>
        {avisoImport && <p style={{ fontSize: "12px", color: "var(--pitch)", marginBottom: "8px" }}>{avisoImport}</p>}
        <div className="cl-row" style={{ marginBottom: "10px" }}>
          <input className="cl-input" placeholder="Nombre del club" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} maxLength={100} />
          <input className="cl-input" placeholder="Localidad (opcional)" value={nuevaLocalidad} onChange={(e) => setNuevaLocalidad(e.target.value)} style={{ maxWidth: "160px" }} />
          <button className="cl-btn cl-btn-primary" onClick={añadirManual}><Plus size={14} /> Añadir</button>
        </div>
        <div style={{ maxHeight: "200px", overflowY: "auto" }}>
          {clubesOficiales.map((c) => (
            <div key={c.id} className="cl-row" style={{ justifyContent: "space-between", padding: "3px 0" }}>
              <span style={{ fontSize: "13px" }}>{c.nombre} {c.localidad && <span style={{ color: "#888" }}>· {c.localidad}</span>}</span>
              <button className="cl-btn cl-btn-ghost" style={{ padding: "2px 6px" }} onClick={() => eliminarClubOficial(c.id)}><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PanelNotificaciones({ uid }) {
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
      <p style={{ fontSize: "13px", color: "#666", marginBottom: "8px" }}>
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
      {estado === "activado" && <p style={{ fontSize: "13px", color: "var(--pitch)" }}>✓ Notificaciones activadas en este dispositivo.</p>}
      {error && <p style={{ color: "var(--clay)", fontSize: "12px", marginTop: "6px" }}>{error}</p>}
    </div>
  );
}

function PanelEscudo({ uid, profile, onEscudoCambiado }) {
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
      <div className="cl-row" style={{ alignItems: "center" }}>
        {profile.escudoUrl ? (
          <img src={profile.escudoUrl} alt="Escudo del club" style={{ width: "64px", height: "64px", objectFit: "contain", borderRadius: "4px", border: "1px solid var(--line)" }} />
        ) : (
          <div style={{ width: "64px", height: "64px", borderRadius: "4px", border: "1px dashed var(--line)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "#888" }}>
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
      <p style={{ fontSize: "11px", color: "#888", marginTop: "6px" }}>Imagen cuadrada, máximo 2 MB. Se ve en el directorio de clubes y en el enlace público.</p>
      {error && <p style={{ color: "var(--clay)", fontSize: "12px", marginTop: "4px" }}>{error}</p>}
    </div>
  );
}

function PanelCoordinadores({ uid, profile, onGuardar }) {
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
      {CLAVES_COORDINADOR.map((c) => (
        <div key={c.clave} style={{ marginBottom: "14px", paddingBottom: "10px", borderBottom: "1px solid var(--line)" }}>
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

function PanelLimpiarTemporada({ uid }) {
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
    <div className="cl-ticket" style={{ borderColor: "var(--clay)", marginBottom: "12px" }}>
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
          <p style={{ fontSize: "13px", marginBottom: "8px", color: "var(--clay)" }}>
            ⚠️ Esto rompe también cualquier partido ya pactado o cerrado con otros clubes, sin pedirles acuerdo —
            aunque a los clubes implicados les llegará un aviso automático de que su partido ha vuelto a estar
            libre (si tienen las notificaciones activadas). Si tienes partidos importantes en marcha, avísales
            también tú por WhatsApp para asegurarte. No se puede deshacer.
          </p>
          <div className="cl-row">
            <button className="cl-btn cl-btn-ghost" onClick={() => setConfirmando(false)}>Cancelar</button>
            <button className="cl-btn" style={{ background: "var(--clay)", color: "white" }} onClick={limpiar} disabled={limpiando}>
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

export default function AjustesView({ uid, profile, onGuardarContacto, onGuardarCoordinadores, onEscudoCambiado, onBorrarCuenta, onVerificar }) {
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
      {profile.esAdmin && (
        <div style={{ marginBottom: "24px" }}>
          <PanelAdmin onVerificar={onVerificar} />
        </div>
      )}
      <div className="cl-grid-3">
      <div>
        <div className="cl-ticket" style={{ background: "#EAF3EC", borderColor: "var(--pitch)" }}>
          <p style={{ fontSize: "13px" }}>
            <Download size={14} style={{ verticalAlign: "-2px" }} />{" "}
            <a href={`${window.location.pathname.replace(/\/$/, "")}/On-Juguem-Manual.pdf`} target="_blank" rel="noreferrer" download>
              <b>Descargar el manual completo de instrucciones (PDF)</b>
            </a>
          </p>
        </div>

        <h2 className="cl-display" style={{ fontSize: "22px", color: "var(--pitch-dark)" }}>DATOS DE CONTACTO</h2>
        <div className="cl-ticket">
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

        <h2 className="cl-display" style={{ fontSize: "22px", color: "var(--pitch-dark)", marginTop: "20px" }}>NOTIFICACIONES</h2>
        <PanelNotificaciones uid={uid} />

        <h2 className="cl-display" style={{ fontSize: "22px", color: "var(--pitch-dark)", marginTop: "20px" }}>ESCUDO DEL CLUB</h2>
        <PanelEscudo uid={uid} profile={profile} onEscudoCambiado={onEscudoCambiado} />

        <h2 className="cl-display" style={{ fontSize: "22px", color: "var(--pitch-dark)", marginTop: "20px" }}>ENLACE PÚBLICO DE TU CUADRANTE</h2>
        <div className="cl-ticket">
          <p style={{ fontSize: "12px", color: "#888", marginBottom: "8px" }}>
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
      </div>

      <div>
        <h2 className="cl-display" style={{ fontSize: "22px", color: "var(--clay)" }}>ZONA PELIGROSA</h2>

        <PanelLimpiarTemporada uid={uid} />

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

        <h2 className="cl-display" style={{ fontSize: "22px", color: "var(--pitch-dark)", marginTop: "24px" }}>TUS INSTALACIONES</h2>
        <div className="cl-ticket">
          <p style={{ fontSize: "13px", color: "#888", marginBottom: "10px" }}>
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
            <p style={{ fontSize: "13px", color: "#888" }}>Todavía no has añadido ninguna.</p>
          ) : (
            instalaciones.map((i) => (
              <div key={i.id} className="cl-row" style={{ justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                <span style={{ fontSize: "13px" }}>{i.nombre}{i.direccion && <span style={{ color: "#888" }}> · {i.direccion}</span>}</span>
                <button className="cl-btn cl-btn-ghost" style={{ padding: "2px 6px" }} onClick={() => deleteInstalacion(i.id)}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>

        <h2 className="cl-display" style={{ fontSize: "22px", color: "var(--pitch-dark)", marginTop: "24px" }}>COORDINADORES DE CONTACTO</h2>
        <p style={{ fontSize: "12px", color: "#888", marginBottom: "10px" }}>
          Rellena al menos el "Coordinador general" — si tenéis a alguien distinto por categoría, rellénalo también y
          se usará ese en vez del general para esa categoría. Los partidos de una categoría sin ningún contacto
          rellenado (ni específico ni general) no se pueden reservar ni aceptar.
        </p>
        <PanelCoordinadores uid={uid} profile={profile} onGuardar={onGuardarCoordinadores} />
      </div>

      </div>

      {verPolitica && <PoliticaPrivacidad onCerrar={() => setVerPolitica(false)} />}
    </div>
  );
}
