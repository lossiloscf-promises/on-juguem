import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  setDoc,
  getDoc,
  arrayUnion,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { registrarHistorialTorneo } from "./useClubData";

// Torneos organizados por mí (para gestionarlos).
export function useMisTorneos(uid) {
  const [torneos, setTorneos] = useState([]);
  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, "torneos"), where("organizadorUid", "==", uid));
    return onSnapshot(q, (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      lista.sort((a, b) => (a.dia || "").localeCompare(b.dia || ""));
      setTorneos(lista);
    });
  }, [uid]);
  return torneos;
}

// Todos los torneos abiertos de la plataforma (para buscar y apuntarse).
export function useTorneosAbiertos() {
  const [torneos, setTorneos] = useState([]);
  useEffect(() => {
    const q = query(collection(db, "torneos"), where("estado", "==", "abierto"));
    return onSnapshot(q, (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      lista.sort((a, b) => (a.dia || "").localeCompare(b.dia || ""));
      setTorneos(lista);
    });
  }, []);
  return torneos;
}

// Crea un torneo/triangular — el organizador queda apuntado como primer
// participante automáticamente, con el equipo que elija.
export async function crearTorneo(uid, clubName, telefono, email, datos) {
  const { nombre, genero, formato, categoria, nivel, jornadaLabel, jornadaOrderDate, dia, horaInicio, horaFin, instalacion, maxEquipos, equipoOrganizador } = datos;
  const ref = await addDoc(collection(db, "torneos"), {
    organizadorUid: uid,
    organizadorClubName: clubName,
    nombre: nombre.trim(),
    genero, formato, categoria, nivel,
    jornadaLabel, jornadaOrderDate,
    dia, horaInicio, horaFin, instalacion,
    maxEquipos,
    estado: "abierto",
    participantes: [
      {
        clubUid: uid,
        clubName,
        teamId: equipoOrganizador.id,
        teamLabel: `${equipoOrganizador.grupo}${equipoOrganizador.anyo ? ` (${equipoOrganizador.anyo})` : ""}${equipoOrganizador.identificador ? ` ${equipoOrganizador.identificador}` : ""}`,
        telefono, email,
      },
    ],
    partidos: [],
    createdAt: serverTimestamp(),
  });
  return ref;
}

export async function apuntarseATorneo(torneoId, clubUid, clubName, equipo, telefono, email) {
  await updateDoc(doc(db, "torneos", torneoId), {
    participantes: arrayUnion({
      clubUid,
      clubName,
      teamId: equipo.id,
      teamLabel: `${equipo.grupo}${equipo.anyo ? ` (${equipo.anyo})` : ""}${equipo.identificador ? ` ${equipo.identificador}` : ""}`,
      telefono, email,
    }),
  });
}

// Retirarse mientras el torneo siga abierto (reescribe la lista sin ese club).
export async function retirarseDeTorneo(torneoId, clubUid) {
  const ref = doc(db, "torneos", torneoId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const participantes = (snap.data().participantes || []).filter((p) => p.clubUid !== clubUid);
  await updateDoc(ref, { participantes });
}

// El organizador cierra inscripciones y guarda el calendario completo de
// partidos — esto, además, crea de verdad los huecos "confirmado" en el
// cuadrante de cada pareja de equipos implicada.
export async function programarTorneo(torneoId, partidosConHoraYCampo, teamsPorClub) {
  const ref = doc(db, "torneos", torneoId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("El torneo ya no existe.");
  const torneo = snap.data();

  const partidosFinal = [];
  for (const p of partidosConHoraYCampo) {
    const equipoA = p.equipoA;
    const equipoB = p.equipoB;
    const slotId = `torneo_${torneoId}_${equipoA.teamId}_${equipoB.teamId}`;
    await setDoc(doc(db, "slots", slotId), {
      ownerUid: equipoA.clubUid,
      teamId: equipoA.teamId,
      clubName: equipoA.clubName,
      ownerTelefono: equipoA.telefono || "",
      ownerEmail: equipoA.email || "",
      genero: torneo.genero,
      formato: torneo.formato,
      grupo: (teamsPorClub[equipoA.teamId] || {}).grupo || "",
      anyo: (teamsPorClub[equipoA.teamId] || {}).anyo || "",
      categoria: torneo.categoria,
      nivel: torneo.nivel,
      identificador: (teamsPorClub[equipoA.teamId] || {}).identificador || "",
      jornadaId: torneo.jornadaId || null,
      jornadaLabel: torneo.jornadaLabel,
      jornadaOrderDate: torneo.jornadaOrderDate,
      fase: torneo.fase || "Pretemporada",
      status: "confirmado",
      sede: "local",
      diaExacto: torneo.dia,
      horaExacta: p.hora,
      campoExacto: p.campo || torneo.instalacion,
      requestedByUid: equipoB.clubUid,
      requestedByClubName: equipoB.clubName,
      requestedByTelefono: equipoB.telefono || "",
      requestedByEmail: equipoB.email || "",
      requestedByTeamId: equipoB.teamId,
      cancelacionPropuestaPor: null,
      avisoEquipoBorrado: false,
      avisoTexto: "",
      torneoId,
      torneoOrganizadorUid: torneo.organizadorUid,
      torneoNombre: torneo.nombre,
      createdAt: serverTimestamp(),
    });
    partidosFinal.push({ ...p, slotId });
    registrarHistorialTorneo(slotId, `Partido de "${torneo.nombre}" programado por el organizador`);
  }

  await updateDoc(ref, { estado: "programado", partidos: partidosFinal });
}

// El organizador cambia hora/campo de un partido YA programado — no hace
// falta que las dos partes lo acepten, porque es él quien organiza el torneo.
export async function cambiarPartidoTorneo(torneoId, slotId, nuevosDatos) {
  await updateDoc(doc(db, "slots", slotId), {
    horaExacta: nuevosDatos.hora,
    campoExacto: nuevosDatos.campo,
  });
  const ref = doc(db, "torneos", torneoId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const partidos = (snap.data().partidos || []).map((p) =>
      p.slotId === slotId ? { ...p, hora: nuevosDatos.hora, campo: nuevosDatos.campo } : p
    );
    await updateDoc(ref, { partidos });
  }
}
