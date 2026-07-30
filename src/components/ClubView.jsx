import { useState } from "react";
import { ArrowLeft, Search, LayoutGrid, X } from "lucide-react";
import { useAllTeams, cerrarComoVisitante, hayConflictoDeHorario } from "../hooks/useClubData";
import { useClubProfile } from "../hooks/useAuth";
import { useInstalaciones } from "../hooks/useInstalaciones";
import { diaCoincideConJornada } from "../validaciones";
import { useJornadas } from "../hooks/useJornadas";
import CuadranteView, { GestionCancelacion } from "./CuadranteView";
import {
  GENEROS,
  FORMATOS,
  AGE_GROUPS_BY_FORMATO,
  CATEGORIAS,
  FASES,
  groupColor,
} from "../constants";

// Formulario compacto para cerrar día/hora/campo cuando juegas como visitante.
function CierrePartido({ slot, allSlots, onCerrar, uid }) {
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
    if (conflicto) return setError(`Ese campo ya tiene un partido a las ${conflicto.horaExacta}, deja al menos 10 min de descanso.`);
    setError("");
    setGuardando(true);
    try {
      await onCerrar({ diaExacto: dia, horaExacta: hora, campoExacto: campo });
    } catch (err) {
      setError(err.message || "No se ha podido guardar.");
    }
    setGuardando(false);
  };

  return (
    <div className="cl-row" style={{ flexWrap: "wrap", marginTop: "8px" }}>
      <input type="date" className="cl-input" style={{ width: "auto" }} value={dia} onChange={(e) => setDia(e.target.value)} />
      <input type="time" className="cl-input" style={{ width: "auto" }} value={hora} onChange={(e) => setHora(e.target.value)} />
      <input placeholder="Campo" className="cl-input" style={{ width: "auto" }} value={campo} onChange={(e) => setCampo(e.target.value)} maxLength={60} list="instalaciones-visitante" />
      <datalist id="instalaciones-visitante">
        {instalaciones.map((i) => <option key={i.id} value={i.nombre} />)}
      </datalist>
      <button className="cl-btn cl-btn-primary" onClick={confirmar} disabled={guardando}>
        {guardando ? "Comprobando..." : "Cerrar partido"}
      </button>
      {error && <p style={{ color: "var(--clay)", fontSize: "12px", width: "100%" }}>{error}</p>}
    </div>
  );
}

