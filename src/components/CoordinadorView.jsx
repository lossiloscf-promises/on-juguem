import { useState } from "react";
import { t } from "../i18n";
import { Plus, Pencil, Trash2, Check, X, Sparkles, Home, Plane, Users, CalendarDays, AlertTriangle } from "lucide-react";
import { addTeam, updateTeam, deleteTeam, crearHuecosLibresEnBloque } from "../hooks/useClubData";
import { interpretarDisponibilidad } from "../hooks/useIA";
import TemporadaView from "./TemporadaView";
import {
  GENEROS,
  FORMATOS,
  AGE_GROUPS_BY_FORMATO,
  AGE_GROUPS_WITH_ANYO,
  ANYOS,
  CATEGORIAS,
  NIVELES,
  compararEquipos,
  groupColor,
  claveCoordinador,
  contactoParaCategoria,
} from "../constants";

// Devuelve si este equipo tiene un coordinador asignado (específico de su
// categoría o el general del club) y, si lo tiene, su contacto — para la
// tarjeta de equipo y para el recuento "Sin coordinador" del resumen.
function coordinadorDeEquipo(miProfile, equipo) {
  const clave = claveCoordinador(equipo.genero, equipo.formato);
  const especifico = miProfile?.coordinadores?.[clave];
  const general = miProfile?.coordinadores?.general;
  const asignado = !!(especifico?.telefono || especifico?.email || general?.telefono || general?.email);
  return { asignado, contacto: asignado ? contactoParaCategoria(miProfile, equipo.genero, equipo.formato) : null };
}

const defaultGrupo = (formato) => AGE_GROUPS_BY_FORMATO[formato][0];
const defaultCategoria = (genero, grupo) => CATEGORIAS[genero][grupo][0];
const necesitaAnyo = (grupo) => AGE_GROUPS_WITH_ANYO.includes(grupo);

