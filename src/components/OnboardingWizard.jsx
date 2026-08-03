import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { doc, updateDoc } from "firebase/firestore";
import { functions, db } from "../firebase";
import { CLAVES_COORDINADOR, GENEROS, FORMATOS, AGE_GROUPS_BY_FORMATO, CATEGORIAS, NIVELES } from "../constants";
import { addTeam } from "../hooks/useClubData";
import { addInstalacion } from "../hooks/useInstalaciones";
import { addJornada } from "../hooks/useJornadas";
import { activarNotificaciones, notificacionesSoportadas } from "../hooks/useNotificaciones";

function Progreso({ paso }) {
  return <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Paso {paso} de 5</p>;
}

// --- Paso 1: dirección del club, con autocompletado ---
function PasoClub({ uid, profile, onSiguiente }) {
  const [busqueda, setBusqueda] = useState("");
  const [sugerencias, setSugerencias] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [campo, setCampo] = useState("");
  const [direccion, setDireccion] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [codigoPostal, setCodigoPostal] = useState("");
  const [coords, setCoords] = useState(null);
  const [telefono, setTelefono] = useState(profile.telefono || "");
  const [email, setEmail] = useState(profile.email || "");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  let temporizador = null;
  const buscarDireccion = (texto) => {
    setBusqueda(texto);
    setDireccion("");
    if (temporizador) clearTimeout(temporizador);
    if (texto.trim().length < 3) { setSugerencias([]); return; }
    temporizador = setTimeout(async () => {
      setBuscando(true);
      try {
        const fn = httpsCallable(functions, "autocompletarDireccion");
        const r = await fn({ texto });
        setSugerencias(r.data.sugerencias || []);
      } catch {
        setSugerencias([]);
      }
      setBuscando(false);
    }, 400);
  };

  const elegirSugerencia = async (s) => {
    setBusqueda(s.descripcion);
    setSugerencias([]);
    setBuscando(true);
    try {
      const fn = httpsCallable(functions, "detalleDireccion");
      const r = await fn({ placeId: s.placeId });
      setDireccion(r.data.direccion);
      setLocalidad(r.data.localidad);
      setCodigoPostal(r.data.codigoPostal);
      setCoords(r.data.lat != null ? { lat: r.data.lat, lng: r.data.lng } : null);
    } catch {
      setError("No se ha podido cargar esa dirección, inténtalo de nuevo.");
    }
    setBuscando(false);
  };

  const continuar = async () => {
    if (!direccion || !localidad || !telefono.trim() || !email.trim()) {
      setError("Rellena la dirección (elígela de la lista al escribir) y confirma teléfono y correo.");
      return;
    }
    setGuardando(true);
    setError("");
    try {
      await updateDoc(doc(db, "users", uid), {
        localidad, direccion, codigoPostal, telefono: telefono.trim(), email: email.trim(),
        ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
      });
      if (campo.trim()) {
        await addInstalacion(uid, campo.trim(), direccion);
      }
      onSiguiente();
    } catch (err) {
      setError(err.message || "No se ha podido guardar.");
    }
    setGuardando(false);
  };

  return (
    <div className="cl-auth-box cl-ticket">
      <Progreso paso={1} />
      <h2 className="cl-display" style={{ fontSize: "22px", color: "var(--pitch-dark)" }}>¿Dónde jugáis?</h2>
      <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "14px" }}>
        Así los demás clubes pueden encontraros por cercanía, y ya te queda guardado tu primer campo.
      </p>

      <label className="cl-label">BUSCA TU DIRECCIÓN O CAMPO</label>
      <input className="cl-input" value={busqueda} onChange={(e) => buscarDireccion(e.target.value)} placeholder="Empieza a escribir..." style={{ marginBottom: "4px" }} />
      {buscando && <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Buscando...</p>}
      {sugerencias.length > 0 && (
        <div style={{ border: "1px solid var(--line)", borderRadius: "10px", marginBottom: "8px", overflow: "hidden" }}>
          {sugerencias.map((s) => (
            <div key={s.placeId} onClick={() => elegirSugerencia(s)} style={{ padding: "8px 10px", fontSize: "13px", cursor: "pointer", borderBottom: "1px solid var(--line)" }}>
              {s.descripcion}
            </div>
          ))}
        </div>
      )}
      {direccion && (
        <p style={{ fontSize: "12px", color: "var(--secondary)", marginBottom: "10px" }}>✓ {direccion}</p>
      )}

      <label className="cl-label">NOMBRE DEL CAMPO (opcional)</label>
      <input className="cl-input" value={campo} onChange={(e) => setCampo(e.target.value)} placeholder="Ej. Camp Municipal" style={{ marginBottom: "10px" }} />

      <div className="cl-row" style={{ marginBottom: "10px" }}>
        <div className="cl-field">
          <label className="cl-label">TELÉFONO DEL CLUB</label>
          <input className="cl-input" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        </div>
        <div className="cl-field">
          <label className="cl-label">CORREO DEL CLUB</label>
          <input className="cl-input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>

      {error && <p style={{ color: "var(--clay)", fontSize: "12px", marginBottom: "10px" }}>{error}</p>}
      <button className="cl-btn cl-btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={continuar} disabled={guardando}>
        {guardando ? "Guardando..." : "Continuar"}
      </button>
    </div>
  );
}