// Siempre visible arriba del todo: todo lo que tienes en marcha en OTROS
// clubes (donde tú eres quien reservó), sea cual sea la sede — porque este
// club no tiene ningún otro sitio donde verlo (el partido vive en el
// calendario del club dueño, no en el tuyo).
function TusGestionesComoVisitante({ uid, allSlots }) {
  const [error, setError] = useState("");
  const pendientes = allSlots.filter((s) => s.requestedByUid === uid && s.status === "pendiente");
  const pactadoSinSede = allSlots.filter((s) => s.requestedByUid === uid && s.status === "pactado" && !s.sede);
  const porCerrar = allSlots.filter((s) => s.requestedByUid === uid && s.status === "pactado" && s.sede === "visitante");
  const pactadosEnSuCampo = allSlots.filter((s) => s.requestedByUid === uid && s.status === "pactado" && s.sede === "local");
  const confirmados = allSlots.filter((s) => s.requestedByUid === uid && s.status === "confirmado");

  if (pendientes.length + pactadoSinSede.length + porCerrar.length + pactadosEnSuCampo.length + confirmados.length === 0) return null;

  const ejecutar = async (fn) => {
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err.message || "No se ha podido completar la acción.");
    }
  };

  return (
    <div style={{ marginBottom: "24px" }}>
      {error && <p className="cl-ticket" style={{ color: "var(--clay)", borderColor: "var(--clay)", fontSize: "13px" }}>{error}</p>}

      {pendientes.length > 0 && (
        <>
          <h2 className="cl-display" style={{ fontSize: "20px", color: "var(--pitch)" }}>
            SOLICITUDES ENVIADAS, ESPERANDO RESPUESTA ({pendientes.length})
          </h2>
          {pendientes.map((s) => (
            <div key={s.id} className="cl-ticket">
              <div className="cl-cat-strip" style={{ background: groupColor(s.grupo) }} />
              <p style={{ fontSize: "13px" }}>A <b>{s.clubName}</b> · {s.grupo}{s.anyo ? ` (${s.anyo})` : ""} · {s.jornadaLabel}</p>
              <p style={{ fontSize: "12px", color: "#888" }}>Esperando a que acepten o rechacen.</p>
            </div>
          ))}
        </>
      )}

      {pactadoSinSede.length > 0 && (
        <>
          <h2 className="cl-display" style={{ fontSize: "20px", color: "var(--pitch)" }}>
            PACTADOS, ESPERANDO DÓNDE SE JUEGA ({pactadoSinSede.length})
          </h2>
          {pactadoSinSede.map((s) => (
            <div key={s.id} className="cl-ticket">
              <div className="cl-cat-strip" style={{ background: groupColor(s.grupo) }} />
              <p style={{ fontSize: "13px" }}>Contra <b>{s.clubName}</b> · {s.grupo}{s.anyo ? ` (${s.anyo})` : ""} · {s.jornadaLabel}</p>
              <p style={{ fontSize: "12px", color: "#888" }}>Aceptado — falta que ellos decidan si se juega en su campo o en el vuestro.</p>
              <GestionCancelacion slot={s} uid={uid} ejecutar={ejecutar} />
            </div>
          ))}
        </>
      )}

      {porCerrar.length > 0 && (
        <>
          <h2 className="cl-display" style={{ fontSize: "22px", color: "var(--clay)" }}>
            PARTIDOS QUE TIENES QUE CERRAR ({porCerrar.length})
          </h2>
          <p style={{ fontSize: "13px", color: "#666", marginBottom: "8px" }}>
            Se decidió jugar en vuestro campo — di día, hora y campo exactos cuando lo tengas claro.
          </p>
          {porCerrar.map((s) => (
            <div key={s.id} className="cl-ticket" style={{ borderColor: "var(--gold)" }}>
              <div className="cl-cat-strip" style={{ background: groupColor(s.grupo) }} />
              <p style={{ fontSize: "13px" }}>Contra <b>{s.clubName}</b> · {s.grupo}{s.anyo ? ` (${s.anyo})` : ""} · {s.jornadaLabel}</p>
              <CierrePartido
                slot={s}
                allSlots={allSlots}
                uid={uid}
                onCerrar={(datos) => cerrarComoVisitante(s.id, { ...datos, grupo: s.grupo, teamId: s.teamId }, allSlots)}
              />
              <GestionCancelacion slot={s} uid={uid} ejecutar={ejecutar} />
            </div>
          ))}
        </>
      )}

      {pactadosEnSuCampo.length > 0 && (
        <>
          <h2 className="cl-display" style={{ fontSize: "20px", color: "var(--pitch-dark)", marginTop: "12px" }}>
            PACTADOS EN CAMPO DEL RIVAL ({pactadosEnSuCampo.length})
          </h2>
          {pactadosEnSuCampo.map((s) => (
            <div key={s.id} className="cl-ticket">
              <div className="cl-cat-strip" style={{ background: groupColor(s.grupo) }} />
              <p style={{ fontSize: "13px" }}>
                Contra <b>{s.clubName}</b> · {s.grupo}{s.anyo ? ` (${s.anyo})` : ""} · {s.jornadaLabel}
              </p>
              <p style={{ fontSize: "12px", color: "#888" }}>Falta que ellos cierren día/hora/campo (juegan en su campo, lo deciden ellos).</p>
              <GestionCancelacion slot={s} uid={uid} ejecutar={ejecutar} />
            </div>
          ))}
        </>
      )}

      {confirmados.length > 0 && (
        <>
          <h2 className="cl-display" style={{ fontSize: "20px", color: "var(--pitch-dark)", marginTop: "12px" }}>
            TUS PARTIDOS CONFIRMADOS ({confirmados.length})
          </h2>
          {confirmados.map((s) => (
            <div key={s.id} className="cl-ticket">
              <div className="cl-cat-strip" style={{ background: groupColor(s.grupo) }} />
              <div className="cl-row" style={{ justifyContent: "space-between" }}>
                <p style={{ fontSize: "13px" }}>
                  Contra <b>{s.clubName}</b> · {s.diaExacto} {s.horaExacta} · {s.campoExacto}
                  {s.sede === "local" ? " (en su campo)" : " (en el vuestro)"}
                </p>
              </div>
              <GestionCancelacion slot={s} uid={uid} ejecutar={ejecutar} />
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// --- Directorio: un club por tarjeta, con acceso a su cuadrante completo ---
function DirectorioClubes({ clubes, onEntrar }) {
  const [orden, setOrden] = useState("afinidad");

  const ordenados = [...clubes].sort((a, b) => {
    if (orden === "alfabetico") return a.clubName.localeCompare(b.clubName);
    if (orden === "porcentaje") return b.pctCompletado - a.pctCompletado;
    if (orden === "afinidad") return b.afinidad - a.afinidad;
    return 0;
  });

  return (
    <div>
      <div className="cl-row" style={{ marginBottom: "16px" }}>
        <label className="cl-label" style={{ marginBottom: 0 }}>ORDENAR POR</label>
        <select className="cl-input" style={{ width: "auto" }} value={orden} onChange={(e) => setOrden(e.target.value)}>
          <option value="afinidad">Afinidad (más partidos posibles)</option>
          <option value="alfabetico">Alfabético</option>
          <option value="porcentaje">% de temporada completado</option>
        </select>
      </div>

      {ordenados.length === 0 && (
        <p className="cl-ticket" style={{ textAlign: "center", color: "#888" }}>Todavía no hay otros clubes registrados.</p>
      )}

      <div className="cl-grid-2">
        {ordenados.map((c) => (
          <div key={c.ownerUid} className="cl-ticket" style={{ cursor: "pointer" }} onClick={() => onEntrar(c.ownerUid, c.clubName)}>
            <div className="cl-row" style={{ justifyContent: "space-between" }}>
              <span className="cl-display" style={{ fontSize: "20px" }}>{c.clubName}</span>
              <LayoutGrid size={16} style={{ color: "var(--pitch)" }} />
            </div>
            <p style={{ fontSize: "13px", color: "#666" }}>{c.numEquipos} equipo{c.numEquipos !== 1 ? "s" : ""}</p>
            {c.afinidad > 0 && (
              <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gold)" }}>
                🤝 {c.afinidad} partido{c.afinidad !== 1 ? "s" : ""} posible{c.afinidad !== 1 ? "s" : ""}
              </p>
            )}
            <p className="cl-mono" style={{ fontSize: "12px", color: "var(--pitch)" }}>{c.pctCompletado}% de la temporada cerrado</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- El cuadrante de un club concreto, con las jornadas cargadas para ese club ---
function CuadranteDeClub({ ownerUid, clubName, allSlots, misEquipos, misJornadas, uid, misClubName, telefono, email, misVerificado, onVolver }) {
  const jornadas = useJornadas(ownerUid);
  const teams = useAllTeams().filter((t) => t.ownerUid === ownerUid);
  const slots = allSlots.filter((s) => s.ownerUid === ownerUid);
  const perfilAjeno = useClubProfile(ownerUid);
  const puedeReservar = misVerificado && perfilAjeno?.verificado;

  return (
    <div>
      <button className="cl-btn cl-btn-ghost" onClick={onVolver} style={{ marginBottom: "12px" }}>
        <ArrowLeft size={14} /> Volver al directorio
      </button>
      {!puedeReservar && (
        <p className="cl-ticket" style={{ borderColor: "var(--gold)", fontSize: "13px" }}>
          {!misVerificado
            ? "Tu club todavía no está verificado — de momento puedes ver este cuadrante, pero no reservar. En cuanto un administrador confirme tu teléfono, podrás hacerlo."
            : `${clubName} todavía no está verificado por un administrador — puedes ver su cuadrante, pero no reservar todavía.`}
        </p>
      )}
      <CuadranteView
        clubName={clubName}
        teams={teams}
        slots={slots}
        jornadas={jornadas}
        modo="ajeno"
        allSlots={allSlots}
        misEquipos={misEquipos}
        misJornadas={misJornadas}
        uid={uid}
        misClubName={misClubName}
        telefono={telefono}
        email={email}
        puedeReservar={puedeReservar}
      />
    </div>
  );
}

// --- Búsqueda por filtros (la vista detallada de antes, para quien ya sabe qué busca) ---
function BusquedaPorFiltros({ uid, allSlots }) {
  const [filterGenero, setFilterGenero] = useState("Todos");
  const [filterFormato, setFilterFormato] = useState("Todos");
  const [filterGrupo, setFilterGrupo] = useState("Todos");
  const [filterCategoria, setFilterCategoria] = useState("Todas");
  const [filterFase, setFilterFase] = useState("Todas");
  const [filterJornada, setFilterJornada] = useState("Todas");

  const grupoOptions = filterFormato !== "Todos" ? AGE_GROUPS_BY_FORMATO[filterFormato] : [];
  const categoriaOptions = filterGenero !== "Todos" && filterGrupo !== "Todos" ? CATEGORIAS[filterGenero][filterGrupo] : [];

  // Las jornadas disponibles para elegir se calculan a partir de los huecos libres
  // que ya cumplen el resto de filtros — así la lista no se llena de fechas que
  // luego no van a dar ningún resultado.
  const jornadaOptions = [...new Set(
    allSlots
      .filter((s) => s.ownerUid !== uid && s.status === "libre")
      .filter((s) => filterGenero === "Todos" || s.genero === filterGenero)
      .filter((s) => filterFormato === "Todos" || s.formato === filterFormato)
      .filter((s) => filterGrupo === "Todos" || s.grupo === filterGrupo)
      .filter((s) => filterFase === "Todas" || s.fase === filterFase)
      .map((s) => s.jornadaLabel)
  )].sort();

  const visible = allSlots.filter((s) => {
    if (s.ownerUid === uid) return false;
    if (s.status !== "libre") return false;
    if (filterGenero !== "Todos" && s.genero !== filterGenero) return false;
    if (filterFormato !== "Todos" && s.formato !== filterFormato) return false;
    if (filterGrupo !== "Todos" && s.grupo !== filterGrupo) return false;
    if (filterCategoria !== "Todas" && s.categoria !== filterCategoria) return false;
    if (filterFase !== "Todas" && s.fase !== filterFase) return false;
    if (filterJornada !== "Todas" && s.jornadaLabel !== filterJornada) return false;
    return true;
  });

  return (
    <div>
      <div className="cl-ticket cl-row" style={{ flexWrap: "wrap" }}>
        <div className="cl-field">
          <label className="cl-label">GÉNERO</label>
          <select className="cl-input" value={filterGenero} onChange={(e) => { setFilterGenero(e.target.value); setFilterCategoria("Todas"); }}>
            <option>Todos</option>
            {GENEROS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="cl-field">
          <label className="cl-label">FORMATO</label>
          <select className="cl-input" value={filterFormato} onChange={(e) => { setFilterFormato(e.target.value); setFilterGrupo("Todos"); setFilterCategoria("Todas"); }}>
            <option>Todos</option>
            {FORMATOS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div className="cl-field">
          <label className="cl-label">GRUPO DE EDAD</label>
          <select className="cl-input" value={filterGrupo} onChange={(e) => { setFilterGrupo(e.target.value); setFilterCategoria("Todas"); }} disabled={filterFormato === "Todos"}>
            <option>Todos</option>
            {grupoOptions.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="cl-field">
          <label className="cl-label">CATEGORÍA / LIGA</label>
          <select className="cl-input" value={filterCategoria} onChange={(e) => setFilterCategoria(e.target.value)} disabled={filterGrupo === "Todos"}>
            <option>Todas</option>
            {categoriaOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="cl-field">
          <label className="cl-label">FASE</label>
          <select className="cl-input" value={filterFase} onChange={(e) => { setFilterFase(e.target.value); setFilterJornada("Todas"); }}>
            <option value="Todas">Todas</option>
            {FASES.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div className="cl-field">
          <label className="cl-label">JORNADA EXACTA</label>
          <select className="cl-input" value={filterJornada} onChange={(e) => setFilterJornada(e.target.value)}>
            <option value="Todas">Todas</option>
            {jornadaOptions.map((j) => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>
      </div>

      <h2 className="cl-display" style={{ fontSize: "22px", color: "var(--pitch-dark)" }}>RESULTADOS ({visible.length})</h2>
      {visible.length === 0 && (
        <p className="cl-ticket" style={{ textAlign: "center", color: "#888" }}>No hay huecos libres que coincidan con tu búsqueda.</p>
      )}
      <div className="cl-grid-2">
        {visible.map((s) => (
          <div key={s.id} className="cl-ticket" style={{ marginBottom: 0 }}>
            <div className="cl-cat-strip" style={{ background: groupColor(s.grupo) }} />
            <span className="cl-display" style={{ fontSize: "19px" }}>{s.clubName} · {s.categoria}</span>
            <p className="cl-mono" style={{ fontSize: "12px", color: "#888" }}>{s.genero} · {s.grupo}{s.anyo ? ` (${s.anyo})` : ""} · nivel {s.nivel}</p>
            <p style={{ fontSize: "13px" }}>{s.jornadaLabel}</p>
            {(s.ownerTelefono || s.ownerEmail) && (
              <p className="cl-mono" style={{ fontSize: "12px", color: "var(--pitch)" }}>Contacto: {s.ownerTelefono} {s.ownerEmail}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ClubView({ uid, clubName, telefono, email, allSlots, misEquipos, misJornadas, misVerificado }) {
  const [modoVista, setModoVista] = useState("directorio"); // directorio | filtros
  const [clubEntrado, setClubEntrado] = useState(null); // { uid, clubName } | null
  const allTeams = useAllTeams();

  const misSlotsLibres = allSlots.filter((s) => s.ownerUid === uid && s.status === "libre");

  // Cuenta cuántas parejas (uno de mis equipos libre + uno suyo libre) coinciden
  // en género, grupo de edad y comparten una jornada con el mismo nombre — cada
  // coincidencia es, en la práctica, un partido que hoy mismo se podría cerrar.
  const calcularAfinidad = (susSlotsLibres) => {
    let total = 0;
    misSlotsLibres.forEach((mio) => {
      susSlotsLibres.forEach((suyo) => {
        if (mio.genero !== suyo.genero) return;
        if (mio.grupo !== suyo.grupo) return;
        if ((mio.jornadaLabel || "").trim().toLowerCase() !== (suyo.jornadaLabel || "").trim().toLowerCase()) return;
        total += 1;
      });
    });
    return total;
  };

  const clubes = Object.values(
    allTeams
      .filter((t) => t.ownerUid !== uid)
      .reduce((acc, t) => {
        if (!acc[t.ownerUid]) acc[t.ownerUid] = { ownerUid: t.ownerUid, clubName: t.clubName, numEquipos: 0 };
        acc[t.ownerUid].numEquipos += 1;
        return acc;
      }, {})
  ).map((c) => {
    const slotsDelClub = allSlots.filter((s) => s.ownerUid === c.ownerUid);
    const cerrados = slotsDelClub.filter((s) => ["pendiente", "pactado", "confirmado"].includes(s.status)).length;
    const pct = slotsDelClub.length > 0 ? Math.round((cerrados / slotsDelClub.length) * 100) : 0;
    const susLibres = slotsDelClub.filter((s) => s.status === "libre");
    return { ...c, pctCompletado: pct, afinidad: calcularAfinidad(susLibres) };
  });

  return (
    <div>
      <TusGestionesComoVisitante uid={uid} allSlots={allSlots} />

      {clubEntrado ? (
        <CuadranteDeClub
          ownerUid={clubEntrado.uid}
          clubName={clubEntrado.clubName}
          allSlots={allSlots}
          misEquipos={misEquipos}
          misJornadas={misJornadas}
          uid={uid}
          misClubName={clubName}
          telefono={telefono}
          email={email}
          misVerificado={misVerificado}
          onVolver={() => setClubEntrado(null)}
        />
      ) : (
        <>
          <div className="cl-tabs" style={{ marginBottom: "16px" }}>
            <button className={`cl-tab ${modoVista === "directorio" ? "active" : ""}`} onClick={() => setModoVista("directorio")}>
              <LayoutGrid size={14} style={{ marginRight: "4px" }} /> EXPLORAR CLUBES
            </button>
            <button className={`cl-tab ${modoVista === "filtros" ? "active" : ""}`} onClick={() => setModoVista("filtros")}>
              <Search size={14} style={{ marginRight: "4px" }} /> BÚSQUEDA POR FILTROS
            </button>
          </div>

          {modoVista === "directorio" ? (
            <DirectorioClubes clubes={clubes} onEntrar={(ownerUid, cName) => setClubEntrado({ uid: ownerUid, clubName: cName })} />
          ) : (
            <BusquedaPorFiltros uid={uid} allSlots={allSlots} />
          )}
        </>
      )}
    </div>
  );
}
