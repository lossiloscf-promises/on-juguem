import { useState, Fragment } from "react";
import * as XLSX from "xlsx";
import { Printer, FileSpreadsheet, Check, X, Home, Plane, History } from "lucide-react";
import { FASES, groupColor, compararEquipos, ORDEN_EDAD, ESTADO_INFO, COLOR_CANCELACION_PENDIENTE } from "../constants";
import { diaCoincideConJornada, tieneJornadaCoincidente } from "../validaciones";
import { useInstalaciones } from "../hooks/useInstalaciones";
import {
  requestBooking,
  rejectRequest,
  aceptarPartido,
  decidirJugarEnCasa,
  decidirJugarFuera,
  cerrarComoLocal,
  cerrarComoVisitante,
  proponerCancelacion,
  rechazarCancelacion,
  aceptarCancelacion,
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
  if (slot.status === "confirmado") return { texto: slot.requestedByClubName, sub: `${slot.diaExacto} ${slot.horaExacta} · ${slot.campoExacto}` };
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
    if (conflicto) return setError(`Ese campo ya tiene un partido a las ${conflicto.horaExacta} (deja 10 min de descanso).`);
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
      <input type="time" className="cl-input" style={{ width: "auto" }} value={hora} onChange={(e) => setHora(e.target.value)} />
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
  if (slot.status === "confirmado") return { texto: `Cerrado con ${slot.clubName}`, sub: `${slot.diaExacto} ${slot.horaExacta} · ${slot.campoExacto}` };
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

  const exportarExcel = () => {
    const datos = [...teams].sort(compararEquipos).map((t) => {
      const fila = { Equipo: `${t.grupo}${t.anyo ? " (" + t.anyo + ")" : ""} · ${t.categoria} · ${t.nivel}${t.identificador ? " · " + t.identificador : ""}` };
      jornadas.forEach((j) => {
        const local = slotDe(t.id, j.id);
        const externo = modo === "propio" ? buscarCompromisoExterno(allSlots, t.id, j.orderDate, local?.id) : null;
        const c = externo ? contenidoCeldaExterna(externo) : contenidoCelda(local, modo);
        fila[j.label] = c.texto + (c.sub ? ` (${c.sub})` : "");
      });
      return fila;
    });
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cuadrante");
    XLSX.writeFile(wb, `cuadrante-${clubName.replace(/\s+/g, "-")}.xlsx`);
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
            <h2 className="cl-display" style={{ fontSize: "22px", color: "var(--pitch-dark)" }}>CUADRANTE · {clubName}</h2>
            <div className="cl-row">
              <button className="cl-btn cl-btn-primary" onClick={imprimir}><Printer size={14} /> Exportar a PDF</button>
              <button className="cl-btn cl-btn-gold" onClick={exportarExcel}><FileSpreadsheet size={14} /> Exportar a Excel</button>
            </div>
          </div>
          <h2 className="cl-display cl-print-title" style={{ display: "none" }}>CUADRANTE · {clubName}</h2>
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
                <th style={{ position: "sticky", left: 0, background: "white" }}>Equipo</th>
                {FASES.map((fase) => jornadas.filter((j) => j.fase === fase).map((j) => <th key={j.id}>{j.label}</th>))}
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
                          <div className="cl-mono" style={{ fontSize: "11px", color: "#888" }}>{t.categoria} · {t.nivel}</div>
                        </div>
                      </div>
                    </td>
                    {jornadas.map((j) => {
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
                          <div style={{ fontSize: "12px", fontWeight: c.texto ? 600 : 400 }}>{c.texto}</div>
                          {c.sub && <div className="cl-mono" style={{ fontSize: "10px", color: "#666" }}>{c.sub}</div>}
                        </td>
                      );
                    })}
                  </tr>
                  {jornadas.map((j) => {
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
                            </div>
                          )}
                          {!esVistaExterna && modo === "propio" && local?.status === "pactado" && !local.sede && (
                            <div className="cl-row" style={{ flexWrap: "wrap" }}>
                              <span style={{ fontSize: "13px" }}>
                                Pactado con <b>{local.requestedByClubName}</b> — ¿dónde se juega?
                              </span>
                              <button className="cl-btn cl-btn-gold" onClick={() => ejecutar(() => decidirJugarEnCasa(local.id))}><Home size={14} /> En mi campo</button>
                              <button className="cl-btn cl-btn-primary" onClick={() => ejecutar(() => decidirJugarFuera(local.id))}><Plane size={14} /> En el suyo</button>
                              <GestionCancelacion slot={local} uid={uid} ejecutar={ejecutar} />
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
                              <GestionCancelacion slot={local} uid={uid} ejecutar={ejecutar} />
                            </>
                          )}
                          {!esVistaExterna && modo === "propio" && local?.status === "pactado" && local.sede === "visitante" && (
                            <div>
                              <p style={{ fontSize: "13px", color: "#666" }}>
                                Pactado contra <b>{local.requestedByClubName}</b> — falta que ellos cierren día/hora/campo
                                (juegan en su campo, así que lo deciden ellos).
                              </p>
                              <GestionCancelacion slot={local} uid={uid} ejecutar={ejecutar} />
                            </div>
                          )}
                          {!esVistaExterna && modo === "propio" && local?.status === "confirmado" && (
                            <GestionCancelacion slot={local} uid={uid} ejecutar={ejecutar} />
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
                            <p style={{ fontSize: "13px", color: "#666" }}>
                              Solicitud enviada a <b>{s.clubName}</b> — esperando a que acepten o rechacen.
                            </p>
                          )}
                          {esVistaExterna && s.status === "pactado" && !s.sede && (
                            <div>
                              <p style={{ fontSize: "13px", color: "#666" }}>
                                Pactado con <b>{s.clubName}</b> — falta que ellos decidan si se juega en su campo o en el vuestro.
                              </p>
                              <GestionCancelacion slot={s} uid={uid} ejecutar={ejecutar} />
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
                              <GestionCancelacion slot={s} uid={uid} ejecutar={ejecutar} />
                            </>
                          )}
                          {esVistaExterna && s.status === "pactado" && s.sede === "local" && (
                            <div>
                              <p style={{ fontSize: "13px", color: "#666" }}>
                                Pactado con <b>{s.clubName}</b> — juega en su campo, falta que ellos cierren día/hora/campo.
                              </p>
                              <GestionCancelacion slot={s} uid={uid} ejecutar={ejecutar} />
                            </div>
                          )}
                          {esVistaExterna && s.status === "confirmado" && (
                            <div>
                              <p style={{ fontSize: "13px", color: "#666" }}>
                                Cerrado con <b>{s.clubName}</b> · {s.diaExacto} {s.horaExacta} · {s.campoExacto}
                              </p>
                              <GestionCancelacion slot={s} uid={uid} ejecutar={ejecutar} />
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
