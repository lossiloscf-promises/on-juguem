import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import clubesSemilla from "../clubesOficialesSeed.json";

// Lista pública de clubes oficiales — visible incluso sin haber iniciado
// sesión, porque hace falta para el buscador del propio registro.
export function useClubesOficiales() {
  const [clubes, setClubes] = useState([]);
  useEffect(() => {
    const q = collection(db, "clubesOficiales");
    return onSnapshot(q, (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      lista.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setClubes(lista);
    });
  }, []);
  return clubes;
}

export async function añadirClubOficial(nombre, localidad) {
  return addDoc(collection(db, "clubesOficiales"), {
    nombre: nombre.trim(),
    nombreLower: nombre.trim().toLowerCase(),
    localidad: (localidad || "").trim(),
    createdAt: serverTimestamp(),
  });
}

export async function eliminarClubOficial(id) {
  return deleteDoc(doc(db, "clubesOficiales", id));
}

// Importa la lista semilla (la que traemos de la FFCV) a Firestore, saltando
// los que ya existan — se puede volver a pulsar sin miedo, no duplica nada.
export async function importarClubesSemilla() {
  const snap = await getDocs(collection(db, "clubesOficiales"));
  const yaExisten = new Set(snap.docs.map((d) => d.data().nombreLower));
  let añadidos = 0;
  for (const c of clubesSemilla) {
    const nombreLower = c.nombre.trim().toLowerCase();
    if (yaExisten.has(nombreLower)) continue;
    await addDoc(collection(db, "clubesOficiales"), {
      nombre: c.nombre.trim(),
      nombreLower,
      localidad: (c.localidad || "").trim(),
      createdAt: serverTimestamp(),
    });
    añadidos++;
  }
  return añadidos;
}

// --- Solicitudes de clubes que no aparecen en la lista ---

export async function crearSolicitudClub(nombreSolicitado, telefono, email) {
  return addDoc(collection(db, "solicitudesClub"), {
    nombreSolicitado: nombreSolicitado.trim(),
    telefono: telefono.trim(),
    email: email.trim(),
    atendida: false,
    createdAt: serverTimestamp(),
  });
}

export function useSolicitudesClub() {
  const [solicitudes, setSolicitudes] = useState([]);
  useEffect(() => {
    const q = query(collection(db, "solicitudesClub"), where("atendida", "==", false));
    return onSnapshot(q, (snap) => setSolicitudes(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, []);
  return solicitudes;
}

export async function marcarSolicitudAtendida(id) {
  return updateDoc(doc(db, "solicitudesClub", id), { atendida: true });
}
