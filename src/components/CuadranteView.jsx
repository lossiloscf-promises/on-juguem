import { useState, Fragment } from "react";
import ExcelJS from "exceljs";
import { Printer, FileSpreadsheet, Check, X, Home, Plane, History } from "lucide-react";
import { FASES, groupColor, compararEquipos, ORDEN_EDAD, ESTADO_INFO, COLOR_CANCELACION_PENDIENTE, HORARIOS_VALIDOS } from "../constants";
import { diaCoincideConJornada, tieneJornadaCoincidente } from "../validaciones";
import { useInstalaciones } from "../hooks/useInstalaciones";
import { redactarMensajeWhatsApp } from "../hooks/useIA";
import { t } from "../i18n";
import {
  requestBooking,
  rejectRequest,
  aceptarPartido,
  cerrarComoLocal,
  cerrarComoVisitante,
  proponerCancelacion,
  rechazarCancelacion,
  aceptarCancelacion,
  proponerSede,
  aceptarSede,
  rechazarSede,
  proponerCambioHorario,
  aceptarCambioHorario,
  rechazarCambioHorario,
  descartarAviso,
  hayConflictoDeHorario,
  setDisponibilidad,
  eliminarHuecoDeEquipo,
  useHistorialDeSlot,
} from "../hooks/useClubData";

