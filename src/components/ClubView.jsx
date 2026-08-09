import { useState } from "react";
import { t } from "../i18n";
import AvisoGirarMovil from "./AvisoGirarMovil";
import { ArrowLeft, Search, LayoutGrid, X, MapPin, Handshake, Trophy } from "lucide-react";
import { useClubesOficiales } from "../hooks/useClubesOficiales";
import { useAllTeams, cerrarComoVisitante, hayConflictoDeHorario } from "../hooks/useClubData";
import { useClubProfile, useTodosLosClubes } from "../hooks/useAuth";
import { useInstalaciones } from "../hooks/useInstalaciones";
import { diaCoincideConJornada } from "../validaciones";
import { useJornadas } from "../hooks/useJornadas";
import CuadranteView, { GestionCancelacion } from "./CuadranteView";
import TorneosView from "./TorneosView";
import {
  GENEROS,
  FORMATOS,
  AGE_GROUPS_BY_FORMATO,
  CATEGORIAS,
  FASES,
  NIVELES,
  groupColor,
  HORARIOS_VALIDOS,
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
    if (conflicto) return setError(`Ese campo ya tiene un partido a las ${conflicto.horaExacta}.`);
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
      <select className="cl-input" style={{ width: "auto" }} value={hora} onChange={(e) => setHora(e.target.value)}>
        <option value="">Hora</option>
        {HORARIOS_VALIDOS.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
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
  const porCerrar = allSlots.filter((s) => s.requestedByUid === uid && s.status === "pactado" && s.sede === "visitante");

  if (porCerrar.length === 0) return null;

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

      {porCerrar.length > 0 && (
        <>
          <h2 className="cl-display" style={{ fontSize: "22px", color: "var(--clay)" }}>
            PARTIDOS QUE TIENES QUE CERRAR ({porCerrar.length})
          </h2>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "8px" }}>
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
    </div>
  );
}

// --- Directorio: un club por tarjeta, con acceso a su cuadrante completo ---

// Distancia en línea recta entre dos puntos del mapa (fórmula de Haversine) —
// suficiente para "cuál está más cerca", no hace falta la distancia real por
// carretera.
function distanciaKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function DirectorioClubes({ clubes, onEntrar }) {
  const [orden, setOrden] = useState("distancia");

  const ordenados = [...clubes].sort((a, b) => {
    if (orden === "alfabetico") return a.clubName.localeCompare(b.clubName);
    if (orden === "porcentaje") return b.pctCompletado - a.pctCompletado;
    if (orden === "afinidad") return b.afinidad - a.afinidad;
    if (orden === "distancia") {
      // Cercanía primero — si no se conoce la distancia de alguno, se manda
      // al final (mejor no destacar un club que igual está a 300 km).
      if (a.distanciaKm == null && b.distanciaKm == null) return b.afinidad - a.afinidad;
      if (a.distanciaKm == null) return 1;
      if (b.distanciaKm == null) return -1;
      if (Math.abs(a.distanciaKm - b.distanciaKm) < 5) return b.afinidad - a.afinidad; // a distancia parecida, gana la afinidad
      return a.distanciaKm - b.distanciaKm;
    }
    return 0;
  });

  return (
    <div>
      <div className="cl-row" style={{ marginBottom: "16px" }}>
        <label className="cl-label" style={{ marginBottom: 0 }}>ORDENAR POR</label>
        <select className="cl-input" style={{ width: "auto" }} value={orden} onChange={(e) => setOrden(e.target.value)}>
          <option value="distancia">Más cerca primero</option>
          <option value="afinidad">Afinidad (más partidos posibles)</option>
          <option value="alfabetico">Alfabético</option>
          <option value="porcentaje">% de temporada completado</option>
        </select>
      </div>

      {ordenados.length === 0 && (
        <p className="cl-ticket" style={{ textAlign: "center", color: "var(--text-secondary)" }}>Todavía no hay otros clubes registrados.</p>
      )}

      <div className="cl-grid-2">
        {ordenados.map((c) => (
          <div
            key={c.ownerUid}
            className="cl-ticket cl-club-card"
            onClick={() => onEntrar(c.ownerUid, c.clubName)}
          >
            <div className="cl-row" style={{ justifyContent: "space-between", marginBottom: "10px" }}>
              <span className="cl-row" style={{ gap: "10px" }}>
                {c.escudoUrl ? (
                  <img src={c.escudoUrl} alt="" style={{ width: "36px", height: "36px", objectFit: "contain", borderRadius: "8px" }} />
                ) : (
                  <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "var(--st-disponible)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <LayoutGrid size={16} style={{ color: "var(--primary)" }} />
                  </div>
                )}
                <span className="cl-display" style={{ fontSize: "16px", fontWeight: 700 }}>{c.clubName}</span>
              </span>
            </div>
            <p style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 6px", fontSize: "13px", color: "var(--text-secondary)", marginBottom: "8px" }}>
              <span>{c.numEquipos} equipo{c.numEquipos !== 1 ? "s" : ""}</span>
              {c.distanciaKm != null && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                  · <MapPin size={12} /> {c.distanciaKm < 1 ? "menos de 1 km" : `${c.distanciaKm} km`}
                </span>
              )}
              {c.afinidad > 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontWeight: 600, color: "var(--secondary)" }}>
                  · <Handshake size={12} /> {c.afinidad} posible{c.afinidad !== 1 ? "s" : ""}
                </span>
              )}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ flex: 1, height: "6px", borderRadius: "999px", background: "var(--line)", overflow: "hidden" }}>
                <div style={{ width: `${c.pctCompletado}%`, height: "100%", background: "var(--secondary)", borderRadius: "999px" }} />
              </div>
              <span className="cl-mono" style={{ fontSize: "11.5px", color: "var(--text-secondary)", fontWeight: 600 }}>{c.pctCompletado}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- El cuadrante de un club concreto, con las jornadas cargadas para ese club ---
