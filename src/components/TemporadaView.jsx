import { useState } from "react";
import { Plus, Trash2, Sparkles } from "lucide-react";
import { t } from "../i18n";
import { addJornada, deleteJornada } from "../hooks/useJornadas";
import { crearHuecosLibresEnBloque } from "../hooks/useClubData";
import { FASES } from "../constants";
import { LIMITES, fechaJornadaRazonable } from "../validaciones";
import { revisarErrores } from "../hooks/useIA";

export default function TemporadaView({ uid, jornadas, slots, teams }) {
  const [label, setLabel] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [fase, setFase] = useState(FASES[0]);
  const [error, setError] = useState("");
  const [avisosIA, setAvisosIA] = useState(null);
  const [revisando, setRevisando] = useState(false);
  const [rellenando, setRellenando] = useState(false);
  const [avisoRelleno, setAvisoRelleno] = useState("");

  const rellenarHuecosQueFaltan = async () => {
    setRellenando(true);
    setAvisoRelleno("");
    try {
      const combinaciones = [];
      teams.forEach((t) => jornadas.forEach((j) => combinaciones.push({ team: t, jornada: j })));
      await crearHuecosLibresEnBloque(uid, combinaciones);
      setAvisoRelleno(`Revisado — ${teams.length} equipo(s) × ${jornadas.length} jornada(s). Los huecos que faltaban ya están creados como "disponible".`);
    } catch (err) {
      setAvisoRelleno(err.message || "No se ha podido completar.");
    }
    setRellenando(false);
  };

  const revisarConIA = async () => {
    setRevisando(true);
    setAvisosIA(null);
    try {
      const resultado = await revisarErrores(
        jornadas.map((j) => ({ label: j.label, fecha: j.orderDate, fase: j.fase })),
        []
      );
      setAvisosIA(resultado.avisos || []);
    } catch (err) {
      setAvisosIA([err.message || "No se ha podido revisar ahora mismo."]);
    }
    setRevisando(false);
  };

  const handleAdd = async () => {
    if (!label.trim() || !orderDate) return;
    if (!fechaJornadaRazonable(orderDate)) {
      setError("Esa fecha de referencia parece rara (muy en el pasado o muy lejana) — revísala.");
      return;
    }
    setError("");
    const ref = await addJornada(uid, { label: label.trim(), orderDate, fase });
    if (teams && teams.length > 0) {
      const nuevaJornada = { id: ref.id, label: label.trim(), orderDate, fase };
      await crearHuecosLibresEnBloque(uid, teams.map((t) => ({ team: t, jornada: nuevaJornada })));
    }
    setLabel("");
    setOrderDate("");
  };

  const handleDelete = async (jornada) => {
    if (!window.confirm(`¿Seguro que quieres borrar la jornada "${jornada.label}"? No se puede deshacer.`)) return;
    setError("");
    try {
      const slotsDeEstaJornada = slots.filter((s) => s.jornadaId === jornada.id);
      await deleteJornada(jornada.id, slotsDeEstaJornada);
    } catch (err) {
      setError(err.message || "No se ha podido borrar la jornada.");
    }
  };

  return (
    <div className="cl-grid-3">
      <div>
        <h2 className="cl-display" style={{ fontSize: "22px", color: "var(--pitch-dark)" }}>NUEVA JORNADA</h2>
        <div className="cl-ticket">
          <label className="cl-label">NOMBRE (como quieras verlo en el cuadrante)</label>
          <input
            className="cl-input"
            placeholder="Ej. 4-5-6 septiembre, o Miércoles 9 sept"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={LIMITES.jornadaLabel}
            style={{ marginBottom: "8px" }}
          />
          <label className="cl-label">FECHA DE REFERENCIA (para ordenar la columna)</label>
          <input
            type="date"
            className="cl-input"
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
            style={{ marginBottom: "8px" }}
          />
          <label className="cl-label">FASE</label>
          <select className="cl-input" value={fase} onChange={(e) => setFase(e.target.value)} style={{ marginBottom: "8px" }}>
            {FASES.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <button className="cl-btn cl-btn-primary" onClick={handleAdd} style={{ justifyContent: "center", width: "100%" }}>
            <Plus size={15} /> Añadir jornada
          </button>
          <p style={{ fontSize: "12px", color: "#64748B", marginTop: "8px" }}>
            No hace falta que sea un fin de semana — añade cualquier fecha suelta si algún equipo quiere jugar entre semana.
          </p>
        </div>
      </div>

      <div>
        <h2 className="cl-display" style={{ fontSize: "22px", color: "var(--pitch-dark)" }}>{t("temporada.titulo")}</h2>
        {jornadas.length > 0 && teams && teams.length > 0 && (
          <>
            <button className="cl-btn cl-btn-primary" onClick={rellenarHuecosQueFaltan} disabled={rellenando} style={{ marginBottom: "8px" }}>
              {rellenando ? "Revisando..." : "Rellenar huecos que faltan"}
            </button>
            <p style={{ fontSize: "11px", color: "#64748B", marginBottom: "10px" }}>
              Repasa todos tus equipos y jornadas, y crea como "disponible" cualquier combinación que se haya quedado
              sin hueco (por ejemplo, si un equipo se creó antes de que existiera alguna jornada). No toca nada de lo que ya exista.
            </p>
            {avisoRelleno && <p style={{ fontSize: "12px", color: "var(--pitch)", marginBottom: "10px" }}>{avisoRelleno}</p>}
          </>
        )}
        {jornadas.length > 0 && (
          <button className="cl-btn cl-btn-gold" onClick={revisarConIA} disabled={revisando} style={{ marginBottom: "10px" }}>
            <Sparkles size={14} /> {revisando ? "Revisando..." : "Revisar con IA"}
          </button>
        )}
        {avisosIA && (
          <div className="cl-ticket" style={{ borderColor: avisosIA.length ? "var(--gold)" : "var(--pitch)" }}>
            {avisosIA.length === 0 ? (
              <p style={{ fontSize: "13px", color: "var(--pitch)" }}>Todo parece correcto, sin nada raro que avisar.</p>
            ) : (
              <ul style={{ fontSize: "13px", paddingLeft: "18px" }}>
                {avisosIA.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            )}
          </div>
        )}
        {error && (
          <p className="cl-ticket" style={{ color: "var(--clay)", borderColor: "var(--clay)", fontSize: "13px" }}>{error}</p>
        )}
        {jornadas.length === 0 && <p style={{ color: "#64748B" }}>Todavía no has añadido ninguna jornada.</p>}
        {FASES.map((f) => {
          const delFase = jornadas.filter((j) => j.fase === f);
          if (delFase.length === 0) return null;
          return (
            <div key={f} className="cl-ticket">
              <p className="cl-display" style={{ fontSize: "18px", color: "var(--pitch)" }}>{f.toUpperCase()}</p>
              {delFase.map((j) => (
                <div key={j.id} className="cl-row" style={{ justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                  <span>{j.label}</span>
                  <button className="cl-btn cl-btn-ghost" onClick={() => handleDelete(j)} style={{ padding: "4px 8px" }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
