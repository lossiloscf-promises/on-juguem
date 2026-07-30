import { useState, Fragment } from "react";
import * as XLSX from "xlsx";
import { Printer, FileSpreadsheet, Check, X, Home, Plane, History } from "lucide-react";
import { FASES, groupColor, compararEquipos, ORDEN_EDAD } from "../constants";
import { diaCoincideConJornada, tieneJornadaCoincidente } from "../validaciones";
import { useInstalaciones } from "../hooks/useInstalaciones";
import {
  requestBooking,
  rejectRequest,
  aceptarEnCasa,
  aceptarFueraCasa,
  cerrarComoLocal,
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
  no_disponible: "#E4E4E0",
  libre: "#DCEEE4",
  pendiente: "#FBEFD9",
  pactado: "#FBEFD9",
  confirmado: "#CFE8D8",
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
  if (slot.status === "pactado") return { texto: slot.requestedByClubName, sub: slot.sede === "local" ? "falta cerrar día/hora — pincha" : "falta que el rival cierre" };
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

export function GestionCancelacion({ slot, uid, ejecutar }) {
  const propuestaPorMi = slot.cancelacionPropuestaPor === uid;
  const propuestaPorElRival = slot.cancelacionPropuestaPor && slot.cancelacionPropuestaPor !== uid;

  if (propuestaPorMi) {
    return (
      <div style={{ marginTop: "8px" }}>
        <p style={{ fontSize: "12px", color: "#888" }}>Has propuesto cancelar — esperando a que {slot.requestedByClubName || "la otra parte"} lo acepte o lo rechace.</p>
        <button className="cl-btn cl-btn-ghost" onClick={() => ejecutar(() => rechazarCancelacion(slot.id))}>
          Retirar mi propuesta
        </button>
      </div>
    );
  }
  if (propuestaPorElRival) {
    return (
      <div style={{ marginTop: "8px", background: "#FBEFD9", padding: "8px", borderRadius: "4px" }}>
        <p style={{ fontSize: "13px" }}><b>{slot.requestedByClubName}</b> ha propuesto cancelar este partido.</p>
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
        if (window.confirm("Vas a proponer cancelar este partido. El rival tendrá que aceptarlo para que se libere. ¿Seguro?")) {
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
        const s = slotDe(t.id, j.id);
        const c = contenidoCelda(s, modo);
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
                      const s = slotDe(t.id, j.id);
                      const c = contenidoCelda(s, modo);
                      const clicable = puedeExpandir(s) || (modo === "ajeno" && s?.status === "libre");
                      const activa = celdaAbierta === `${t.id}:${j.id}`;
                      return (
                        <td
                          key={j.id}
                          onClick={() => clicable && setCeldaAbierta(activa ? null : `${t.id}:${j.id}`)}
                          style={{ background: CELL_BG[s?.status || "vacio"], textAlign: "center", cursor: clicable ? "pointer" : "default", outline: activa ? "2px solid var(--pitch)" : "none" }}
                        >
                          <div style={{ fontSize: "12px", fontWeight: c.texto ? 600 : 400 }}>{c.texto}</div>
                          {c.sub && <div className="cl-mono" style={{ fontSize: "10px", color: "#666" }}>{c.sub}</div>}
                        </td>
                      );
                    })}
                  </tr>
                  {jornadas.map((j) => {
                    const s = slotDe(t.id, j.id);
                    if (celdaAbierta !== `${t.id}:${j.id}`) return null;
                    return (
                      <tr key={`${t.id}:${j.id}:panel`}>
                        <td colSpan={jornadas.length + 1} style={{ background: "#FAFAF7", padding: "10px" }}>
                          {modo === "propio" && (!s || ["libre", "no_disponible"].includes(s.status)) && (
                            <div className="cl-row">
                              <button
                                className="cl-btn"
                                style={{ background: s?.status === "libre" ? "var(--pitch)" : "transparent", color: s?.status === "libre" ? "white" : "var(--pitch)", border: "1.5px solid var(--pitch)" }}
                                onClick={() => ejecutar(async () => { await setDisponibilidad(uid, t, j, true); setCeldaAbierta(null); })}
                              >
                                Marcar disponible
                              </button>
                              <button
                                className="cl-btn"
                                style={{ background: s?.status === "no_disponible" ? "#999" : "transparent", color: s?.status === "no_disponible" ? "white" : "#999", border: "1.5px solid #999" }}
                                onClick={() => ejecutar(async () => { await setDisponibilidad(uid, t, j, false); setCeldaAbierta(null); })}
                              >
                                Marcar no disponible
                              </button>
                              {s && (
                                <button
                                  className="cl-btn cl-btn-ghost"
                                  onClick={() => {
                                    if (window.confirm(`¿Quitar la jornada "${j.label}" del equipo ${t.grupo}${t.identificador ? " " + t.identificador : ""}? Este equipo no participará esa fecha (queda vacía, puedes volver a activarla cuando quieras).`)) {
                                      ejecutar(async () => { await eliminarHuecoDeEquipo(uid, t.id, j.id, s.status); setCeldaAbierta(null); });
                                    }
                                  }}
                                >
                                  Este equipo no participa esta jornada
                                </button>
                              )}
                            </div>
                          )}
                          {modo === "propio" && s?.status === "pendiente" && (
                            <div className="cl-row" style={{ flexWrap: "wrap" }}>
                              <span style={{ fontSize: "13px" }}>
                                <b>{s.requestedByClubName}</b> quiere reservar este hueco
                                {(s.requestedByTelefono || s.requestedByEmail) && (
                                  <> · {s.requestedByTelefono} {s.requestedByEmail}</>
                                )}
                              </span>
                              <button className="cl-btn cl-btn-ghost" onClick={() => ejecutar(() => rejectRequest(s.id))}><X size={14} /> Rechazar</button>
                              <button className="cl-btn cl-btn-gold" onClick={() => ejecutar(() => aceptarEnCasa(s.id))}><Home size={14} /> Jugamos en mi campo</button>
                              <button className="cl-btn cl-btn-primary" onClick={() => ejecutar(() => aceptarFueraCasa(s.id))}><Plane size={14} /> Jugamos en el suyo</button>
                            </div>
                          )}
                          {modo === "propio" && s?.status === "pactado" && s.sede === "local" && (
                            <>
                              <FormularioCierreInline
                                slot={s}
                                allSlots={allSlots}
                                uid={uid}
                                onConfirmar={(datos) => cerrarComoLocal(s.id, { ...datos, grupo: s.grupo, teamId: s.teamId }, allSlots)}
                              />
                              <GestionCancelacion slot={s} uid={uid} ejecutar={ejecutar} />
                            </>
                          )}
                          {modo === "propio" && s?.status === "pactado" && s.sede === "visitante" && (
                            <div>
                              <p style={{ fontSize: "13px", color: "#666" }}>
                                Pactado contra <b>{s.requestedByClubName}</b> — falta que ellos cierren día/hora/campo
                                (juegan en su campo, así que lo deciden ellos).
                              </p>
                              <GestionCancelacion slot={s} uid={uid} ejecutar={ejecutar} />
                            </div>
                          )}
                          {modo === "propio" && s?.status === "confirmado" && (
                            <GestionCancelacion slot={s} uid={uid} ejecutar={ejecutar} />
                          )}
                          {modo === "propio" && s?.avisoEquipoBorrado && (
                            <div style={{ marginTop: "8px", background: "#FDECEA", padding: "8px", borderRadius: "4px" }}>
                              <p style={{ fontSize: "13px" }}>⚠️ {s.avisoTexto}</p>
                              <button className="cl-btn cl-btn-ghost" onClick={() => ejecutar(() => descartarAviso(s.id))}>
                                Entendido
                              </button>
                            </div>
                          )}
                          {modo === "ajeno" && s?.status === "libre" && (
                            !puedeReservar ? (
                              <p style={{ fontSize: "12px", color: "var(--clay)" }}>
                                No puedes reservar todavía — tu club o este todavía no está verificado por un administrador.
                              </p>
                            ) : tieneJornadaCoincidente(misJornadas, j.orderDate) ? (
                              <SelectorEquipoPropio
                                grupoCelda={t.grupo}
                                misEquipos={misEquipos || []}
                                onElegir={(miEquipo) => ejecutar(async () => {
                                  await requestBooking(s.id, uid, misClubName, telefono, email, miEquipo?.id);
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
                          {modo === "propio" && s && <HistorialDelHueco slotId={s.id} />}
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