function CuadranteDeClub({ ownerUid, clubName, allSlots, misEquipos, misJornadas, uid, misClubName, telefono, email, misVerificado, miProfile, onVolver }) {
  const jornadas = useJornadas(ownerUid);
  const teams = useAllTeams().filter((t) => t.ownerUid === ownerUid);
  const slots = allSlots.filter((s) => s.ownerUid === ownerUid);
  const perfilAjeno = useClubProfile(ownerUid);
  const puedeReservar = misVerificado && perfilAjeno?.verificado;

  return (
    <div>
      <button className="cl-btn cl-btn-ghost" onClick={onVolver} style={{ marginBottom: "12px" }}>
        <ArrowLeft size={14} /> {t("busco_rival.volver")}
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
        escudoUrl={perfilAjeno?.escudoUrl}
        puedeReservar={puedeReservar}
        miProfile={miProfile}
      />
    </div>
  );
}

// --- Búsqueda por filtros (la vista detallada de antes, para quien ya sabe qué busca) ---
function FiltroMultiple({ label, opciones, seleccionados, onCambiar, disabled }) {
  const alternar = (op) => {
    onCambiar(seleccionados.includes(op) ? seleccionados.filter((x) => x !== op) : [...seleccionados, op]);
  };
  return (
    <div className="cl-field" style={{ position: "relative" }}>
      <label className="cl-label">{label}{seleccionados.length > 0 ? ` (${seleccionados.length})` : ""}</label>
      <div
        className="cl-input"
        style={{ maxHeight: "120px", overflowY: "auto", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 }}
      >
        {opciones.length === 0 && <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>—</span>}
        {opciones.map((op) => (
          <label key={op} className="cl-row" style={{ fontSize: "13px", padding: "2px 0", cursor: disabled ? "default" : "pointer" }}>
            <input type="checkbox" disabled={disabled} checked={seleccionados.includes(op)} onChange={() => alternar(op)} />
            {op}
          </label>
        ))}
      </div>
    </div>
  );
}