// --- Paso 2: coordinadores ---
function PasoCoordinadores({ uid, profile, onSiguiente }) {
  const [cuantos, setCuantos] = useState(null);
  const [datos, setDatos] = useState({});
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const actualizar = (clave, campo, valor) => {
    setDatos((prev) => ({ ...prev, [clave]: { ...prev[clave], [campo]: valor } }));
  };

  const clavesAMostrar = cuantos === 1 ? [CLAVES_COORDINADOR[0]] : CLAVES_COORDINADOR.slice(0, cuantos || 0);

  const continuar = async () => {
    let coordinadores = {};
    if (cuantos === 1) {
      coordinadores = { general: { nombre: profile.clubName, telefono: profile.telefono || "", email: profile.email || "" } };
    } else {
      for (const c of clavesAMostrar) {
        const d = datos[c.clave];
        if (!d?.nombre?.trim() || !d?.telefono?.trim()) {
          setError(`Rellena al menos nombre y teléfono para "${c.label}".`);
          return;
        }
        coordinadores[c.clave] = { nombre: d.nombre.trim(), telefono: d.telefono.trim(), email: (d.email || "").trim() };
      }
    }
    setGuardando(true);
    setError("");
    try {
      await updateDoc(doc(db, "users", uid), { coordinadores });
      onSiguiente();
    } catch (err) {
      setError(err.message || "No se ha podido guardar.");
    }
    setGuardando(false);
  };

  return (
    <div className="cl-auth-box cl-ticket">
      <Progreso paso={2} />
      <h2 className="cl-display" style={{ fontSize: "22px", color: "var(--pitch-dark)" }}>¿Quién coordina?</h2>
      <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "14px" }}>
        Así el WhatsApp y los avisos llegan a la persona correcta de cada categoría.
      </p>

      {cuantos == null && (
        <>
          <label className="cl-label">¿CUÁNTAS PERSONAS GESTIONARÉIS LA APP?</label>
          <div className="cl-row" style={{ marginBottom: "10px" }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} className="cl-btn cl-btn-ghost" onClick={() => setCuantos(n)}>{n === 5 ? "5 o más" : n}</button>
            ))}
          </div>
        </>
      )}

      {cuantos === 1 && (
        <p style={{ fontSize: "13px", color: "var(--secondary)", marginBottom: "10px" }}>
          ✓ Perfecto — usaremos tus propios datos ({profile.telefono}, {profile.email}) como coordinador general.
        </p>
      )}

      {cuantos > 1 && clavesAMostrar.map((c) => (
        <div key={c.clave} style={{ marginBottom: "12px", paddingBottom: "12px", borderBottom: "1px solid var(--line)" }}>
          <p style={{ fontSize: "13px", fontWeight: 700, marginBottom: "6px" }}>{c.label}</p>
          <input className="cl-input" placeholder="Nombre" value={datos[c.clave]?.nombre || ""} onChange={(e) => actualizar(c.clave, "nombre", e.target.value)} style={{ marginBottom: "6px" }} />
          <div className="cl-row">
            <input className="cl-input" placeholder="Teléfono" value={datos[c.clave]?.telefono || ""} onChange={(e) => actualizar(c.clave, "telefono", e.target.value)} />
            <input className="cl-input" placeholder="Correo (opcional)" value={datos[c.clave]?.email || ""} onChange={(e) => actualizar(c.clave, "email", e.target.value)} />
          </div>
        </div>
      ))}

      {error && <p style={{ color: "var(--clay)", fontSize: "12px", marginBottom: "10px" }}>{error}</p>}
      {cuantos != null && (
        <button className="cl-btn cl-btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={continuar} disabled={guardando}>
          {guardando ? "Guardando..." : "Continuar"}
        </button>
      )}
    </div>
  );
}