function FilaEquipoEditable({ t, slotsDeEsteEquipo, onGuardado, uid, allSlots, coordinador }) {
  const [editando, setEditando] = useState(false);
  const [nivel, setNivel] = useState(t.nivel);
  const [identificador, setIdentificador] = useState(t.identificador || "");
  const [genero, setGenero] = useState(t.genero);
  const [formato, setFormato] = useState(t.formato);
  const [grupo, setGrupo] = useState(t.grupo);
  const [anyo, setAnyo] = useState(t.anyo || ANYOS[0]);
  const [categoria, setCategoria] = useState(t.categoria);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const tieneHuecos = slotsDeEsteEquipo.length > 0;

  const guardar = async () => {
    setError("");
    setGuardando(true);
    try {
      if (tieneHuecos) {
        // Con huecos ya publicados, solo se puede tocar nivel, identificador
        // y la fecha de inicio (esta última no afecta a lo ya publicado, solo
        // a jornadas nuevas que se creen a partir de ahora).
        await updateTeam(t.id, { nivel, identificador: identificador.trim() });
      } else {
        await updateTeam(t.id, {
          genero, formato, grupo,
          anyo: necesitaAnyo(grupo) ? anyo : "",
          categoria, nivel, identificador: identificador.trim(),
        });
      }
      setEditando(false);
      onGuardado();
    } catch (err) {
      setError(err.message || "No se ha podido guardar.");
    }
    setGuardando(false);
  };

  const tienePartidosActivos = slotsDeEsteEquipo.some((s) => ["pendiente", "pactado", "confirmado"].includes(s.status));

  const borrar = async () => {
    const aviso = tienePartidosActivos
      ? `Este equipo tiene partidos en marcha. Al borrarlo, esos huecos se LIBERARÁN automáticamente (el rival verá un aviso de que el equipo fue borrado). ¿Seguro que quieres borrar "${t.grupo} ${t.identificador || ""}"? No se puede deshacer.`
      : `¿Seguro que quieres borrar el equipo "${t.grupo} ${t.identificador || ""}"? No se puede deshacer.`;
    if (!window.confirm(aviso)) return;
    setError("");
    try {
      await deleteTeam(uid, t.id, slotsDeEsteEquipo);
      onGuardado();
    } catch (err) {
      setError(err.message || "No se ha podido borrar el equipo.");
    }
  };

  if (!editando) {
    const color = groupColor(t.grupo);
    const iniciales = t.identificador
      ? `${t.grupo.charAt(0)}${t.identificador.trim().charAt(0)}`.toUpperCase()
      : t.grupo.slice(0, 2).toUpperCase();
    const puntos = [
      { clave: "confirmado", color: "var(--st-cerrado-ink)", n: slotsDeEsteEquipo.filter((s) => s.status === "confirmado").length, sing: "cerrado", plur: "cerrados" },
      { clave: "pactado", color: "var(--st-pactado-ink)", n: slotsDeEsteEquipo.filter((s) => s.status === "pactado").length, sing: "pactado", plur: "pactados" },
      { clave: "pendiente", color: "var(--st-pendiente-ink)", n: slotsDeEsteEquipo.filter((s) => s.status === "pendiente").length, sing: "pendiente", plur: "pendientes" },
      { clave: "libre", color: "var(--st-disponible-ink)", n: slotsDeEsteEquipo.filter((s) => s.status === "libre").length, sing: "libre", plur: "libres" },
    ].filter((p) => p.n > 0);

    return (
      <div className="cl-team-card">
        <div className="cl-team-card-body">
          <div className="cl-team-top">
            <div className="cl-team-avatar" style={{ background: color }}>{iniciales}</div>
            <div style={{ minWidth: 0 }}>
              <div className="cl-team-name">{t.grupo}{t.anyo ? ` (${t.anyo})` : ""}{t.identificador ? ` · ${t.identificador}` : ""}</div>
              <span className="cl-cat-chip" style={{ background: color }}>{t.categoria} · {t.nivel}</span>
            </div>
          </div>

          <div className="cl-team-divider" />

          {coordinador?.asignado ? (
            <>
              <div className="cl-coord-label">Coordinador</div>
              <div className="cl-coord-name">{coordinador.contacto?.nombre}{coordinador.contacto?.telefono ? ` · ${coordinador.contacto.telefono}` : ""}</div>
            </>
          ) : (
            <span className="cl-coord-missing"><AlertTriangle size={11} /> Sin coordinador</span>
          )}

          {puntos.length > 0 && (
            <div className="cl-mini-status">
              {puntos.map((p) => (
                <span key={p.clave} style={{ display: "inline-flex", alignItems: "center" }}>
                  <span className="cl-mini-dot" style={{ background: p.color }} />
                  <span className="cl-mini-count">{p.n} {p.n === 1 ? p.sing : p.plur}</span>
                </span>
              ))}
            </div>
          )}

          {(() => {
            // Casa = jugado en el propio campo; Fuera = jugado en campo rival.
            // Cuenta tanto los partidos donde este equipo es el dueño del hueco
            // como aquellos donde reservó él en el cuadrante de otro club.
            const confirmadosPropios = slotsDeEsteEquipo.filter((s) => s.status === "confirmado");
            const confirmadosFuera = (allSlots || []).filter((s) => s.requestedByTeamId === t.id && s.status === "confirmado");
            const casa = confirmadosPropios.filter((s) => s.sede === "local").length + confirmadosFuera.filter((s) => s.sede === "visitante").length;
            const fuera = confirmadosPropios.filter((s) => s.sede === "visitante").length + confirmadosFuera.filter((s) => s.sede === "local").length;
            if (casa + fuera === 0) return null;
            const desequilibrado = Math.abs(casa - fuera) >= 2;
            return (
              <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap", marginTop: "8px" }} className="cl-mono">
                <span style={{ display: "inline-flex", alignItems: "center", gap: "2px", fontSize: "14px", color: desequilibrado ? "var(--gold)" : "#888" }}>
                  <Home size={13} /> Casa: {casa}
                </span>
                <span style={{ fontSize: "14px", color: desequilibrado ? "var(--gold)" : "#888" }}>·</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "2px", fontSize: "14px", color: desequilibrado ? "var(--gold)" : "#888" }}>
                  <Plane size={13} /> Fuera: {fuera}
                </span>
                {desequilibrado && (
                  <span style={{ fontSize: "14px", color: "var(--gold)" }}>
                    {casa > fuera ? "— considera buscar más partidos fuera" : "— considera buscar más partidos en casa"}
                  </span>
                )}
              </div>
            );
          })()}

          {error && <p style={{ color: "var(--clay)", fontSize: "14px", marginTop: "6px" }}>{error}</p>}
        </div>

        <div className="cl-team-card-actions">
          <button className="cl-team-icon-btn" onClick={() => setEditando(true)} aria-label="Editar equipo"><Pencil size={14} /></button>
          <button className="cl-team-icon-btn" onClick={borrar} aria-label="Borrar equipo"><Trash2 size={14} /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="cl-team-card cl-team-card-editing">
      {tieneHuecos && (
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "8px" }}>
          Este equipo ya tiene huecos publicados — solo puedes cambiar nivel e identificador.
        </p>
      )}
      {!tieneHuecos && (
        <div className="cl-row" style={{ flexWrap: "wrap", marginBottom: "8px" }}>
          <select className="cl-input" style={{ width: "auto" }} value={genero} onChange={(e) => setGenero(e.target.value)}>
            {GENEROS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <select className="cl-input" style={{ width: "auto" }} value={formato} onChange={(e) => { setFormato(e.target.value); setGrupo(defaultGrupo(e.target.value)); }}>
            {FORMATOS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <select className="cl-input" style={{ width: "auto" }} value={grupo} onChange={(e) => { setGrupo(e.target.value); setCategoria(defaultCategoria(genero, e.target.value)); }}>
            {AGE_GROUPS_BY_FORMATO[formato].map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          {necesitaAnyo(grupo) && (
            <select className="cl-input" style={{ width: "auto" }} value={anyo} onChange={(e) => setAnyo(e.target.value)}>
              {ANYOS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
          <select className="cl-input" style={{ width: "auto" }} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {CATEGORIAS[genero][grupo].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}
      <div className="cl-row">
        <select className="cl-input" style={{ width: "auto" }} value={nivel} onChange={(e) => setNivel(e.target.value)}>
          {NIVELES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <input className="cl-input" style={{ width: "auto" }} placeholder="Identificador" value={identificador} onChange={(e) => setIdentificador(e.target.value)} maxLength={30} />
        <button className="cl-btn cl-btn-primary" onClick={guardar} disabled={guardando}>
          <Check size={14} /> {guardando ? "Guardando..." : "Guardar"}
        </button>
        <button className="cl-btn cl-btn-ghost" onClick={() => setEditando(false)}><X size={14} /> Cancelar</button>
      </div>
      {error && <p style={{ color: "var(--clay)", fontSize: "12px", marginTop: "6px" }}>{error}</p>}
    </div>
  );
}

export default function CoordinadorView({ uid, clubName, telefono, email, teams, slots, jornadas, allSlots, miProfile }) {
  // Interruptor de nivel superior — "Equipos" es lo que ya mostraba esta
  // pantalla; "Calendario" es TemporadaView.jsx, ahora integrado aquí en
  // vez de tener su propia pestaña en el menú inferior.
  const [vista, setVista] = useState("equipos"); // equipos | calendario
  // El formulario de alta vive dentro de la rejilla, en el hueco de la
  // sección de formato a la que pertenece — no hay una posición fija propia,
  // se calcula comparando newFormato con el formato de cada sección (así si
  // el usuario cambia el desplegable FORMATO estando abierto, el formulario
  // salta de sección automáticamente en vez de quedarse "huérfano").
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [newGenero, setNewGenero] = useState(GENEROS[0]);
  const [newFormato, setNewFormato] = useState(FORMATOS[0]);
  const [newGrupo, setNewGrupo] = useState(defaultGrupo(FORMATOS[0]));
  const [newAnyo, setNewAnyo] = useState(ANYOS[0]);
  const [newCategoria, setNewCategoria] = useState(defaultCategoria(GENEROS[0], defaultGrupo(FORMATOS[0])));
  const [newNivel, setNewNivel] = useState(NIVELES[0]);
  const [newIdentificador, setNewIdentificador] = useState("");
  const [addError, setAddError] = useState("");
  const [textoIA, setTextoIA] = useState("");
  const [usandoIA, setUsandoIA] = useState(false);
  const [errorIA, setErrorIA] = useState("");

  const rellenarConIA = async () => {
    if (!textoIA.trim()) return;
    setErrorIA("");
    setUsandoIA(true);
    try {
      const resultado = await interpretarDisponibilidad(
        textoIA,
        AGE_GROUPS_BY_FORMATO[newFormato],
        CATEGORIAS[newGenero][newGrupo],
        NIVELES
      );
      if (resultado.grupo && AGE_GROUPS_BY_FORMATO[newFormato].includes(resultado.grupo)) {
        handleGrupoChange(resultado.grupo);
      }
      if (resultado.nivel && NIVELES.includes(resultado.nivel)) setNewNivel(resultado.nivel);
    } catch (err) {
      setErrorIA(err.message || "No se ha podido interpretar el texto.");
    }
    setUsandoIA(false);
  };

  const handleGeneroChange = (genero) => {
    setNewGenero(genero);
    setNewCategoria(defaultCategoria(genero, newGrupo));
  };
  const handleFormatoChange = (formato) => {
    const grupo = defaultGrupo(formato);
    setNewFormato(formato);
    setNewGrupo(grupo);
    setNewCategoria(defaultCategoria(newGenero, grupo));
  };
  const handleGrupoChange = (grupo) => {
    setNewGrupo(grupo);
    setNewCategoria(defaultCategoria(newGenero, grupo));
  };

  const handleAddTeam = async () => {
    setAddError("");
    try {
      const ref = await addTeam(uid, clubName, {
        genero: newGenero,
        formato: newFormato,
        grupo: newGrupo,
        anyo: necesitaAnyo(newGrupo) ? newAnyo : "",
        categoria: newCategoria,
        nivel: newNivel,
        identificador: newIdentificador.trim(),
        ownerTelefono: telefono,
        ownerEmail: email,
      });
      if (jornadas && jornadas.length > 0) {
        const nuevoEquipo = {
          id: ref.id, clubName, ownerTelefono: telefono, ownerEmail: email,
          genero: newGenero, formato: newFormato, grupo: newGrupo,
          anyo: necesitaAnyo(newGrupo) ? newAnyo : "", categoria: newCategoria,
          nivel: newNivel, identificador: newIdentificador.trim(),
        };
        await crearHuecosLibresEnBloque(uid, jornadas.map((j) => ({ team: nuevoEquipo, jornada: j })));
      }
      setNewIdentificador("");
    } catch (err) {
      setAddError(err.message || "No se ha podido añadir el equipo.");
    }
  };

  return (
    <div>
      <div className="cl-subtabs" style={{ marginBottom: "16px" }}>
        <button className={`cl-subtab ${vista === "equipos" ? "active" : ""}`} onClick={() => setVista("equipos")}>
          <Users size={14} style={{ marginRight: "4px" }} /> {t("mi_club.equipos")}
        </button>
        <button className={`cl-subtab ${vista === "calendario" ? "active" : ""}`} onClick={() => setVista("calendario")}>
          <CalendarDays size={14} style={{ marginRight: "4px" }} /> {t("mi_club.calendario")}
        </button>
      </div>

      {vista === "calendario" ? (
        <TemporadaView uid={uid} jornadas={jornadas} slots={slots} teams={teams} />
      ) : (
    <div>
      <h1 className="cl-page-title cl-display">Mi club</h1>
      <p className="cl-page-desc">Tus equipos, coordinadores y disponibilidad publicada.</p>

      <div className="cl-stat-row">
        <div className="cl-stat-tile">
          <div className="cl-stat-num">{teams.length}</div>
          <div className="cl-stat-label">Equipos activos</div>
        </div>
        <div className="cl-stat-tile">
          <div className="cl-stat-num">{slots.length}</div>
          <div className="cl-stat-label">Huecos publicados</div>
        </div>
        <div className="cl-stat-tile">
          <div className="cl-stat-num">{slots.filter((s) => s.status === "confirmado").length}</div>
          <div className="cl-stat-label">Partidos cerrados</div>
        </div>
        <div className="cl-stat-tile">
          <div className="cl-stat-num" style={{ color: teams.some((tm) => !coordinadorDeEquipo(miProfile, tm).asignado) ? "var(--st-pendiente-ink)" : undefined }}>
            {teams.filter((tm) => !coordinadorDeEquipo(miProfile, tm).asignado).length}
          </div>
          <div className="cl-stat-label">Sin coordinador</div>
        </div>
      </div>

    <div>
        <h2 className="cl-display" style={{ fontSize: "22px", color: "var(--pitch-dark)" }}>{t("mi_club.titulo")}</h2>
        {teams.length === 0 && <p style={{ color: "var(--text-secondary)" }}>Aún no has añadido ningún equipo.</p>}
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "10px" }}>
          Para marcar disponibilidad, gestionar solicitudes y cerrar partidos, ve a la pestaña <b>CUADRANTE</b>.
        </p>

        {FORMATOS.map((formato) => {
          const equiposFormato = teams.filter((tm) => tm.formato === formato).sort(compararEquipos);
          const formularioAqui = formularioAbierto && newFormato === formato;
          return (
            <div key={formato}>
              <div className="cl-section-title">
                <h3>{formato}</h3>
                <div className="cl-rule" />
              </div>
              <div className="cl-team-grid">
                {equiposFormato.map((tm) => (
                  <FilaEquipoEditable
                    key={tm.id}
                    t={tm}
                    uid={uid}
                    slotsDeEsteEquipo={slots.filter((s) => s.teamId === tm.id)}
                    allSlots={allSlots}
                    coordinador={coordinadorDeEquipo(miProfile, tm)}
                    onGuardado={() => {}}
                  />
                ))}

                {formularioAqui ? (
                  <div className="cl-team-card cl-team-card-editing cl-panel-cell">
                    <div className="cl-row" style={{ justifyContent: "space-between", marginBottom: "10px" }}>
                      <span className="cl-team-name">Añadir equipo de {formato}</span>
                      <button className="cl-team-icon-btn" onClick={() => setFormularioAbierto(false)} aria-label="Cerrar formulario">
                        <X size={14} />
                      </button>
                    </div>

                    <div className="cl-row" style={{ marginBottom: "8px" }}>
                      <input
                        className="cl-input"
                        placeholder="✨ O descríbelo: 'Juvenil A, nivel medio'"
                        value={textoIA}
                        onChange={(e) => setTextoIA(e.target.value)}
                        maxLength={300}
                      />
                      <button className="cl-btn cl-btn-gold" onClick={rellenarConIA} disabled={usandoIA}>
                        <Sparkles size={14} /> {usandoIA ? "..." : "Rellenar"}
                      </button>
                    </div>
                    {errorIA && <p style={{ color: "var(--clay)", fontSize: "12px", marginBottom: "8px" }}>{errorIA}</p>}

                    <label className="cl-label">GÉNERO</label>
                    <select className="cl-input" value={newGenero} onChange={(e) => handleGeneroChange(e.target.value)} style={{ marginBottom: "8px" }}>
                      {GENEROS.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <label className="cl-label">FORMATO</label>
                    <select className="cl-input" value={newFormato} onChange={(e) => handleFormatoChange(e.target.value)} style={{ marginBottom: "8px" }}>
                      {FORMATOS.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <label className="cl-label">GRUPO DE EDAD</label>
                    <select className="cl-input" value={newGrupo} onChange={(e) => handleGrupoChange(e.target.value)} style={{ marginBottom: "8px" }}>
                      {AGE_GROUPS_BY_FORMATO[newFormato].map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                    {necesitaAnyo(newGrupo) && (
                      <>
                        <label className="cl-label">AÑO</label>
                        <select className="cl-input" value={newAnyo} onChange={(e) => setNewAnyo(e.target.value)} style={{ marginBottom: "8px" }}>
                          {ANYOS.map((a) => <option key={a} value={a}>{a}</option>)}
                        </select>
                      </>
                    )}
                    <label className="cl-label">CATEGORÍA / LIGA</label>
                    <select className="cl-input" value={newCategoria} onChange={(e) => setNewCategoria(e.target.value)} style={{ marginBottom: "8px" }}>
                      {CATEGORIAS[newGenero][newGrupo].map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <label className="cl-label">NIVEL DEL EQUIPO</label>
                    <select className="cl-input" value={newNivel} onChange={(e) => setNewNivel(e.target.value)} style={{ marginBottom: "8px" }}>
                      {NIVELES.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <input
                      className="cl-input"
                      placeholder="Identificador (opcional, ej. A, B)"
                      value={newIdentificador}
                      onChange={(e) => setNewIdentificador(e.target.value)}
                      maxLength={30}
                      style={{ marginBottom: "8px" }}
                    />
                    <div className="cl-row">
                      <button className="cl-btn cl-btn-primary" onClick={handleAddTeam}>
                        <Plus size={14} /> Añadir equipo
                      </button>
                      <button className="cl-btn cl-btn-ghost" onClick={() => setFormularioAbierto(false)}>
                        <X size={14} /> Cancelar
                      </button>
                    </div>
                    {addError && <p style={{ color: "var(--clay)", fontSize: "12px", marginTop: "6px" }}>{addError}</p>}
                  </div>
                ) : (
                  <button
                    className="cl-add-team-more"
                    onClick={() => { handleFormatoChange(formato); setFormularioAbierto(true); }}
                  >
                    <Plus size={14} /> {equiposFormato.length > 0 ? "Añadir otro equipo de" : "Añadir equipo de"} {formato}
                  </button>
                )}
              </div>
            </div>
          );
        })}
    </div>
    </div>
      )}
    </div>
  );
}