function BusquedaPorFiltros({ uid, allSlots }) {
  const [filterGenero, setFilterGenero] = useState("Todos");
  const [filterFormato, setFilterFormato] = useState("Todos");
  const [filterGrupo, setFilterGrupo] = useState("Todos");
  const [filterCategorias, setFilterCategorias] = useState([]);
  const [filterNiveles, setFilterNiveles] = useState([]);
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
      .filter((s) => filterCategorias.length === 0 || filterCategorias.includes(s.categoria))
      .filter((s) => filterNiveles.length === 0 || filterNiveles.includes(s.nivel))
      .filter((s) => filterFase === "Todas" || s.fase === filterFase)
      .map((s) => s.jornadaLabel)
  )].sort();

  const visible = allSlots.filter((s) => {
    if (s.ownerUid === uid) return false;
    if (s.status !== "libre") return false;
    if (filterGenero !== "Todos" && s.genero !== filterGenero) return false;
    if (filterFormato !== "Todos" && s.formato !== filterFormato) return false;
    if (filterGrupo !== "Todos" && s.grupo !== filterGrupo) return false;
    if (filterCategorias.length > 0 && !filterCategorias.includes(s.categoria)) return false;
    if (filterNiveles.length > 0 && !filterNiveles.includes(s.nivel)) return false;
    if (filterFase !== "Todas" && s.fase !== filterFase) return false;
    if (filterJornada !== "Todas" && s.jornadaLabel !== filterJornada) return false;
    return true;
  });

  return (
    <div>
      <div className="cl-ticket cl-row" style={{ flexWrap: "wrap" }}>
        <div className="cl-field">
          <label className="cl-label">GÉNERO</label>
          <select className="cl-input" value={filterGenero} onChange={(e) => { setFilterGenero(e.target.value); setFilterCategorias([]); }}>
            <option>Todos</option>
            {GENEROS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="cl-field">
          <label className="cl-label">FORMATO</label>
          <select className="cl-input" value={filterFormato} onChange={(e) => { setFilterFormato(e.target.value); setFilterGrupo("Todos"); setFilterCategorias([]); }}>
            <option>Todos</option>
            {FORMATOS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div className="cl-field">
          <label className="cl-label">GRUPO DE EDAD</label>
          <select className="cl-input" value={filterGrupo} onChange={(e) => { setFilterGrupo(e.target.value); setFilterCategorias([]); }} disabled={filterFormato === "Todos"}>
            <option>Todos</option>
            {grupoOptions.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <FiltroMultiple
          label="CATEGORÍA / LIGA"
          opciones={categoriaOptions}
          seleccionados={filterCategorias}
          onCambiar={setFilterCategorias}
          disabled={filterGrupo === "Todos"}
        />
        <FiltroMultiple
          label="NIVEL"
          opciones={NIVELES}
          seleccionados={filterNiveles}
          onCambiar={setFilterNiveles}
        />
        {filterNiveles.length === 1 && (() => {
          const idx = NIVELES.indexOf(filterNiveles[0]);
          const vecinos = [NIVELES[idx - 1], NIVELES[idx + 1]].filter(Boolean);
          if (vecinos.length === 0) return null;
          return (
            <button
              type="button"
              className="cl-btn cl-btn-ghost"
              style={{ alignSelf: "flex-end", fontSize: "12px" }}
              onClick={() => setFilterNiveles([...filterNiveles, ...vecinos])}
            >
              + Nivel superior e inferior
            </button>
          );
        })()}
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

      <AvisoGirarMovil texto="Gira el móvil para ver mejor los resultados" />

      <h2 className="cl-display" style={{ fontSize: "22px", color: "var(--pitch-dark)" }}>{t("busco_rival.resultados")} ({visible.length})</h2>
      {visible.length === 0 && (
        <p className="cl-ticket" style={{ textAlign: "center", color: "var(--text-secondary)" }}>No hay huecos libres que coincidan con tu búsqueda.</p>
      )}
      <div className="cl-grid-2">
        {visible.map((s) => (
          <div key={s.id} className="cl-ticket" style={{ marginBottom: 0 }}>
            <div className="cl-cat-strip" style={{ background: groupColor(s.grupo) }} />
            <span className="cl-display" style={{ fontSize: "19px" }}>{s.clubName} · {s.categoria}</span>
            <p className="cl-mono" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{s.genero} · {s.grupo}{s.anyo ? ` (${s.anyo})` : ""} · nivel {s.nivel}</p>
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

export default function ClubView({ uid, clubName, telefono, email, allSlots, misEquipos, misJornadas, misVerificado, miProfile, teamsPorClub }) {
  // Interruptor de nivel superior — "Rival individual" es todo lo que ya
  // mostraba esta pantalla (con su propio interruptor interno Explorar |
  // Filtros, sin cambios); "Torneos" es TorneosView.jsx, integrado aquí en
  // vez de tener su propia pestaña en el menú inferior.
  const [vistaBuscoRival, setVistaBuscoRival] = useState("individual"); // individual | torneos

  const [modoVista, setModoVista] = useState("directorio"); // directorio | filtros
  const cambiarModoVista = (nuevoModo) => {
    if (typeof document !== "undefined" && document.startViewTransition) {
      document.startViewTransition(() => setModoVista(nuevoModo));
    } else {
      setModoVista(nuevoModo);
    }
  };
  const [clubEntrado, setClubEntrado] = useState(null); // { uid, clubName } | null
  const allTeams = useAllTeams();
  // Todos los hooks se llaman siempre, sin condición, aquí arriba — antes
  // de CUALQUIER return anticipado (el de "torneos" más abajo y el de
  // "rellena coordinador general" después de ese). Si un hook se llama solo
  // en algunas ramas, React se queja de "Rendered fewer hooks than
  // expected" en cuanto cambias de una rama a otra sin desmontar el
  // componente — que es justo lo que hace este interruptor.
  const todosLosPerfiles = useTodosLosClubes();
  const clubesOficiales = useClubesOficiales();

  const switchBuscoRival = (
    <div className="cl-subtabs" style={{ marginBottom: "16px" }}>
      <button className={`cl-subtab ${vistaBuscoRival === "individual" ? "active" : ""}`} onClick={() => setVistaBuscoRival("individual")}>
        <Handshake size={14} style={{ marginRight: "4px" }} /> {t("busco_rival.rival_individual")}
      </button>
      <button className={`cl-subtab ${vistaBuscoRival === "torneos" ? "active" : ""}`} onClick={() => setVistaBuscoRival("torneos")}>
        <Trophy size={14} style={{ marginRight: "4px" }} /> {t("busco_rival.torneos")}
      </button>
    </div>
  );

  if (vistaBuscoRival === "torneos") {
    return (
      <div>
        {switchBuscoRival}
        <TorneosView uid={uid} clubName={clubName} telefono={telefono} email={email} misEquipos={misEquipos} jornadas={misJornadas} teamsPorClub={teamsPorClub} />
      </div>
    );
  }

  const tengoContactoGeneral = !!(miProfile?.coordinadores?.general?.telefono || miProfile?.coordinadores?.general?.email);
  if (!tengoContactoGeneral) {
    return (
      <div>
        {switchBuscoRival}
        <div className="cl-ticket" style={{ borderColor: "var(--gold)" }}>
          <p style={{ fontSize: "14px" }}>
            Antes de buscar rivales, rellena al menos el <b>Coordinador general</b> en
            Ajustes → Coordinadores de contacto — así el rival sabe a quién dirigirse.
          </p>
        </div>
      </div>
    );
  }

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

  const escudoPorUid = Object.fromEntries(todosLosPerfiles.map((p) => [p.uid, p.escudoUrl]));

  // Coordenadas de cada localidad, para calcular distancias reales — se
  // buscan por nombre de club en la lista oficial (que es donde se
  // geocodificó cada localidad una vez).
  const coordsPorNombre = Object.fromEntries(
    clubesOficiales.filter((c) => c.lat != null && c.lng != null).map((c) => [c.nombreLower, { lat: c.lat, lng: c.lng }])
  );
  const misCoords = coordsPorNombre[(clubName || "").trim().toLowerCase()];

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
    const susCoords = coordsPorNombre[(c.clubName || "").trim().toLowerCase()];
    const dist = misCoords && susCoords ? distanciaKm(misCoords.lat, misCoords.lng, susCoords.lat, susCoords.lng) : null;
    return {
      ...c,
      pctCompletado: pct,
      afinidad: calcularAfinidad(susLibres),
      escudoUrl: escudoPorUid[c.ownerUid],
      distanciaKm: dist != null ? Math.round(dist) : null,
    };
  });

  return (
    <div>
      {switchBuscoRival}
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
          miProfile={miProfile}
          onVolver={() => setClubEntrado(null)}
        />
      ) : (
        <>
          <div className="cl-subtabs" style={{ marginBottom: "16px" }}>
            <button className={`cl-subtab ${modoVista === "directorio" ? "active" : ""}`} onClick={() => cambiarModoVista("directorio")}>
              <LayoutGrid size={14} style={{ marginRight: "4px" }} /> {t("busco_rival.explorar")}
            </button>
            <button className={`cl-subtab ${modoVista === "filtros" ? "active" : ""}`} onClick={() => cambiarModoVista("filtros")}>
              <Search size={14} style={{ marginRight: "4px" }} /> {t("busco_rival.filtros")}
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