function HistorialDelHueco({ slotId }) {
  const historial = useHistorialDeSlot(slotId);
  const [abierto, setAbierto] = useState(false);
  if (!slotId || historial.length === 0) return null;
  return (
    <div style={{ marginTop: "10px", borderTop: "1px dashed var(--line)", paddingTop: "8px" }}>
      <button className="cl-btn cl-btn-ghost" style={{ fontSize: "11px", padding: "3px 8px" }} onClick={() => setAbierto(!abierto)}>
        <History size={12} /> {abierto ? "Ocultar historial" : `Ver historial (${historial.length})`}
      </button>
      {abierto && (
        <ul style={{ fontSize: "11px", color: "#666", marginTop: "6px", paddingLeft: "16px" }}>
          {historial.map((h) => (
            <li key={h.id}>
              {h.quienClubName && <b>{h.quienClubName}: </b>}{h.accion}
              {h.timestamp && <span className="cl-mono"> · {new Date(h.timestamp.seconds * 1000).toLocaleString("es-ES")}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const CELL_BG = {
  vacio: "transparent",
  no_disponible: ESTADO_INFO.no_disponible.color,
  libre: ESTADO_INFO.libre.color,
  pendiente: ESTADO_INFO.pendiente.color,
  pactado: ESTADO_INFO.pactado.color,
  confirmado: ESTADO_INFO.confirmado.color,
};

function contenidoCelda(slot, modo) {
  if (!slot) return { texto: "", sub: "" };
  if (slot.status === "no_disponible") return { texto: "No disponible", sub: "" };
  if (slot.status === "libre") return { texto: modo === "ajeno" ? "Libre — pincha para pedirlo" : "Disponible", sub: "" };
  // En modo ajeno, cualquier hueco ya ocupado por otro club se ve sin datos, solo el estado.
  if (modo === "ajeno" && slot.status !== "libre") {
    const label = { pendiente: "Ocupado", pactado: "Ocupado", confirmado: "Ocupado" }[slot.status];
    return { texto: label, sub: "" };
  }
  if (slot.status === "pendiente") return { texto: slot.requestedByClubName, sub: "pendiente de aceptar — pincha" };
  if (slot.status === "pactado") {
    if (!slot.sede) return { texto: slot.requestedByClubName, sub: "falta decidir dónde se juega — pincha" };
    return { texto: slot.requestedByClubName, sub: slot.sede === "local" ? "falta cerrar día/hora — pincha" : "falta que el rival cierre" };
  }
  if (slot.status === "confirmado") {
    const icono = slot.sede === "local" ? "🏠" : "✈️";
    return { texto: `${icono} ${slot.requestedByClubName}`, sub: `${slot.diaExacto} ${slot.horaExacta} · ${slot.campoExacto}` };
  }
  return { texto: "", sub: "" };
}

// Formulario compacto para fijar día/hora/campo (reutilizado al cerrar en casa).
function FormularioCierreInline({ slot, allSlots, onConfirmar, uid }) {
  const instalaciones = useInstalaciones(uid);
  const [dia, setDia] = useState("");
  const [hora, setHora] = useState("");
  const [campo, setCampo] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const confirmar = async () => {
    if (!dia || !hora || !campo.trim()) return setError("Rellena día, hora y campo.");
    if (!diaCoincideConJornada(dia, slot.jornadaOrderDate)) {
      const seguir = window.confirm(
        `Esta jornada es "${slot.jornadaLabel}" y la fecha que has puesto no coincide con esas fechas — ¿seguro que es correcta?`
      );
      if (!seguir) return;
    }
    const conflicto = hayConflictoDeHorario(allSlots, { campoExacto: campo, diaExacto: dia, horaExacta: hora, grupo: slot.grupo }, slot.id);
    if (conflicto) return setError(`Ese campo ya tiene un partido a las ${conflicto.horaExacta}.`);
    setError("");
    setGuardando(true);
    try {
      await onConfirmar({ diaExacto: dia, horaExacta: hora, campoExacto: campo });
    } catch (err) {
      setError(err.message || "No se ha podido guardar.");
    }
    setGuardando(false);
  };

  return (
    <div className="cl-row" style={{ flexWrap: "wrap" }}>
      <input type="date" className="cl-input" style={{ width: "auto" }} value={dia} onChange={(e) => setDia(e.target.value)} />
      <select className="cl-input" style={{ width: "auto" }} value={hora} onChange={(e) => setHora(e.target.value)}>
        <option value="">Hora</option>
        {HORARIOS_VALIDOS.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      <input placeholder="Campo" className="cl-input" style={{ width: "auto" }} value={campo} onChange={(e) => setCampo(e.target.value)} maxLength={60} list="instalaciones-propio" />
      <datalist id="instalaciones-propio">
        {instalaciones.map((i) => <option key={i.id} value={i.nombre} />)}
      </datalist>
      <button className="cl-btn cl-btn-primary" onClick={confirmar} disabled={guardando}>
        {guardando ? "Comprobando..." : "Cerrar partido"}
      </button>
      {error && <p style={{ color: "var(--clay)", fontSize: "12px", width: "100%" }}>{error}</p>}
    </div>
  );
}

// Selector de "con cuál de mis equipos pido este hueco", con los de la misma
// edad primero (mismo grupo, uno por encima, uno por debajo).
function SelectorEquipoPropio({ grupoCelda, misEquipos, onElegir }) {
  const orden = ORDEN_EDAD;
  const idx = orden.indexOf(grupoCelda);
  const prioridad = [orden[idx], orden[idx - 1], orden[idx + 1]].filter(Boolean);
  const ordenados = [...misEquipos].sort((a, b) => {
    const pa = prioridad.indexOf(a.grupo), pb = prioridad.indexOf(b.grupo);
    const diff = (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
    return diff !== 0 ? diff : compararEquipos(a, b);
  });
  const [elegido, setElegido] = useState(ordenados[0]?.id || "");

  if (misEquipos.length === 0) {
    return <p style={{ fontSize: "12px", color: "#888" }}>Necesitas crear un equipo tuyo antes de poder pedir este hueco.</p>;
  }

  return (
    <div className="cl-row">
      <select className="cl-input" style={{ width: "auto" }} value={elegido} onChange={(e) => setElegido(e.target.value)}>
        {ordenados.map((t) => (
          <option key={t.id} value={t.id}>
            {t.grupo}{t.anyo ? ` (${t.anyo})` : ""} · {t.categoria} · {t.nivel}{t.identificador ? ` · ${t.identificador}` : ""}
          </option>
        ))}
      </select>
      <button className="cl-btn cl-btn-primary" onClick={() => onElegir(ordenados.find((t) => t.id === elegido))}>
        Pedir este hueco
      </button>
    </div>
  );
}

// Cómo se muestra una celda cuando lo que hay ahí es MI PROPIA negociación
// vista desde el otro lado (soy quien reservó, no el dueño del hueco) —
// se usa tanto si aparece superpuesta en mi propio cuadrante (porque el hueco
// real vive en el calendario de otro club) como si la veo entrando a "Busco
// rival" sobre ese mismo club.
function contenidoCeldaExterna(slot) {
  if (slot.status === "pendiente") return { texto: `Propuesta a ${slot.clubName}`, sub: "esperando respuesta — pincha" };
  if (slot.status === "pactado") {
    if (!slot.sede) return { texto: `Pactado con ${slot.clubName}`, sub: "esperando dónde se juega — pincha" };
    if (slot.sede === "visitante") return { texto: `Pactado con ${slot.clubName}`, sub: "tenéis que cerrar — pincha" };
    return { texto: `Pactado con ${slot.clubName}`, sub: "esperando que ellos cierren — pincha" };
  }
  if (slot.status === "confirmado") {
    const icono = slot.sede === "visitante" ? "🏠" : "✈️"; // sede='visitante' = juega en el campo de quien reservó (yo)
    return { texto: `${icono} Cerrado con ${slot.clubName}`, sub: `${slot.diaExacto} ${slot.horaExacta} · ${slot.campoExacto}` };
  }
  return { texto: "", sub: "" };
}

// Busca si un equipo mío tiene, en el calendario de OTRO club, un compromiso
// activo para una jornada con fecha parecida a la que se está pintando ahora
// mismo — así la celda de mi propio cuadrante puede reflejarlo en vez de
// seguir diciendo "disponible" cuando en realidad ya está ocupado fuera.
function buscarCompromisoExterno(allSlots, teamId, jornadaOrderDate, excluirId) {
  if (!jornadaOrderDate) return null;
  return (allSlots || []).find((s) => {
    if (s.id === excluirId) return false;
    if (s.requestedByTeamId !== teamId) return false;
    if (!["pendiente", "pactado", "confirmado"].includes(s.status)) return false;
    if (!s.jornadaOrderDate) return false;
    const diff = Math.abs((new Date(s.jornadaOrderDate) - new Date(jornadaOrderDate)) / (1000 * 60 * 60 * 24));
    return diff <= 4;
  }) || null;
}

// Construye un enlace que abre Google Calendar con el partido ya rellenado
// (título, fecha/hora, campo) — no hace falta ninguna cuenta ni permiso especial.
function enlaceGoogleCalendar(slot, miNombre, rivalNombre) {
  if (!slot.diaExacto || !slot.horaExacta) return null;
  const inicio = new Date(`${slot.diaExacto}T${slot.horaExacta}:00`);
  if (isNaN(inicio.getTime())) return null;
  const fin = new Date(inicio.getTime() + 90 * 60 * 1000); // 90 min de margen razonable
  const formatoFecha = (d) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Amistoso: ${miNombre} vs ${rivalNombre}`,
    dates: `${formatoFecha(inicio)}/${formatoFecha(fin)}`,
    location: slot.campoExacto || "",
    details: `Partido amistoso organizado a través de On Juguem.`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function BotonWhatsApp({ telefono, datosPartido }) {
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState("recordatorio");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  if (!telefono) return null;

  const generar = async () => {
    setCargando(true);
    setError("");
    try {
      const r = await redactarMensajeWhatsApp(tipo, datosPartido);
      setMensaje(r.mensaje);
    } catch (err) {
      setError(err.message || "No se ha podido redactar el mensaje.");
    }
    setCargando(false);
  };

  const telefonoLimpio = telefono.replace(/[^\d+]/g, "").replace(/^\+/, "");
  const enlace = `https://wa.me/${telefonoLimpio}?text=${encodeURIComponent(mensaje)}`;

  if (!abierto) {
    return (
      <button className="cl-btn cl-btn-ghost" style={{ marginTop: "6px" }} onClick={() => setAbierto(true)}>
        💬 WhatsApp
      </button>
    );
  }

  return (
    <div style={{ marginTop: "8px", background: "#EAF3EC", padding: "8px", borderRadius: "4px" }}>
      <select className="cl-input" value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ marginBottom: "6px" }}>
        <option value="primer_contacto">Primer contacto</option>
        <option value="recordatorio">Recordatorio</option>
        <option value="cambio_ultima_hora">Aviso de cambio</option>
        <option value="confirmacion">Confirmación</option>
      </select>
      <div className="cl-row">
        <button className="cl-btn cl-btn-gold" onClick={generar} disabled={cargando}>
          {cargando ? "Redactando..." : "✨ Redactar con IA"}
        </button>
        <button className="cl-btn cl-btn-ghost" onClick={() => setAbierto(false)}>Cerrar</button>
      </div>
      {error && <p style={{ color: "var(--clay)", fontSize: "12px", marginTop: "4px" }}>{error}</p>}
      {mensaje && (
        <>
          <textarea
            className="cl-input"
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            rows={4}
            style={{ marginTop: "6px", width: "100%" }}
          />
          <a href={enlace} target="_blank" rel="noreferrer" className="cl-btn cl-btn-primary" style={{ marginTop: "6px", display: "inline-flex" }}>
            Abrir WhatsApp
          </a>
        </>
      )}
    </div>
  );
}

export function GestionSede({ slot, uid, ejecutar }) {
  const soyDueño = uid === slot.ownerUid;
  const nombreOtraParte = soyDueño ? slot.requestedByClubName : slot.clubName;
  // 'local' = se juega en el campo del anfitrión (el dueño del hueco);
  // 'visitante' = se juega en el campo de quien reservó. La etiqueta que se
  // muestra depende de qué lado esté mirando.
  const etiqueta = (valor) => {
    if (soyDueño) return valor === "local" ? "en mi campo" : "en el suyo";
    return valor === "visitante" ? "en nuestro campo" : "en el suyo";
  };

  const propuestaPorMi = slot.sedePropuestaPor === uid;
  const propuestaPorElRival = slot.sedePropuestaPor && slot.sedePropuestaPor !== uid;

  if (propuestaPorMi) {
    return (
      <p style={{ fontSize: "12px", color: "#888", marginTop: "6px" }}>
        Has propuesto jugar {etiqueta(slot.sedePropuesta)} — esperando a que {nombreOtraParte} lo acepte.{" "}
        <a href="#" onClick={(e) => { e.preventDefault(); ejecutar(() => rechazarSede(slot.id)); }}>Retirar propuesta</a>
      </p>
    );
  }
  if (propuestaPorElRival) {
    return (
      <div style={{ marginTop: "6px", background: "#FBEFD9", padding: "8px", borderRadius: "4px" }}>
        <p style={{ fontSize: "13px" }}><b>{nombreOtraParte}</b> propone jugar {etiqueta(slot.sedePropuesta)}.</p>
        <div className="cl-row" style={{ marginTop: "4px" }}>
          <button className="cl-btn cl-btn-primary" onClick={() => ejecutar(() => aceptarSede(slot.id, slot.sedePropuesta))}>Aceptar</button>
          <button className="cl-btn cl-btn-ghost" onClick={() => ejecutar(() => rechazarSede(slot.id))}>Rechazar</button>
        </div>
      </div>
    );
  }
  return (
    <div className="cl-row" style={{ marginTop: "6px" }}>
      <button className="cl-btn cl-btn-gold" onClick={() => ejecutar(() => proponerSede(slot.id, "local"))}>
        <Home size={14} /> Proponer {etiqueta("local")}
      </button>
      <button className="cl-btn cl-btn-primary" onClick={() => ejecutar(() => proponerSede(slot.id, "visitante"))}>
        <Plane size={14} /> Proponer {etiqueta("visitante")}
      </button>
    </div>
  );
}

export function GestionCambioHorario({ slot, uid, ejecutar, allSlots }) {
  const [editando, setEditando] = useState(false);
  const [dia, setDia] = useState(slot.diaExacto || "");
  const [hora, setHora] = useState(slot.horaExacta || "");
  const [campo, setCampo] = useState(slot.campoExacto || "");
  const [error, setError] = useState("");

  const soyDueño = uid === slot.ownerUid;
  const nombreOtraParte = soyDueño ? slot.requestedByClubName : slot.clubName;
  const propuestaPorMi = slot.cambioPropuestoPor === uid;
  const propuestaPorElRival = slot.cambioPropuestoPor && slot.cambioPropuestoPor !== uid;

  if (propuestaPorMi) {
    return (
      <p style={{ fontSize: "12px", color: "#888", marginTop: "6px" }}>
        Has propuesto cambiar a {slot.cambioPropuesto?.diaExacto} {slot.cambioPropuesto?.horaExacta} en {slot.cambioPropuesto?.campoExacto} —
        esperando a que {nombreOtraParte} lo acepte.{" "}
        <a href="#" onClick={(e) => { e.preventDefault(); ejecutar(() => rechazarCambioHorario(slot.id)); }}>Retirar propuesta</a>
      </p>
    );
  }
  if (propuestaPorElRival) {
    return (
      <div style={{ marginTop: "6px", background: "#FBEFD9", padding: "8px", borderRadius: "4px" }}>
        <p style={{ fontSize: "13px" }}>
          <b>{nombreOtraParte}</b> propone cambiar a {slot.cambioPropuesto?.diaExacto} {slot.cambioPropuesto?.horaExacta} en {slot.cambioPropuesto?.campoExacto}
        </p>
        <div className="cl-row" style={{ marginTop: "4px" }}>
          <button className="cl-btn cl-btn-primary" onClick={() => ejecutar(() => aceptarCambioHorario(slot.id, slot.cambioPropuesto))}>Aceptar cambio</button>
          <button className="cl-btn cl-btn-ghost" onClick={() => ejecutar(() => rechazarCambioHorario(slot.id))}>Rechazar</button>
        </div>
      </div>
    );
  }
  if (!editando) {
    return (
      <button className="cl-btn cl-btn-ghost" style={{ marginTop: "6px" }} onClick={() => setEditando(true)}>
        Proponer cambiar día/hora/campo
      </button>
    );
  }
  return (
    <div className="cl-row" style={{ flexWrap: "wrap", marginTop: "6px" }}>
      <input type="date" className="cl-input" style={{ width: "auto" }} value={dia} onChange={(e) => setDia(e.target.value)} />
      <select className="cl-input" style={{ width: "auto" }} value={hora} onChange={(e) => setHora(e.target.value)}>
        <option value="">Hora</option>
        {HORARIOS_VALIDOS.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      <input placeholder="Campo" className="cl-input" style={{ width: "auto" }} value={campo} onChange={(e) => setCampo(e.target.value)} maxLength={60} />
      <button
        className="cl-btn cl-btn-primary"
        onClick={() => {
          if (!dia || !hora || !campo.trim()) { setError("Rellena día, hora y campo."); return; }
          const conflicto = hayConflictoDeHorario(allSlots, { campoExacto: campo, diaExacto: dia, horaExacta: hora, grupo: slot.grupo }, slot.id);
          if (conflicto) { setError(`Ese campo ya tiene un partido a las ${conflicto.horaExacta}.`); return; }
          setError("");
          ejecutar(() => proponerCambioHorario(slot.id, { diaExacto: dia, horaExacta: hora, campoExacto: campo }));
          setEditando(false);
        }}
      >
        Proponer
      </button>
      <button className="cl-btn cl-btn-ghost" onClick={() => setEditando(false)}>Cancelar</button>
      {error && <p style={{ color: "var(--clay)", fontSize: "12px", width: "100%" }}>{error}</p>}
    </div>
  );
}

export function GestionCancelacion({ slot, uid, ejecutar }) {
  const soyDueño = uid === slot.ownerUid;
  // El nombre de "la otra parte" depende de desde qué lado se mire: si soy el
  // dueño del hueco, la otra parte es quien reservó; si soy quien reservó, la
  // otra parte es el dueño (dato que también llevamos guardado en el hueco).
  const nombreOtraParte = soyDueño ? slot.requestedByClubName : slot.clubName;

  const propuestaPorMi = slot.cancelacionPropuestaPor === uid;
  const propuestaPorElRival = slot.cancelacionPropuestaPor && slot.cancelacionPropuestaPor !== uid;

  if (propuestaPorMi) {
    return (
      <div style={{ marginTop: "8px" }}>
        <p style={{ fontSize: "12px", color: "#888" }}>Has propuesto cancelar — esperando a que {nombreOtraParte || "la otra parte"} lo acepte o lo rechace.</p>
        <button className="cl-btn cl-btn-ghost" onClick={() => ejecutar(() => rechazarCancelacion(slot.id))}>
          Retirar mi propuesta
        </button>
      </div>
    );
  }
  if (propuestaPorElRival) {
    return (
      <div style={{ marginTop: "8px", background: "#FBEFD9", padding: "8px", borderRadius: "4px" }}>
        <p style={{ fontSize: "13px" }}><b>{nombreOtraParte}</b> ha propuesto cancelar este partido.</p>
        <div className="cl-row" style={{ marginTop: "6px" }}>
          <button className="cl-btn cl-btn-primary" onClick={() => ejecutar(() => aceptarCancelacion(slot.id))}>
            <Check size={13} /> Aceptar cancelación
          </button>
          <button className="cl-btn cl-btn-ghost" onClick={() => ejecutar(() => rechazarCancelacion(slot.id))}>
            <X size={13} /> Rechazar
          </button>
        </div>
      </div>
    );
  }
  return (
    <button
      className="cl-btn cl-btn-ghost"
      style={{ marginTop: "8px" }}
      onClick={() => {
        if (window.confirm(`Vas a proponer cancelar este partido con ${nombreOtraParte || "el rival"}. Tendrá que aceptarlo para que se libere. ¿Seguro?`)) {
          ejecutar(() => proponerCancelacion(slot.id));
        }
      }}
    >
      <X size={13} /> Proponer cancelar este partido
    </button>
  );
}
export default function CuadranteView({
  clubName, teams, slots, jornadas,
  modo = "propio", allSlots, misEquipos, misJornadas, uid, misClubName, telefono, email, puedeReservar = true,
}) {
  const [celdaAbierta, setCeldaAbierta] = useState(null);
  const [error, setError] = useState("");
  const slotDe = (teamId, jornadaId) => slots.find((s) => s.teamId === teamId && s.jornadaId === jornadaId);
  // Mismo orden para la cabecera y para las celdas: agrupado por fase (en el
  // orden de FASES) y, dentro de cada fase, por fecha (jornadas ya viene
  // ordenado por fecha desde el hook, así que solo hace falta agrupar).
  const jornadasOrdenadas = FASES.flatMap((fase) => jornadas.filter((j) => j.fase === fase));

  // Envuelve cualquier acción directa (sin formulario) para que, si falla,
  // se vea el motivo en pantalla en vez de quedarse callado.
  const ejecutar = async (fn) => {
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err.message || "No se ha podido completar la acción. Inténtalo de nuevo.");
    }
  };

  const argb = (hex) => "FF" + hex.replace("#", "").toUpperCase();

  const exportarExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "On Juguem";
    const sheet = workbook.addWorksheet("Cuadrante", { views: [{ state: "frozen", ySplit: 3 }] });

    const numCols = jornadas.length + 1;

    // Título
    sheet.mergeCells(1, 1, 1, numCols);
    const tituloCell = sheet.getCell(1, 1);
    tituloCell.value = `CUADRANTE · ${clubName}`;
    tituloCell.font = { bold: true, size: 16, color: { argb: argb("#16302B") } };
    tituloCell.alignment = { vertical: "middle" };
    sheet.getRow(1).height = 26;

    sheet.mergeCells(2, 1, 2, numCols);
    const fechaCell = sheet.getCell(2, 1);
    fechaCell.value = `Exportado el ${new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}`;
    fechaCell.font = { italic: true, size: 10, color: { argb: argb("#666666") } };

    // Cabecera
    const headerRow = sheet.getRow(3);
    headerRow.getCell(1).value = "Equipo";
    jornadasOrdenadas.forEach((j, i) => { headerRow.getCell(i + 2).value = j.label; });
    headerRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb("#16302B") } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = { bottom: { style: "thin", color: { argb: "FFFFFFFF" } } };
    });
    headerRow.height = 20;

    // Filas de datos
    [...teams].sort(compararEquipos).forEach((t) => {
      const row = sheet.addRow([]);
      const equipoCell = row.getCell(1);
      equipoCell.value = `${t.grupo}${t.anyo ? " (" + t.anyo + ")" : ""} · ${t.categoria} · ${t.nivel}${t.identificador ? " · " + t.identificador : ""}`;
      equipoCell.font = { bold: true, size: 11 };
      equipoCell.alignment = { vertical: "middle", wrapText: true };

      jornadasOrdenadas.forEach((j, i) => {
        const local = slotDe(t.id, j.id);
        const externo = modo === "propio" ? buscarCompromisoExterno(allSlots, t.id, j.orderDate, local?.id) : null;
        const s = externo || local;
        const c = s ? (externo ? contenidoCeldaExterna(externo) : contenidoCelda(local, modo)) : { texto: "", sub: "" };
        const cell = row.getCell(i + 2);
        cell.value = c.texto + (c.sub ? `\n${c.sub}` : "");
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        const colorFondo = s?.cancelacionPropuestaPor
          ? COLOR_CANCELACION_PENDIENTE
          : ESTADO_INFO[s?.status]?.color || "#FFFFFF";
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(colorFondo) } };
        cell.border = { top: { style: "thin", color: { argb: "FFDDDDDD" } }, bottom: { style: "thin", color: { argb: "FFDDDDDD" } } };
      });
      row.height = 32;
    });

    // Anchos de columna automáticos según el contenido más largo
    sheet.getColumn(1).width = 32;
    jornadasOrdenadas.forEach((j, i) => {
      sheet.getColumn(i + 2).width = Math.max(16, j.label.length + 4);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cuadrante-${clubName.replace(/\s+/g, "-")}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const imprimir = () => window.print();

  const puedeExpandir = (s) => {
    if (modo === "ajeno") return s?.status === "libre";
    // propio: siempre se puede tocar (marcar disponibilidad si no hay nada,
    // o gestionar la solicitud/cierre/cancelación si ya hay algo en marcha)
    return !s || ["libre", "no_disponible", "pendiente", "pactado", "confirmado"].includes(s.status);
  };

  return (
    <div>
      {modo === "propio" && (
        <>
          <div className="cl-row no-print" style={{ justifyContent: "space-between", marginBottom: "16px" }}>
            <h2 className="cl-display" style={{ fontSize: "22px", color: "var(--pitch-dark)" }}>{t("cuadrante.titulo")} · {clubName}</h2>
            <div className="cl-row">
              <button className="cl-btn cl-btn-primary" onClick={imprimir}><Printer size={14} /> {t("cuadrante.exportar_pdf")}</button>
              <button className="cl-btn cl-btn-gold" onClick={exportarExcel}><FileSpreadsheet size={14} /> {t("cuadrante.exportar_excel")}</button>
            </div>
          </div>
          <h2 className="cl-display cl-print-title" style={{ display: "none" }}>{t("cuadrante.titulo")} · {clubName}</h2>
        </>
      )}
      {modo === "ajeno" && (
        <h2 className="cl-display" style={{ fontSize: "22px", color: "var(--pitch-dark)", marginBottom: "12px" }}>{clubName}</h2>
      )}

      {error && (
        <p className="cl-ticket" style={{ color: "var(--clay)", borderColor: "var(--clay)", fontSize: "13px" }}>{error}</p>
      )}

      {teams.length === 0 || jornadas.length === 0 ? (
        <p className="cl-ticket" style={{ textAlign: "center", color: "#888" }}>
          {modo === "ajeno" ? "Este club todavía no tiene equipos o jornadas publicadas." : "Necesitas al menos un equipo y una jornada creada para ver el cuadrante."}
        </p>
      ) : (
        <div className="cl-ticket" style={{ overflowX: "auto" }}>
          <table className="cl-table" style={{ minWidth: "700px" }}>
            <thead>
              <tr>
                <th style={{ position: "sticky", left: 0, background: "white" }}>{t("cuadrante.equipo")}</th>
                {jornadasOrdenadas.map((j) => <th key={j.id}>{j.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {[...teams].sort(compararEquipos).map((t) => (
                <Fragment key={t.id}>
                  <tr key={t.id}>
                    <td style={{ position: "sticky", left: 0, background: "white", minWidth: "180px" }}>
                      <div className="cl-row">
                        <span style={{ width: "4px", height: "14px", background: groupColor(t.grupo), display: "inline-block" }} />
                        <div>
                          <div style={{ fontWeight: 700 }}>{t.grupo}{t.anyo ? ` (${t.anyo})` : ""}{t.identificador ? ` ${t.identificador}` : ""}</div>
                          <div className="cl-mono" style={{ fontSize: "11px", color: "#888" }}>{t.genero} · {t.categoria} · {t.nivel}</div>
                        </div>
                      </div>
                    </td>
                    {jornadasOrdenadas.map((j) => {
                      const local = slotDe(t.id, j.id);
                      // En mi propio cuadrante, si este equipo tiene un compromiso activo
                      // en el calendario de OTRO club para una fecha parecida, ese
                      // compromiso "manda" sobre lo que diga mi propio hueco local.
                      const externo = modo === "propio" ? buscarCompromisoExterno(allSlots, t.id, j.orderDate, local?.id) : null;
                      // En modo ajeno, si el hueco ya es mío (yo lo reservé), se ve con
                      // todo el detalle en vez de anonimizado como "Ocupado".
                      const esMiNegociacionAjena = modo === "ajeno" && local?.requestedByUid === uid;
                      const esVistaExterna = !!externo || esMiNegociacionAjena;
                      const s = externo || local;
                      const c = esVistaExterna ? contenidoCeldaExterna(s) : contenidoCelda(local, modo);
                      const clicable = esVistaExterna || puedeExpandir(local) || (modo === "ajeno" && local?.status === "libre");
                      const activa = celdaAbierta === `${t.id}:${j.id}`;
                      const hayCancelacionPendiente = s?.cancelacionPropuestaPor;
                      const hayCambioPendiente = s?.cambioPropuestoPor;
                      const haySedePendiente = s?.sedePropuestaPor;
                      return (
                        <td
                          key={j.id}
                          onClick={() => clicable && setCeldaAbierta(activa ? null : `${t.id}:${j.id}`)}
                          style={{
                            background: hayCancelacionPendiente ? COLOR_CANCELACION_PENDIENTE : CELL_BG[s?.status || "vacio"],
                            textAlign: "center",
                            cursor: clicable ? "pointer" : "default",
                            outline: activa ? "2px solid var(--pitch)" : hayCancelacionPendiente ? "2px solid var(--clay)" : "none",
                          }}
                        >
                          {hayCancelacionPendiente && (
                            <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--clay)" }}>⚠️ CANCELACIÓN</div>
                          )}
                          {!hayCancelacionPendiente && hayCambioPendiente && (
                            <div style={{ fontSize: "10px", fontWeight: 700, color: "#8B5CF6" }}>🕓 CAMBIO PROPUESTO</div>
                          )}
                          {!hayCancelacionPendiente && !hayCambioPendiente && haySedePendiente && (
                            <div style={{ fontSize: "10px", fontWeight: 700, color: "#8B5CF6" }}>📍 SEDE PROPUESTA</div>
                          )}
                          <div style={{ fontSize: "12px", fontWeight: c.texto ? 600 : 400 }}>{c.texto}</div>
                          {c.sub && <div className="cl-mono" style={{ fontSize: "10px", color: "#666" }}>{c.sub}</div>}
                        </td>
                      );
                    })}
                  </tr>
                  {jornadasOrdenadas.map((j) => {
                    if (celdaAbierta !== `${t.id}:${j.id}`) return null;
                    const local = slotDe(t.id, j.id);
                    const externo = modo === "propio" ? buscarCompromisoExterno(allSlots, t.id, j.orderDate, local?.id) : null;
                    const esMiNegociacionAjena = modo === "ajeno" && local?.requestedByUid === uid;
                    const esVistaExterna = !!externo || esMiNegociacionAjena;
                    const s = externo || local;
                    return (
                      <tr key={`${t.id}:${j.id}:panel`}>
                        <td colSpan={jornadas.length + 1} style={{ background: "#FAFAF7", padding: "10px" }}>
                          {!esVistaExterna && modo === "propio" && (!local || ["libre", "no_disponible"].includes(local.status)) && (
                            <div className="cl-row">
                              <button
                                className="cl-btn"
                                style={{ background: local?.status === "libre" ? "var(--pitch)" : "transparent", color: local?.status === "libre" ? "white" : "var(--pitch)", border: "1.5px solid var(--pitch)" }}
                                onClick={() => ejecutar(async () => { await setDisponibilidad(uid, t, j, true); setCeldaAbierta(null); })}
                              >
                                Marcar disponible
                              </button>
                              <button
                                className="cl-btn"
                                style={{ background: local?.status === "no_disponible" ? "#999" : "transparent", color: local?.status === "no_disponible" ? "white" : "#999", border: "1.5px solid #999" }}
                                onClick={() => ejecutar(async () => { await setDisponibilidad(uid, t, j, false); setCeldaAbierta(null); })}
                              >
                                Marcar no disponible
                              </button>
                              {local && (
                                <button
                                  className="cl-btn cl-btn-ghost"
                                  onClick={() => {
                                    if (window.confirm(`¿Quitar la jornada "${j.label}" del equipo ${t.grupo}${t.identificador ? " " + t.identificador : ""}? Este equipo no participará esa fecha (queda vacía, puedes volver a activarla cuando quieras).`)) {
                                      ejecutar(async () => { await eliminarHuecoDeEquipo(uid, t.id, j.id, local.status); setCeldaAbierta(null); });
                                    }
                                  }}
                                >
                                  Este equipo no participa esta jornada
                                </button>
                              )}
                            </div>
                          )}
                          {!esVistaExterna && modo === "propio" && local?.status === "pendiente" && (
                            <div className="cl-row" style={{ flexWrap: "wrap" }}>
                              <span style={{ fontSize: "13px" }}>
                                <b>{local.requestedByClubName}</b> quiere reservar este hueco
                                {(local.requestedByTelefono || local.requestedByEmail) && (
                                  <> · {local.requestedByTelefono} {local.requestedByEmail}</>
                                )}
                              </span>
                              <button className="cl-btn cl-btn-ghost" onClick={() => ejecutar(() => rejectRequest(local.id))}><X size={14} /> Rechazar</button>
                              <button className="cl-btn cl-btn-primary" onClick={() => ejecutar(() => aceptarPartido(local.id))}><Check size={14} /> Aceptar</button>
                              <BotonWhatsApp telefono={local.requestedByTelefono} datosPartido={{ miClub: clubName, rivalClub: local.requestedByClubName, grupo: local.grupo, jornada: local.jornadaLabel }} />
                            </div>
                          )}
                          {!esVistaExterna && modo === "propio" && local?.status === "pactado" && !local.sede && (
                            <div>
                              <p style={{ fontSize: "13px" }}>Pactado con <b>{local.requestedByClubName}</b> — ¿dónde se juega?</p>
                              <GestionSede slot={local} uid={uid} ejecutar={ejecutar} />
                              <GestionCancelacion slot={local} uid={uid} ejecutar={ejecutar} />
                              <BotonWhatsApp telefono={local.requestedByTelefono} datosPartido={{ miClub: clubName, rivalClub: local.requestedByClubName, grupo: local.grupo, jornada: local.jornadaLabel }} />
                            </div>
                          )}
                          {!esVistaExterna && modo === "propio" && local?.status === "pactado" && local.sede === "local" && (
                            <>
                              <FormularioCierreInline
                                slot={local}
                                allSlots={allSlots}
                                uid={uid}
                                onConfirmar={(datos) => cerrarComoLocal(local.id, { ...datos, grupo: local.grupo, teamId: local.teamId }, allSlots)}
                              />
                              <GestionSede slot={local} uid={uid} ejecutar={ejecutar} />
                              <GestionCancelacion slot={local} uid={uid} ejecutar={ejecutar} />
                              <BotonWhatsApp telefono={local.requestedByTelefono} datosPartido={{ miClub: clubName, rivalClub: local.requestedByClubName, grupo: local.grupo, jornada: local.jornadaLabel, sede: "en vuestro campo" }} />
                            </>
                          )}
                          {!esVistaExterna && modo === "propio" && local?.status === "pactado" && local.sede === "visitante" && (
                            <div>
                              <p style={{ fontSize: "13px", color: "#666" }}>
                                Pactado contra <b>{local.requestedByClubName}</b> — falta que ellos cierren día/hora/campo
                                (juegan en su campo, así que lo deciden ellos).
                              </p>
                              <GestionSede slot={local} uid={uid} ejecutar={ejecutar} />
                              <GestionCancelacion slot={local} uid={uid} ejecutar={ejecutar} />
                              <BotonWhatsApp telefono={local.requestedByTelefono} datosPartido={{ miClub: clubName, rivalClub: local.requestedByClubName, grupo: local.grupo, jornada: local.jornadaLabel, sede: "en su campo" }} />
                            </div>
                          )}
                          {!esVistaExterna && modo === "propio" && local?.status === "confirmado" && (
                            <>
                              {enlaceGoogleCalendar(local, clubName, local.requestedByClubName) && (
                                <a
                                  href={enlaceGoogleCalendar(local, clubName, local.requestedByClubName)}
                                  target="_blank" rel="noreferrer"
                                  className="cl-btn cl-btn-ghost"
                                  style={{ marginBottom: "6px", display: "inline-flex" }}
                                >
                                  📅 Añadir a Google Calendar
                                </a>
                              )}
                              <GestionCambioHorario slot={local} uid={uid} ejecutar={ejecutar} allSlots={allSlots} />
                              <GestionCancelacion slot={local} uid={uid} ejecutar={ejecutar} />
                              <BotonWhatsApp
                                telefono={local.requestedByTelefono}
                                datosPartido={{ miClub: clubName, rivalClub: local.requestedByClubName, grupo: local.grupo, dia: local.diaExacto, hora: local.horaExacta, campo: local.campoExacto }}
                              />
                            </>
                          )}
                          {!esVistaExterna && modo === "propio" && local?.avisoEquipoBorrado && (
                            <div style={{ marginTop: "8px", background: "#FDECEA", padding: "8px", borderRadius: "4px" }}>
                              <p style={{ fontSize: "13px" }}>⚠️ {local.avisoTexto}</p>
                              <button className="cl-btn cl-btn-ghost" onClick={() => ejecutar(() => descartarAviso(local.id))}>
                                Entendido
                              </button>
                            </div>
                          )}

                          {/* Mi propia negociación como quien reservó — venga superpuesta en mi
                              propio cuadrante, o vista entrando en "Busco rival" sobre ese club. */}
                          {esVistaExterna && s.status === "pendiente" && (
                            <div>
                              <p style={{ fontSize: "13px", color: "#666" }}>
                                Solicitud enviada a <b>{s.clubName}</b> — esperando a que acepten o rechacen.
                              </p>
                              <BotonWhatsApp telefono={s.ownerTelefono} datosPartido={{ miClub: misClubName, rivalClub: s.clubName, grupo: s.grupo, jornada: s.jornadaLabel }} />
                            </div>
                          )}
                          {esVistaExterna && s.status === "pactado" && !s.sede && (
                            <div>
                              <p style={{ fontSize: "13px" }}>Pactado con <b>{s.clubName}</b> — ¿dónde se juega?</p>
                              <GestionSede slot={s} uid={uid} ejecutar={ejecutar} />
                              <GestionCancelacion slot={s} uid={uid} ejecutar={ejecutar} />
                              <BotonWhatsApp telefono={s.ownerTelefono} datosPartido={{ miClub: misClubName, rivalClub: s.clubName, grupo: s.grupo, jornada: s.jornadaLabel }} />
                            </div>
                          )}
                          {esVistaExterna && s.status === "pactado" && s.sede === "visitante" && (
                            <>
                              <p style={{ fontSize: "13px", color: "#666" }}>Se decidió jugar en vuestro campo — cerrad día, hora y campo.</p>
                              <FormularioCierreInline
                                slot={s}
                                allSlots={allSlots}
                                uid={uid}
                                onConfirmar={(datos) => cerrarComoVisitante(s.id, { ...datos, grupo: s.grupo, teamId: s.teamId }, allSlots)}
                              />
                              <GestionSede slot={s} uid={uid} ejecutar={ejecutar} />
                              <GestionCancelacion slot={s} uid={uid} ejecutar={ejecutar} />
                              <BotonWhatsApp telefono={s.ownerTelefono} datosPartido={{ miClub: misClubName, rivalClub: s.clubName, grupo: s.grupo, jornada: s.jornadaLabel, sede: "en vuestro campo" }} />
                            </>
                          )}
                          {esVistaExterna && s.status === "pactado" && s.sede === "local" && (
                            <div>
                              <p style={{ fontSize: "13px", color: "#666" }}>
                                Pactado con <b>{s.clubName}</b> — juega en su campo, falta que ellos cierren día/hora/campo.
                              </p>
                              <GestionSede slot={s} uid={uid} ejecutar={ejecutar} />
                              <GestionCancelacion slot={s} uid={uid} ejecutar={ejecutar} />
                              <BotonWhatsApp telefono={s.ownerTelefono} datosPartido={{ miClub: misClubName, rivalClub: s.clubName, grupo: s.grupo, jornada: s.jornadaLabel, sede: "en su campo" }} />
                            </div>
                          )}
                          {esVistaExterna && s.status === "confirmado" && (
                            <div>
                              <p style={{ fontSize: "13px", color: "#666" }}>
                                Cerrado con <b>{s.clubName}</b> · {s.diaExacto} {s.horaExacta} · {s.campoExacto}
                              </p>
                              {enlaceGoogleCalendar(s, misClubName, s.clubName) && (
                                <a
                                  href={enlaceGoogleCalendar(s, misClubName, s.clubName)}
                                  target="_blank" rel="noreferrer"
                                  className="cl-btn cl-btn-ghost"
                                  style={{ marginBottom: "6px", display: "inline-flex" }}
                                >
                                  📅 Añadir a Google Calendar
                                </a>
                              )}
                              <GestionCambioHorario slot={s} uid={uid} ejecutar={ejecutar} allSlots={allSlots} />
                              <GestionCancelacion slot={s} uid={uid} ejecutar={ejecutar} />
                              <BotonWhatsApp
                                telefono={s.ownerTelefono}
                                datosPartido={{ miClub: misClubName, rivalClub: s.clubName, grupo: s.grupo, dia: s.diaExacto, hora: s.horaExacta, campo: s.campoExacto }}
                              />
                            </div>
                          )}

                          {modo === "ajeno" && !esVistaExterna && local?.status === "libre" && (
                            !puedeReservar ? (
                              <p style={{ fontSize: "12px", color: "var(--clay)" }}>
                                No puedes reservar todavía — tu club o este todavía no está verificado por un administrador.
                              </p>
                            ) : tieneJornadaCoincidente(misJornadas, j.orderDate) ? (
                              <SelectorEquipoPropio
                                grupoCelda={t.grupo}
                                misEquipos={misEquipos || []}
                                onElegir={(miEquipo) => ejecutar(async () => {
                                  await requestBooking(local.id, uid, misClubName, telefono, email, miEquipo?.id);
                                  setCeldaAbierta(null);
                                })}
                              />
                            ) : (
                              <p style={{ fontSize: "12px", color: "var(--clay)" }}>
                                No tienes esta fecha ({j.label}) en tu propio calendario de Pre/Post temporada — créala
                                ahí primero para poder reservar este hueco.
                              </p>
                            )
                          )}
                          {s && <HistorialDelHueco slotId={s.id} />}
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