// --- Paso 3: notificaciones (reutiliza la lógica ya existente) ---
function PasoNotificaciones({ uid, onSiguiente }) {
  const [estado, setEstado] = useState("inicial");
  const [error, setError] = useState("");

  const activar = async () => {
    setEstado("activando");
    setError("");
    try {
      await activarNotificaciones(uid);
      onSiguiente();
    } catch (err) {
      setError((err.message || "No se ha podido activar.") + " Puedes intentarlo más tarde desde Ajustes.");
      setEstado("error");
    }
  };

  return (
    <div className="cl-auth-box cl-ticket">
      <Progreso paso={3} />
      <h2 className="cl-display" style={{ fontSize: "22px", color: "var(--pitch-dark)" }}>Activa los avisos</h2>
      <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "14px" }}>
        Para enterarte al momento de solicitudes, propuestas y cancelaciones — sin tener que estar mirando la app.
      </p>
      {error && <p style={{ color: "var(--clay)", fontSize: "12px", marginBottom: "10px" }}>{error}</p>}
      <button className="cl-btn cl-btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={activar} disabled={estado === "activando"}>
        {estado === "activando" ? "Activando..." : estado === "error" ? "Reintentar" : "Activar notificaciones"}
      </button>
      {estado === "error" && (
        <button className="cl-btn cl-btn-ghost" style={{ width: "100%", justifyContent: "center", marginTop: "8px" }} onClick={onSiguiente}>
          Continuar de todas formas
        </button>
      )}
    </div>
  );
}

