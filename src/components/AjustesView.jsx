import { useState } from "react";
import { Save, Trash2, Plus, ShieldCheck, AlertTriangle, Download, Check } from "lucide-react";
import PoliticaPrivacidad from "./PoliticaPrivacidad";
import { telefonoValido, LIMITES } from "../validaciones";
import { useInstalaciones, addInstalacion, deleteInstalacion } from "../hooks/useInstalaciones";
import { useTodosLosClubes } from "../hooks/useAuth";
import {
  useClubesOficiales,
  useSolicitudesClub,
  añadirClubOficial,
  eliminarClubOficial,
  importarClubesSemilla,
  marcarSolicitudAtendida,
} from "../hooks/useClubesOficiales";

function PanelAdmin({ onVerificar }) {
  const clubes = useTodosLosClubes();
  const clubesOficiales = useClubesOficiales();
  const solicitudes = useSolicitudesClub();
  const [error, setError] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevaLocalidad, setNuevaLocalidad] = useState("");
  const [importando, setImportando] = useState(false);
  const [avisoImport, setAvisoImport] = useState("");

  const cambiar = async (uidClub, valor) => {
    setError("");
    try {
      await onVerificar(uidClub, valor);
    } catch (err) {
      setError(err.message || "No se ha podido cambiar.");
    }
  };

  // Detectar posibles duplicados por nombre de club, para la alarma.
  const contador = {};
  clubes.forEach((c) => {
    const key = (c.clubNameLower || c.clubName || "").trim();
    if (!key) return;
    contador[key] = (contador[key] || 0) + 1;
  });
  const nombresDuplicados = new Set(Object.keys(contador).filter((k) => contador[k] > 1));
  const clubesDuplicados = clubes.filter((c) => nombresDuplicados.has((c.clubNameLower || c.clubName || "").trim()));

  const importar = async () => {
    setImportando(true);
    setAvisoImport("");
    try {
      const n = await importarClubesSemilla();
      setAvisoImport(`Importados ${n} clubes nuevos (los que ya existían no se han tocado).`);
    } catch (err) {
      setAvisoImport(err.message || "No se ha podido importar.");
    }
    setImportando(false);
  };

  const añadirManual = async () => {
    if (!nuevoNombre.trim()) return;
    setError("");
    try {
      await añadirClubOficial(nuevoNombre, nuevaLocalidad);
      setNuevoNombre("");
      setNuevaLocalidad("");
    } catch (err) {
      setError(err.message || "No se ha podido añadir.");
    }
  };

  const atenderSolicitud = async (s) => {
    setError("");
    try {
      await añadirClubOficial(s.nombreSolicitado, "");
      await marcarSolicitudAtendida(s.id);
    } catch (err) {
      setError(err.message || "No se ha podido procesar la solicitud.");
    }
  };

  return (
    <div>
      <h2 className="cl-display" style={{ fontSize: "22px", color: "var(--pitch-dark)" }}>
        <ShieldCheck size={18} style={{ verticalAlign: "-3px" }} /> ADMINISTRACIÓN
      </h2>
      {error && <p style={{ color: "var(--clay)", fontSize: "12px" }}>{error}</p>}

      {clubesDuplicados.length > 0 && (
        <div className="cl-ticket" style={{ borderColor: "var(--clay)", background: "#FDECEA" }}>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--clay)" }}>
            <AlertTriangle size={14} style={{ verticalAlign: "-2px" }} /> Nombres de club duplicados — revisar antes de verificar
          </p>
          {clubesDuplicados.map((c) => (
            <p key={c.uid} style={{ fontSize: "13px", marginTop: "4px" }}>
              <b>{c.clubName}</b> · {c.telefono} · {c.email} {c.verificado && "✅ ya verificado"}
            </p>
          ))}
        </div>
      )}

      <h3 className="cl-display" style={{ fontSize: "18px", color: "var(--pitch-dark)", marginTop: "16px" }}>VERIFICAR TELÉFONOS</h3>
      <p style={{ fontSize: "12px", color: "#888", marginBottom: "10px" }}>
        Un club no puede reservar ni ser reservado hasta que confirmes su teléfono a mano (llamada o WhatsApp) y le des el visto bueno aquí.
      </p>
      <div className="cl-ticket">
        {clubes.map((c) => (
          <div key={c.uid} className="cl-row" style={{ justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
            <div>
              <b>{c.clubName}</b>{" "}
              <span className="cl-mono" style={{ fontSize: "12px", color: "#888" }}>· {c.telefono} · {c.email}</span>
            </div>
            {c.verificado ? (
              <button className="cl-btn cl-btn-ghost" onClick={() => cambiar(c.uid, false)}>Quitar verificación</button>
            ) : (
              <button className="cl-btn cl-btn-primary" onClick={() => cambiar(c.uid, true)}>Verificar</button>
            )}
          </div>
        ))}
      </div>

      {solicitudes.length > 0 && (
        <>
          <h3 className="cl-display" style={{ fontSize: "18px", color: "var(--gold)", marginTop: "16px" }}>
            SOLICITUDES DE ALTA EN LA LISTA ({solicitudes.length})
          </h3>
          <div className="cl-ticket">
            {solicitudes.map((s) => (
              <div key={s.id} className="cl-row" style={{ justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                <span style={{ fontSize: "13px" }}><b>{s.nombreSolicitado}</b> · {s.telefono} · {s.email}</span>
                <button className="cl-btn cl-btn-primary" onClick={() => atenderSolicitud(s)}><Check size={13} /> Añadir a la lista</button>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 className="cl-display" style={{ fontSize: "18px", color: "var(--pitch-dark)", marginTop: "16px" }}>LISTA OFICIAL DE CLUBES ({clubesOficiales.length})</h3>
      <div className="cl-ticket">
        <button className="cl-btn cl-btn-gold" onClick={importar} disabled={importando} style={{ marginBottom: "8px" }}>
          <Download size={14} /> {importando ? "Importando..." : "Importar/actualizar lista base"}
        </button>
        {avisoImport && <p style={{ fontSize: "12px", color: "var(--pitch)", marginBottom: "8px" }}>{avisoImport}</p>}
        <div className="cl-row" style={{ marginBottom: "10px" }}>
          <input className="cl-input" placeholder="Nombre del club" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} maxLength={100} />
          <input className="cl-input" placeholder="Localidad (opcional)" value={nuevaLocalidad} onChange={(e) => setNuevaLocalidad(e.target.value)} style={{ maxWidth: "160px" }} />
          <button className="cl-btn cl-btn-primary" onClick={añadirManual}><Plus size={14} /> Añadir</button>
        </div>
        <div style={{ maxHeight: "200px", overflowY: "auto" }}>
          {clubesOficiales.map((c) => (
            <div key={c.id} className="cl-row" style={{ justifyContent: "space-between", padding: "3px 0" }}>
              <span style={{ fontSize: "13px" }}>{c.nombre} {c.localidad && <span style={{ color: "#888" }}>· {c.localidad}</span>}</span>
              <button className="cl-btn cl-btn-ghost" style={{ padding: "2px 6px" }} onClick={() => eliminarClubOficial(c.id)}><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AjustesView({ uid, profile, onGuardarContacto, onBorrarCuenta, onVerificar }) {
  const instalaciones = useInstalaciones(uid);
  const [nuevaInstalacion, setNuevaInstalacion] = useState("");
  const [enlaceCopiado, setEnlaceCopiado] = useState(false);
  const [errorInstalacion, setErrorInstalacion] = useState("");

  const añadirInstalacion = async () => {
    if (!nuevaInstalacion.trim()) return;
    setErrorInstalacion("");
    try {
      await addInstalacion(uid, nuevaInstalacion);
      setNuevaInstalacion("");
    } catch (err) {
      setErrorInstalacion(err.message || "No se ha podido añadir.");
    }
  };
  const [clubName, setClubName] = useState(profile.clubName);
  const [telefono, setTelefono] = useState(profile.telefono || "");
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
  const [verPolitica, setVerPolitica] = useState(false);

  const [borrando, setBorrando] = useState(false);
  const [passwordBorrar, setPasswordBorrar] = useState("");
  const [errorBorrar, setErrorBorrar] = useState("");

  const guardar = async () => {
    setAviso("");
    setError("");
    if (!telefonoValido(telefono)) {
      setError("Ese teléfono no parece válido — solo dígitos, 9 a 15 (puede llevar + al principio).");
      return;
    }
    setGuardando(true);
    try {
      await onGuardarContacto({ clubName: clubName.trim(), telefono: telefono.trim() });
      setAviso("Guardado.");
    } catch (err) {
      setError(err.message || "No se ha podido guardar.");
    }
    setGuardando(false);
  };

  const confirmarBorrado = async () => {
    if (!window.confirm("Esto borra tu cuenta, tus equipos, tu calendario y todos tus huecos de forma PERMANENTE. ¿Seguro?")) return;
    setErrorBorrar("");
    try {
      await onBorrarCuenta(passwordBorrar);
    } catch (err) {
      setErrorBorrar(err.message?.includes("auth/wrong-password") || err.code === "auth/wrong-password" ? "Contraseña incorrecta." : (err.message || "No se ha podido borrar la cuenta."));
    }
  };

  return (
    <div>
      {profile.esAdmin && (
        <div style={{ marginBottom: "24px" }}>
          <PanelAdmin onVerificar={onVerificar} />
        </div>
      )}
      <div className="cl-grid-3">
      <div>
        <h2 className="cl-display" style={{ fontSize: "22px", color: "var(--pitch-dark)" }}>DATOS DE CONTACTO</h2>
        <div className="cl-ticket">
          <label className="cl-label">NOMBRE DEL CLUB</label>
          <input className="cl-input" value={clubName} onChange={(e) => setClubName(e.target.value)} maxLength={LIMITES.clubName} style={{ marginBottom: "8px" }} />
          <label className="cl-label">TELÉFONO</label>
          <input className="cl-input" value={telefono} onChange={(e) => setTelefono(e.target.value)} maxLength={LIMITES.telefono} style={{ marginBottom: "8px" }} />
          <p style={{ fontSize: "11px", color: "#888", marginBottom: "8px" }}>
            Los equipos que ya has publicado no se actualizan solos con el nuevo teléfono — solo afecta a lo nuevo que publiques a partir de ahora.
          </p>
          <button className="cl-btn cl-btn-primary" onClick={guardar} disabled={guardando} style={{ width: "100%", justifyContent: "center" }}>
            <Save size={14} /> {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
          {aviso && <p style={{ color: "var(--pitch)", fontSize: "12px", marginTop: "6px" }}>{aviso}</p>}
          {error && <p style={{ color: "var(--clay)", fontSize: "12px", marginTop: "6px" }}>{error}</p>}
        </div>

        <p style={{ fontSize: "13px" }}>
          <a href="#" onClick={(e) => { e.preventDefault(); setVerPolitica(true); }}>Ver política de privacidad</a>
        </p>

        <h2 className="cl-display" style={{ fontSize: "22px", color: "var(--pitch-dark)", marginTop: "20px" }}>ENLACE PÚBLICO DE TU CUADRANTE</h2>
        <div className="cl-ticket">
          <p style={{ fontSize: "12px", color: "#888", marginBottom: "8px" }}>
            Compártelo con quien quieras (directiva, padres, otros clubes) — se ve sin necesitar cuenta, y nunca muestra teléfonos ni emails.
          </p>
          <div className="cl-row">
            <input className="cl-input" readOnly value={`${window.location.origin}${window.location.pathname}?publico=${uid}`} onClick={(e) => e.target.select()} />
            <button
              className="cl-btn cl-btn-primary"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?publico=${uid}`);
                setEnlaceCopiado(true);
                setTimeout(() => setEnlaceCopiado(false), 2000);
              }}
            >
              {enlaceCopiado ? "¡Copiado!" : "Copiar enlace"}
            </button>
          </div>
        </div>

        <h2 className="cl-display" style={{ fontSize: "22px", color: "var(--pitch-dark)", marginTop: "20px" }}>TUS INSTALACIONES</h2>
        <div className="cl-ticket">
          <p style={{ fontSize: "12px", color: "#888", marginBottom: "8px" }}>
            Guarda aquí los campos que usáis habitualmente, para elegirlos rápido al cerrar un partido en vez de escribirlos cada vez.
          </p>
          <div className="cl-row" style={{ marginBottom: "8px" }}>
            <input
              className="cl-input"
              placeholder="Ej. Camp Municipal Silla — pista 1"
              value={nuevaInstalacion}
              onChange={(e) => setNuevaInstalacion(e.target.value)}
              maxLength={60}
            />
            <button className="cl-btn cl-btn-primary" onClick={añadirInstalacion}><Plus size={14} /> Añadir</button>
          </div>
          {errorInstalacion && <p style={{ color: "var(--clay)", fontSize: "12px", marginBottom: "8px" }}>{errorInstalacion}</p>}
          {instalaciones.length === 0 ? (
            <p style={{ fontSize: "13px", color: "#888" }}>Todavía no has añadido ninguna.</p>
          ) : (
            instalaciones.map((i) => (
              <div key={i.id} className="cl-row" style={{ justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--line)" }}>
                <span style={{ fontSize: "13px" }}>{i.nombre}</span>
                <button className="cl-btn cl-btn-ghost" style={{ padding: "2px 6px" }} onClick={() => deleteInstalacion(i.id)}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <h2 className="cl-display" style={{ fontSize: "22px", color: "var(--clay)" }}>ZONA PELIGROSA</h2>
        {!borrando ? (
          <div className="cl-ticket" style={{ borderColor: "var(--clay)" }}>
            <p style={{ fontSize: "13px", marginBottom: "10px" }}>
              Borrar tu cuenta elimina de forma permanente tu club, tus equipos, tu calendario de jornadas y todos tus huecos publicados. No se puede deshacer.
            </p>
            <button className="cl-btn cl-btn-ghost" onClick={() => setBorrando(true)}>
              <Trash2 size={14} /> Borrar mi cuenta
            </button>
          </div>
        ) : (
          <div className="cl-ticket" style={{ borderColor: "var(--clay)" }}>
            <p style={{ fontSize: "13px", marginBottom: "8px" }}>
              Para confirmar, escribe tu contraseña actual:
            </p>
            <input
              type="password"
              className="cl-input"
              value={passwordBorrar}
              onChange={(e) => setPasswordBorrar(e.target.value)}
              style={{ marginBottom: "8px" }}
            />
            <div className="cl-row">
              <button className="cl-btn cl-btn-ghost" onClick={() => { setBorrando(false); setPasswordBorrar(""); setErrorBorrar(""); }}>
                Cancelar
              </button>
              <button className="cl-btn" style={{ background: "var(--clay)", color: "white" }} onClick={confirmarBorrado}>
                <Trash2 size={14} /> Confirmar borrado definitivo
              </button>
            </div>
            {errorBorrar && <p style={{ color: "var(--clay)", fontSize: "12px", marginTop: "6px" }}>{errorBorrar}</p>}
          </div>
        )}
      </div>

      </div>

      {verPolitica && <PoliticaPrivacidad onCerrar={() => setVerPolitica(false)} />}
    </div>
  );
}
