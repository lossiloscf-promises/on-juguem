import { useState } from "react";
import { t } from "../i18n";
import { Trophy, Plus, Users, Calendar, X, Check } from "lucide-react";
import { GENEROS, FORMATOS, AGE_GROUPS_BY_FORMATO, CATEGORIAS, NIVELES, HORARIOS_VALIDOS, groupColor } from "../constants";
import { useInstalaciones } from "../hooks/useInstalaciones";
import {
  useMisTorneos,
  useTorneosAbiertos,
  crearTorneo,
  apuntarseATorneo,
  retirarseDeTorneo,
  programarTorneo,
  cambiarPartidoTorneo,
} from "../hooks/useTorneos";

function FormularioCrearTorneo({ uid, clubName, telefono, email, misEquipos, jornadas, onCreado }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [genero, setGenero] = useState(GENEROS[0]);
  const [formato, setFormato] = useState(FORMATOS[0]);
  const [grupo, setGrupo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [nivel, setNivel] = useState(NIVELES[3]);
  const [jornadaId, setJornadaId] = useState("");
  const [dia, setDia] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const instalaciones = useInstalaciones(uid);
  const [instalacion, setInstalacion] = useState("");
  const [maxEquipos, setMaxEquipos] = useState(3);
  const [equipoOrganizadorId, setEquipoOrganizadorId] = useState("");
  const [error, setError] = useState("");
  const [creando, setCreando] = useState(false);

  const grupoOptions = AGE_GROUPS_BY_FORMATO[formato] || [];
  const categoriaOptions = grupo ? (CATEGORIAS[genero]?.[grupo] || []) : [];
  const jornadaElegida = jornadas.find((j) => j.id === jornadaId);

  const crear = async () => {
    if (!nombre.trim() || !genero || !formato || !grupo || !categoria || !nivel || !dia || !horaInicio || !horaFin || !instalacion.trim() || !equipoOrganizadorId) {
      setError("Rellena todos los campos.");
      return;
    }
    const equipoOrganizador = misEquipos.find((t) => t.id === equipoOrganizadorId);
    setError("");
    setCreando(true);
    try {
      await crearTorneo(uid, clubName, telefono, email, {
        nombre, genero, formato, categoria, nivel,
        jornadaLabel: jornadaElegida?.label || "", jornadaOrderDate: jornadaElegida?.orderDate || dia,
        dia, horaInicio, horaFin, instalacion: instalacion.trim(),
        maxEquipos: Number(maxEquipos),
        equipoOrganizador,
      });
      setNombre(""); setDia(""); setHoraInicio(""); setHoraFin(""); setInstalacion(""); setEquipoOrganizadorId("");
      setAbierto(false);
      onCreado?.();
    } catch (err) {
      setError(err.message || "No se ha podido crear el torneo.");
    }
    setCreando(false);
  };

  if (!abierto) {
    return (
      <button className="cl-btn cl-btn-primary" onClick={() => setAbierto(true)}>
        <Plus size={14} /> Crear triangular/torneo
      </button>
    );
  }

  return (
    <div className="cl-ticket">
      <h3 className="cl-display" style={{ fontSize: "18px", color: "var(--pitch-dark)" }}>{t("torneos.nuevo")}</h3>
      <label className="cl-label">NOMBRE</label>
      <input className="cl-input" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={100} style={{ marginBottom: "8px" }} placeholder="Ej. Triangular de pretemporada" />

      <div className="cl-row" style={{ marginBottom: "8px" }}>
        <select className="cl-input" value={genero} onChange={(e) => setGenero(e.target.value)}>
          {GENEROS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select className="cl-input" value={formato} onChange={(e) => { setFormato(e.target.value); setGrupo(""); setCategoria(""); }}>
          {FORMATOS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select className="cl-input" value={grupo} onChange={(e) => { setGrupo(e.target.value); setCategoria(""); }}>
          <option value="">Categoría de edad</option>
          {grupoOptions.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      <div className="cl-row" style={{ marginBottom: "8px" }}>
        <select className="cl-input" value={categoria} onChange={(e) => setCategoria(e.target.value)} disabled={!grupo}>
          <option value="">Liga/competición</option>
          {categoriaOptions.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="cl-input" value={nivel} onChange={(e) => setNivel(e.target.value)}>
          {NIVELES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      <label className="cl-label">TU EQUIPO PARTICIPANTE</label>
      <select className="cl-input" value={equipoOrganizadorId} onChange={(e) => setEquipoOrganizadorId(e.target.value)} style={{ marginBottom: "8px" }}>
        <option value="">Elige tu equipo</option>
        {misEquipos.map((t) => (
          <option key={t.id} value={t.id}>{t.grupo}{t.anyo ? ` (${t.anyo})` : ""}{t.identificador ? ` ${t.identificador}` : ""}</option>
        ))}
      </select>

      <label className="cl-label">JORNADA DE REFERENCIA (opcional)</label>
      <select className="cl-input" value={jornadaId} onChange={(e) => setJornadaId(e.target.value)} style={{ marginBottom: "8px" }}>
        <option value="">— Sin jornada concreta —</option>
        {jornadas.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}
      </select>

      <div className="cl-row" style={{ marginBottom: "8px", flexWrap: "wrap" }}>
        <div>
          <label className="cl-label">DÍA</label>
          <input type="date" className="cl-input" value={dia} onChange={(e) => setDia(e.target.value)} />
        </div>
        <div>
          <label className="cl-label">DESDE</label>
          <select className="cl-input" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)}>
            <option value="">Hora</option>
            {HORARIOS_VALIDOS.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
        <div>
          <label className="cl-label">HASTA</label>
          <select className="cl-input" value={horaFin} onChange={(e) => setHoraFin(e.target.value)}>
            <option value="">Hora</option>
            {HORARIOS_VALIDOS.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
      </div>

      <label className="cl-label">INSTALACIÓN</label>
      <input className="cl-input" value={instalacion} onChange={(e) => setInstalacion(e.target.value)} maxLength={60} list="instalaciones-torneo" style={{ marginBottom: "8px" }} />
      <datalist id="instalaciones-torneo">
        {instalaciones.map((i) => <option key={i.id} value={i.nombre} />)}
      </datalist>

      <label className="cl-label">NÚMERO DE EQUIPOS (incluido el tuyo)</label>
      <select className="cl-input" value={maxEquipos} onChange={(e) => setMaxEquipos(e.target.value)} style={{ marginBottom: "8px" }}>
        <option value={3}>3 (triangular)</option>
        <option value={4}>4</option>
        <option value={5}>5</option>
        <option value={6}>6</option>
        <option value={8}>8</option>
      </select>

      {error && <p style={{ color: "var(--clay)", fontSize: "12px", marginBottom: "8px" }}>{error}</p>}
      <div className="cl-row">
        <button className="cl-btn cl-btn-primary" onClick={crear} disabled={creando}>
          {creando ? "Creando..." : "Crear torneo"}
        </button>
        <button className="cl-btn cl-btn-ghost" onClick={() => setAbierto(false)}>Cancelar</button>
      </div>
    </div>
  );
}

function TarjetaTorneoAbierto({ torneo, uid, clubName, telefono, email, misEquipos }) {
  const [eligiendo, setEligiendo] = useState(false);
  const [equipoId, setEquipoId] = useState("");
  const [error, setError] = useState("");

  const yaApuntado = (torneo.participantes || []).some((p) => p.clubUid === uid);
  const plazasLibres = torneo.maxEquipos - (torneo.participantes || []).length;
  const misEquiposCompatibles = misEquipos.filter((t) => t.genero === torneo.genero && t.formato === torneo.formato);

  const apuntarse = async () => {
    if (!equipoId) { setError("Elige un equipo."); return; }
    const equipo = misEquipos.find((t) => t.id === equipoId);
    setError("");
    try {
      await apuntarseATorneo(torneo.id, uid, clubName, equipo, telefono, email);
      setEligiendo(false);
    } catch (err) {
      setError(err.message || "No se ha podido apuntar.");
    }
  };

  const retirarse = async () => {
    if (!window.confirm(`¿Retirarte de "${torneo.nombre}"?`)) return;
    await retirarseDeTorneo(torneo.id, uid);
  };

  return (
    <div className="cl-ticket">
      <div className="cl-cat-strip" style={{ background: groupColor(torneo.categoria) }} />
      <p style={{ fontSize: "15px", fontWeight: 700 }}>{torneo.nombre}</p>
      <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
        {torneo.genero} · {torneo.formato} · {torneo.categoria} · {torneo.nivel}
      </p>
      <p style={{ fontSize: "13px" }}>
        <Calendar size={14} style={{ verticalAlign: "-2px" }} /> {torneo.dia} · {torneo.horaInicio}-{torneo.horaFin} · {torneo.instalacion}
      </p>
      <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Organiza <b>{torneo.organizadorClubName}</b></p>
      <p style={{ fontSize: "13px" }}>
        <Users size={14} style={{ verticalAlign: "-2px" }} /> {(torneo.participantes || []).length} / {torneo.maxEquipos} equipos apuntados
        {(torneo.participantes || []).length > 0 && (
          <span style={{ color: "var(--text-secondary)" }}> — {(torneo.participantes || []).map((p) => p.clubName).join(", ")}</span>
        )}
      </p>
      {yaApuntado ? (
        <button className="cl-btn cl-btn-ghost" onClick={retirarse}><X size={14} /> Retirarme</button>
      ) : plazasLibres <= 0 ? (
        <p style={{ fontSize: "12px", color: "var(--clay)" }}>Plazas completas.</p>
      ) : !eligiendo ? (
        <button className="cl-btn cl-btn-primary" onClick={() => setEligiendo(true)}>Apuntarme</button>
      ) : (
        <div className="cl-row" style={{ flexWrap: "wrap" }}>
          <select className="cl-input" value={equipoId} onChange={(e) => setEquipoId(e.target.value)}>
            <option value="">Tu equipo</option>
            {misEquiposCompatibles.map((t) => (
              <option key={t.id} value={t.id}>{t.grupo}{t.anyo ? ` (${t.anyo})` : ""}{t.identificador ? ` ${t.identificador}` : ""}</option>
            ))}
          </select>
          <button className="cl-btn cl-btn-primary" onClick={apuntarse}>Confirmar</button>
          <button className="cl-btn cl-btn-ghost" onClick={() => setEligiendo(false)}>Cancelar</button>
          {error && <p style={{ color: "var(--clay)", fontSize: "12px", width: "100%" }}>{error}</p>}
        </div>
      )}
    </div>
  );
}

function PartidoTorneoOrganizado({ torneo, partido }) {
  const [editando, setEditando] = useState(false);
  const [hora, setHora] = useState(partido.hora);
  const [campo, setCampo] = useState(partido.campo);

  const guardar = async () => {
    await cambiarPartidoTorneo(torneo.id, partido.slotId, { hora, campo });
    setEditando(false);
  };

  return (
    <div className="cl-row" style={{ justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--line)" }}>
      <span style={{ fontSize: "13px" }}>{partido.equipoA.clubName} vs {partido.equipoB.clubName}</span>
      {!editando ? (
        <div className="cl-row">
          <span className="cl-mono" style={{ fontSize: "12px" }}>{partido.hora} · {partido.campo}</span>
          <button className="cl-btn cl-btn-ghost" style={{ padding: "2px 6px" }} onClick={() => setEditando(true)}>Editar</button>
        </div>
      ) : (
        <div className="cl-row">
          <select className="cl-input" style={{ width: "auto" }} value={hora} onChange={(e) => setHora(e.target.value)}>
            {HORARIOS_VALIDOS.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
          <input className="cl-input" style={{ width: "auto" }} value={campo} onChange={(e) => setCampo(e.target.value)} />
          <button className="cl-btn cl-btn-primary" style={{ padding: "2px 6px" }} onClick={guardar}>Guardar</button>
        </div>
      )}
    </div>
  );
}

function PanelTorneoOrganizado({ torneo, teamsPorClub }) {
  const [programando, setProgramando] = useState(false);
  const [emparejamientos, setEmparejamientos] = useState([]);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const participantes = torneo.participantes || [];

  const añadirEmparejamiento = () => {
    setEmparejamientos((prev) => [...prev, { equipoAIdx: "", equipoBIdx: "", hora: "", campo: torneo.instalacion }]);
  };
  const cambiarEmparejamiento = (i, campo, valor) => {
    setEmparejamientos((prev) => prev.map((e, idx) => (idx === i ? { ...e, [campo]: valor } : e)));
  };
  const quitarEmparejamiento = (i) => {
    setEmparejamientos((prev) => prev.filter((_, idx) => idx !== i));
  };

  const confirmarPrograma = async () => {
    if (emparejamientos.length === 0) { setError("Añade al menos un partido."); return; }
    for (const e of emparejamientos) {
      if (e.equipoAIdx === "" || e.equipoBIdx === "" || e.equipoAIdx === e.equipoBIdx || !e.hora || !e.campo.trim()) {
        setError("Revisa que todos los partidos tengan dos equipos distintos, hora y campo.");
        return;
      }
    }
    setError("");
    setGuardando(true);
    try {
      const partidos = emparejamientos.map((e) => ({
        equipoA: participantes[e.equipoAIdx],
        equipoB: participantes[e.equipoBIdx],
        hora: e.hora,
        campo: e.campo.trim(),
      }));
      await programarTorneo(torneo.id, partidos, teamsPorClub || {});
      setProgramando(false);
    } catch (err) {
      setError(err.message || "No se ha podido programar.");
    }
    setGuardando(false);
  };

  return (
    <div className="cl-ticket">
      <div className="cl-row" style={{ justifyContent: "space-between" }}>
        <p style={{ fontSize: "15px", fontWeight: 700 }}>{torneo.nombre}</p>
        <span className="cl-mono" style={{ fontSize: "11px", color: torneo.estado === "abierto" ? "var(--gold)" : "var(--pitch)" }}>
          {torneo.estado === "abierto" ? "ABIERTO" : "PROGRAMADO"}
        </span>
      </div>
      <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{torneo.dia} · {torneo.horaInicio}-{torneo.horaFin} · {torneo.instalacion}</p>
      <p style={{ fontSize: "13px" }}>
        <Users size={14} style={{ verticalAlign: "-2px" }} /> {participantes.map((p) => p.clubName).join(", ") || "Nadie apuntado todavía"}
      </p>

      {torneo.estado === "abierto" && !programando && (
        <button className="cl-btn cl-btn-primary" onClick={() => { setProgramando(true); if (emparejamientos.length === 0) añadirEmparejamiento(); }} disabled={participantes.length < 2}>
          Cerrar inscripciones y programar
        </button>
      )}

      {programando && (
        <div style={{ marginTop: "8px", background: "#F5F3EC", padding: "10px", borderRadius: "8px" }}>
          {emparejamientos.map((e, i) => (
            <div key={i} className="cl-row" style={{ flexWrap: "wrap", marginBottom: "6px" }}>
              <select className="cl-input" value={e.equipoAIdx} onChange={(ev) => cambiarEmparejamiento(i, "equipoAIdx", ev.target.value)}>
                <option value="">Equipo A</option>
                {participantes.map((p, idx) => <option key={idx} value={idx}>{p.clubName} · {p.teamLabel}</option>)}
              </select>
              <span>vs</span>
              <select className="cl-input" value={e.equipoBIdx} onChange={(ev) => cambiarEmparejamiento(i, "equipoBIdx", ev.target.value)}>
                <option value="">Equipo B</option>
                {participantes.map((p, idx) => <option key={idx} value={idx}>{p.clubName} · {p.teamLabel}</option>)}
              </select>
              <select className="cl-input" style={{ width: "auto" }} value={e.hora} onChange={(ev) => cambiarEmparejamiento(i, "hora", ev.target.value)}>
                <option value="">Hora</option>
                {HORARIOS_VALIDOS.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
              <input className="cl-input" style={{ width: "auto" }} value={e.campo} onChange={(ev) => cambiarEmparejamiento(i, "campo", ev.target.value)} placeholder="Campo" />
              <button className="cl-btn cl-btn-ghost" onClick={() => quitarEmparejamiento(i)}><X size={14} /></button>
            </div>
          ))}
          <button className="cl-btn cl-btn-ghost" onClick={añadirEmparejamiento}><Plus size={14} /> Añadir partido</button>
          {error && <p style={{ color: "var(--clay)", fontSize: "12px", marginTop: "6px" }}>{error}</p>}
          <div className="cl-row" style={{ marginTop: "8px" }}>
            <button className="cl-btn cl-btn-primary" onClick={confirmarPrograma} disabled={guardando}>
              <Check size={14} /> {guardando ? "Guardando..." : "Confirmar calendario"}
            </button>
            <button className="cl-btn cl-btn-ghost" onClick={() => setProgramando(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {torneo.estado === "programado" && (
        <div style={{ marginTop: "8px" }}>
          {(torneo.partidos || []).map((p, i) => (
            <PartidoTorneoOrganizado key={i} torneo={torneo} partido={p} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TorneosView({ uid, clubName, telefono, email, misEquipos, jornadas, teamsPorClub }) {
  const misTorneos = useMisTorneos(uid);
  const torneosAbiertos = useTorneosAbiertos().filter((t) => t.organizadorUid !== uid);

  return (
    <div>
      <h2 className="cl-display" style={{ fontSize: "22px", color: "var(--pitch-dark)" }}>
        <Trophy size={18} style={{ verticalAlign: "-3px" }} /> {t("torneos.titulo")}
      </h2>

      <FormularioCrearTorneo uid={uid} clubName={clubName} telefono={telefono} email={email} misEquipos={misEquipos} jornadas={jornadas} />

      {misTorneos.length > 0 && (
        <>
          <h3 className="cl-display" style={{ fontSize: "18px", color: "var(--pitch-dark)", marginTop: "20px" }}>{t("torneos.organizados")}</h3>
          {misTorneos.map((t) => (
            <PanelTorneoOrganizado key={t.id} torneo={t} teamsPorClub={teamsPorClub} />
          ))}
        </>
      )}

      <h3 className="cl-display" style={{ fontSize: "18px", color: "var(--pitch-dark)", marginTop: "20px" }}>{t("torneos.abiertos")}</h3>
      {torneosAbiertos.length === 0 ? (
        <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>No hay ningún torneo abierto ahora mismo.</p>
      ) : (
        torneosAbiertos.map((t) => (
          <TarjetaTorneoAbierto key={t.id} torneo={t} uid={uid} clubName={clubName} telefono={telefono} email={email} misEquipos={misEquipos} />
        ))
      )}
    </div>
  );
}