// --- Paso 4: primer equipo (opcional) ---
function PasoEquipo({ uid, profile, onSiguiente }) {
  const [genero, setGenero] = useState(GENEROS[0]);
  const [formato, setFormato] = useState(FORMATOS[0]);
  const [grupo, setGrupo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [nivel, setNivel] = useState(NIVELES[3]);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const grupoOptions = AGE_GROUPS_BY_FORMATO[formato] || [];
  const categoriaOptions = grupo ? (CATEGORIAS[genero]?.[grupo] || []) : [];

  const guardar = async () => {
    if (!grupo || !categoria) {
      setError("Elige al menos categoría de edad y liga.");
      return;
    }
    setGuardando(true);
    setError("");
    try {
      await addTeam(uid, profile.clubName, { genero, formato, grupo, categoria, nivel, ownerTelefono: profile.telefono, ownerEmail: profile.email });
      onSiguiente();
    } catch (err) {
      setError(err.message || "No se ha podido guardar.");
    }
    setGuardando(false);
  };

  return (
    <div className="cl-auth-box cl-ticket">
      <Progreso paso={4} />
      <h2 className="cl-display" style={{ fontSize: "22px", color: "var(--pitch-dark)" }}>Añade tu primer equipo</h2>
      <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "14px" }}>
        Puedes añadir más (o cambiar este) luego desde Mi Club — este es solo para empezar.
      </p>

      <div className="cl-row" style={{ marginBottom: "8px" }}>
        <select className="cl-input" value={genero} onChange={(e) => setGenero(e.target.value)}>
          {GENEROS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select className="cl-input" value={formato} onChange={(e) => { setFormato(e.target.value); setGrupo(""); setCategoria(""); }}>
          {FORMATOS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>
      <div className="cl-row" style={{ marginBottom: "8px" }}>
        <select className="cl-input" value={grupo} onChange={(e) => { setGrupo(e.target.value); setCategoria(""); }}>
          <option value="">Categoría de edad</option>
          {grupoOptions.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select className="cl-input" value={categoria} onChange={(e) => setCategoria(e.target.value)} disabled={!grupo}>
          <option value="">Liga/competición</option>
          {categoriaOptions.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <label className="cl-label">NIVEL</label>
      <select className="cl-input" value={nivel} onChange={(e) => setNivel(e.target.value)} style={{ marginBottom: "12px" }}>
        {NIVELES.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>

      {error && <p style={{ color: "var(--clay)", fontSize: "12px", marginBottom: "10px" }}>{error}</p>}
      <button className="cl-btn cl-btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={guardar} disabled={guardando}>
        {guardando ? "Guardando..." : "Guardar y continuar"}
      </button>
      <button className="cl-btn cl-btn-ghost" style={{ width: "100%", justifyContent: "center", marginTop: "8px" }} onClick={onSiguiente}>
        Saltar por ahora, lo añado más tarde
      </button>
    </div>
  );
}

// --- Paso 5: primera jornada (opcional) ---
function PasoJornada({ uid, onTerminar }) {
  const [label, setLabel] = useState("");
  const [fecha, setFecha] = useState("");
  const [fase, setFase] = useState("Pretemporada");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!label.trim() || !fecha) {
      setError("Rellena la etiqueta y la fecha.");
      return;
    }
    setGuardando(true);
    setError("");
    try {
      await addJornada(uid, { label: label.trim(), orderDate: fecha, fase });
      onTerminar();
    } catch (err) {
      setError(err.message || "No se ha podido guardar.");
    }
    setGuardando(false);
  };

  return (
    <div className="cl-auth-box cl-ticket">
      <Progreso paso={5} />
      <h2 className="cl-display" style={{ fontSize: "22px", color: "var(--pitch-dark)" }}>Crea tu primera jornada</h2>
      <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "14px" }}>
        El primer fin de semana en el que queréis jugar amistosos — luego puedes añadir más.
      </p>

      <label className="cl-label">ETIQUETA</label>
      <input className="cl-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ej. 5-6 septiembre" style={{ marginBottom: "10px" }} />
      <label className="cl-label">FECHA DE REFERENCIA</label>
      <input type="date" className="cl-input" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ marginBottom: "10px" }} />
      <label className="cl-label">FASE</label>
      <select className="cl-input" value={fase} onChange={(e) => setFase(e.target.value)} style={{ marginBottom: "12px" }}>
        <option value="Pretemporada">Pretemporada</option>
        <option value="Postemporada">Postemporada</option>
      </select>

      {error && <p style={{ color: "var(--clay)", fontSize: "12px", marginBottom: "10px" }}>{error}</p>}
      <button className="cl-btn cl-btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={guardar} disabled={guardando}>
        {guardando ? "Guardando..." : "Crear y entrar en la app"}
      </button>
      <button className="cl-btn cl-btn-ghost" style={{ width: "100%", justifyContent: "center", marginTop: "8px" }} onClick={onTerminar}>
        Saltar por ahora, lo añado más tarde
      </button>
    </div>
  );
}

export default function OnboardingWizard({ uid, profile, onTerminado }) {
  const [paso, setPaso] = useState(1);

  if (paso === 1) return <PasoClub uid={uid} profile={profile} onSiguiente={() => setPaso(2)} />;
  if (paso === 2) return <PasoCoordinadores uid={uid} profile={profile} onSiguiente={() => setPaso(3)} />;
  if (paso === 3) return <PasoNotificaciones uid={uid} onSiguiente={() => setPaso(4)} />;
  if (paso === 4) return <PasoEquipo uid={uid} profile={profile} onSiguiente={() => setPaso(5)} />;
  return <PasoJornada uid={uid} onTerminar={onTerminado} />;
}
