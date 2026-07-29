import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X, Sparkles } from "lucide-react";
import { addTeam, updateTeam, deleteTeam, crearHuecosLibresEnBloque } from "../hooks/useClubData";
import { interpretarDisponibilidad } from "../hooks/useIA";
import {
  GENEROS,
  FORMATOS,
  AGE_GROUPS_BY_FORMATO,
  AGE_GROUPS_WITH_ANYO,
  ANYOS,
  CATEGORIAS,
  NIVELES,
  groupColor,
} from "../constants";

const defaultGrupo = (formato) => AGE_GROUPS_BY_FORMATO[formato][0];
const defaultCategoria = (genero, grupo) => CATEGORIAS[genero][grupo][0];
const necesitaAnyo = (grupo) => AGE_GROUPS_WITH_ANYO.includes(grupo);

function FilaEquipoEditable({ t, slotsDeEsteEquipo, onGuardado, uid }) {
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
        // Con huecos ya publicados, solo se puede tocar nivel e identificador
        // (cambiar la categoría rompería los huecos ya publicados con datos antiguos).
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
    return (
      <div className="cl-ticket">
        <div className="cl-cat-strip" style={{ background: groupColor(t.grupo) }} />
        <div className="cl-row" style={{ justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700 }}>{t.genero} · {t.grupo}{t.anyo ? ` (${t.anyo})` : ""}{t.identificador ? ` · ${t.identificador}` : ""}</div>
            <div className="cl-mono" style={{ fontSize: "12px", color: "#888" }}>{t.categoria} · {t.nivel}</div>
          </div>
          <div className="cl-row">
            <button className="cl-btn cl-btn-ghost" onClick={() => setEditando(true)}><Pencil size={13} /> Editar</button>
            <button className="cl-btn cl-btn-ghost" onClick={borrar}><Trash2 size={13} /> Borrar</button>
          </div>
        </div>
        {error && <p style={{ color: "var(--clay)", fontSize: "12px", marginTop: "6px" }}>{error}</p>}
      </div>
    );
  }

  return (
    <div className="cl-ticket">
      <div className="cl-cat-strip" style={{ background: groupColor(t.grupo) }} />
      {tieneHuecos && (
        <p style={{ fontSize: "12px", color: "#888", marginBottom: "8px" }}>
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

export default function CoordinadorView({ uid, clubName, telefono, email, teams, slots, jornadas }) {
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
    <div className="cl-grid-3">
      <div>
        <h2 className="cl-display" style={{ fontSize: "22px", color: "var(--pitch-dark)" }}>AÑADIR EQUIPO</h2>
        <div className="cl-ticket">
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
          <button className="cl-btn cl-btn-primary" onClick={handleAddTeam} style={{ justifyContent: "center", width: "100%" }}>
            <Plus size={15} /> Añadir equipo
          </button>
          {addError && <p style={{ color: "var(--clay)", fontSize: "12px", marginTop: "6px" }}>{addError}</p>}
        </div>
      </div>

      <div>
        <h2 className="cl-display" style={{ fontSize: "22px", color: "var(--pitch-dark)" }}>TUS EQUIPOS</h2>
        {teams.length === 0 && <p style={{ color: "#888" }}>Aún no has añadido ningún equipo.</p>}
        <p style={{ fontSize: "13px", color: "#666", marginBottom: "10px" }}>
          Para marcar disponibilidad, gestionar solicitudes y cerrar partidos, ve a la pestaña <b>CUADRANTE</b>.
        </p>
        {teams.map((t) => (
          <FilaEquipoEditable
            key={t.id}
            t={t}
            uid={uid}
            slotsDeEsteEquipo={slots.filter((s) => s.teamId === t.id)}
            onGuardado={() => {}}
          />
        ))}
      </div>
    </div>
  );
}
