import { useEffect, useState } from "react";
import { ESTADO_INFO, COLOR_CANCELACION_PENDIENTE, compararEquipos, FASES } from "../constants";

const FUNCTIONS_URL = "https://europe-west1-partitscv.cloudfunctions.net/cuadrantePublico";

export default function CuadrantePublico({ uidClub }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${FUNCTIONS_URL}?club=${encodeURIComponent(uidClub)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setDatos(d);
      })
      .catch(() => setError("No se ha podido cargar el cuadrante ahora mismo."));
  }, [uidClub]);

  if (error) {
    return (
      <div className="cl-shell">
        <div className="cl-main">
          <p className="cl-ticket" style={{ color: "var(--clay)" }}>{error}</p>
        </div>
      </div>
    );
  }
  if (!datos) {
    return (
      <div className="cl-shell">
        <div className="cl-main"><p>Cargando cuadrante...</p></div>
      </div>
    );
  }

  const slotDe = (teamId, jornadaId) => datos.slots.find((s) => s.teamId === teamId && s.jornadaId === jornadaId);

  return (
    <div className="cl-shell">
      <header className="cl-header">
        <div className="cl-header-inner">
          <div>
            <h1 className="cl-display cl-title">ON JUGUEM</h1>
            <p className="cl-mono cl-subtitle">{datos.clubName} · cuadrante público (solo lectura)</p>
          </div>
        </div>
      </header>
      <div className="cl-main">
        <p style={{ fontSize: "12px", color: "#64748B", marginBottom: "10px" }}>
          Vista pública, sin datos de contacto — para reservar o gestionar partidos hace falta una cuenta en On Juguem.
        </p>
        {FASES.map((fase) => {
          const jornadasFase = datos.jornadas.filter((j) => j.fase === fase);
          if (jornadasFase.length === 0) return null;
          return (
            <div key={fase} className="cl-ticket" style={{ overflowX: "auto", marginBottom: "16px" }}>
              <h2 className="cl-display" style={{ fontSize: "18px", color: "var(--pitch-dark)" }}>{fase.toUpperCase()}</h2>
              <table className="cl-table">
                <thead>
                  <tr>
                    <th style={{ position: "sticky", left: 0, background: "white" }}>Equipo</th>
                    {jornadasFase.map((j) => <th key={j.id}>{j.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[...datos.teams].sort(compararEquipos).map((t) => (
                    <tr key={t.id}>
                      <td style={{ position: "sticky", left: 0, background: "white", fontWeight: 700 }}>
                        {t.grupo}{t.anyo ? ` (${t.anyo})` : ""} · {t.categoria} · {t.nivel}{t.identificador ? ` · ${t.identificador}` : ""}
                      </td>
                      {jornadasFase.map((j) => {
                        const s = slotDe(t.id, j.id);
                        const color = s?.cancelacionPropuestaPor
                          ? COLOR_CANCELACION_PENDIENTE
                          : ESTADO_INFO[s?.status]?.color || "transparent";
                        let texto = "";
                        if (s?.status === "confirmado") texto = `${s.rivalClubName || ""} — ${s.diaExacto} ${s.horaExacta}`;
                        else if (s?.status && s.status !== "no_disponible") texto = s.rivalClubName || ESTADO_INFO[s.status]?.label || "";
                        else if (s?.status === "no_disponible") texto = "No disponible";
                        return (
                          <td key={j.id} style={{ background: color, textAlign: "center", fontSize: "12px", padding: "6px" }}>
                            {texto}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
