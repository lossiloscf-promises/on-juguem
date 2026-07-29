import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

// El calendario de temporada de un club: la lista de fechas/jornadas disponibles
// para programar amistosos (pueden ser findes de varios días o un solo día entre semana).
export function useJornadas(uid) {
  const [jornadas, setJornadas] = useState([]);
  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, "jornadas"), where("ownerUid", "==", uid));
    return onSnapshot(q, (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      lista.sort((a, b) => a.orderDate.localeCompare(b.orderDate));
      setJornadas(lista);
    });
  }, [uid]);
  return jornadas;
}

export async function addJornada(uid, { label, orderDate, fase }) {
  return addDoc(collection(db, "jornadas"), {
    ownerUid: uid,
    label,
    orderDate, // fecha (YYYY-MM-DD) usada solo para ordenar la columna, no se muestra
    fase, // "Pretemporada" | "Liga" | "Postemporada"
    createdAt: serverTimestamp(),
  });
}

// Solo deja borrar una jornada si ninguno de sus huecos tiene un partido en
// marcha (pendiente/pactado/confirmado) — si no, dile al coordinador con quién
// para que lo resuelva antes de tocar el calendario.
export async function deleteJornada(jornadaId, slotsDeEstaJornada) {
  const activo = (slotsDeEstaJornada || []).find((s) => ["pendiente", "pactado", "confirmado"].includes(s.status));
  if (activo) {
    throw new Error(
      `Esta jornada tiene un partido en marcha (con ${activo.requestedByClubName || "otro club"}${activo.requestedByTelefono ? ", tel. " + activo.requestedByTelefono : ""}). Cancélalo o resuélvelo antes de borrar la jornada.`
    );
  }
  return deleteDoc(doc(db, "jornadas", jornadaId));
}
