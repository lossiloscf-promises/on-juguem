import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

// Lista de instalaciones/campos que un club usa habitualmente — para no tener
// que escribir el nombre a mano cada vez que se cierra un partido.
export function useInstalaciones(uid) {
  const [instalaciones, setInstalaciones] = useState([]);
  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, "instalaciones"), where("ownerUid", "==", uid));
    return onSnapshot(q, (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      lista.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setInstalaciones(lista);
    });
  }, [uid]);
  return instalaciones;
}

export async function addInstalacion(uid, nombre, direccion) {
  return addDoc(collection(db, "instalaciones"), {
    ownerUid: uid,
    nombre: nombre.trim(),
    direccion: (direccion || "").trim(),
    createdAt: serverTimestamp(),
  });
}

export async function deleteInstalacion(id) {
  return deleteDoc(doc(db, "instalaciones", id));
}
