import { useState, useEffect } from "react";
import { t } from "../i18n";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { ShieldCheck, AlertTriangle, Check, Download, Plus, Trash2 } from "lucide-react";
import { useEstadoApp, cambiarMantenimiento } from "../hooks/useEstadoApp";
import { useTodosLosClubes } from "../hooks/useAuth";
import {
  useClubesOficiales,
  useSolicitudesClub,
  añadirClubOficial,
  eliminarClubOficial,
  importarClubesSemilla,
  marcarSolicitudAtendida,
} from "../hooks/useClubesOficiales";

function PanelGeocodificar() {
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState("");

  const procesarLote = async (lotesHechos = 0) => {
    setProcesando(true);
    setError("");
    try {
      const fn = httpsCallable(functions, "geocodificarLoteClubes");
      const r = await fn({ limite: 50 });
      setResultado(r.data);
      // Si quedan más, sigue solo automáticamente con el siguiente lote —
      // con un tope de seguridad para no encadenar de más si algo va raro
      // (con 357 clubes y 50 por lote, 10 lotes cubren de sobra hasta 500).
      if (r.data.restantes > 0 && lotesHechos < 10) {
        setTimeout(() => procesarLote(lotesHechos + 1), 500);
        return;
      }
    } catch (err) {
      setError(err.message || "No se ha podido geocodificar.");
    }
    setProcesando(false);
  };

  return (
    <div className="cl-ticket" style={{ marginBottom: "16px" }}>
      <p style={{ fontSize: "13px", fontWeight: 700, marginBottom: "6px" }}>Coordenadas de los clubes (para buscar por cercanía)</p>
      <p style={{ fontSize: "12px", color: "#64748B", marginBottom: "8px" }}>
        Convierte la localidad de cada club oficial en coordenadas de mapa, para poder ordenar Busco Rival por
        distancia real. Los clubes nuevos se geocodifican solos a partir de ahora — este botón es para poner al día
        los que ya estaban en la lista.
      </p>
      <button className="cl-btn cl-btn-primary" onClick={() => procesarLote()} disabled={procesando}>
        {procesando ? "Geocodificando..." : "Geocodificar clubes pendientes"}
      </button>
      {resultado && (
        <p style={{ fontSize: "12px", color: "var(--pitch)", marginTop: "6px" }}>
          Hecho este lote: {resultado.hechos} correctos, {resultado.fallidos} sin resultado. Quedan {resultado.restantes} por hacer.
          {resultado.restantes > 0 && procesando && " Siguiendo automáticamente..."}
        </p>
      )}
      {error && <p style={{ color: "var(--clay)", fontSize: "12px", marginTop: "6px" }}>{error}</p>}
    </div>
  );
}

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
      <p style={{ fontSize: "12px", color: "#64748B", marginBottom: "8px" }}>
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
      <p style={{ fontSize: "12px", color: "#64748B", marginBottom: "8px" }}>
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
      {error && <p style={{ color: "var(--clay)", fontSize: "12px" }}>{error}</p>}

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

      <h3 className="cl-display" style={{ fontSize: "18px", color: "var(--pitch-dark)", marginTop: "16px" }}>{t("ajustes.verificar_telefonos")}</h3>
      <p style={{ fontSize: "12px", color: "#64748B", marginBottom: "10px" }}>
        Un club no puede reservar ni ser reservado hasta que confirmes su teléfono a mano (llamada o WhatsApp) y le des el visto bueno aquí.
      </p>
      <div className="cl-ticket">
        {clubes.map((c) => (
          <div key={c.uid} className="cl-row" style={{ justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
            <div>
              <b>{c.clubName}</b>{" "}
              <span className="cl-mono" style={{ fontSize: "12px", color: "#64748B" }}>· {c.telefono} · {c.email}</span>
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

      <h3 className="cl-display" style={{ fontSize: "18px", color: "var(--pitch-dark)", marginTop: "16px" }}>{t("ajustes.lista_oficial")} ({clubesOficiales.length})</h3>
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
              <span style={{ fontSize: "13px" }}>{c.nombre} {c.localidad && <span style={{ color: "#64748B" }}>· {c.localidad}</span>}</span>
              <button className="cl-btn cl-btn-ghost" style={{ padding: "2px 6px" }} onClick={() => eliminarClubOficial(c.id)}><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminView({ onVerificar }) {
  return (
    <div>
      <h2 className="cl-display" style={{ fontSize: "24px", color: "var(--pitch-dark)", marginBottom: "16px" }}>
        <ShieldCheck size={20} style={{ verticalAlign: "-4px" }} /> ADMINISTRACIÓN
      </h2>
      <PanelGeocodificar />
      <PanelAvisoGlobal />
      <PanelMantenimiento />
      <PanelAdmin onVerificar={onVerificar} />
    </div>
  );
}
