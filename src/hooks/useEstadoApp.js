import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";

// Lee en tiempo real si la app está en mantenimiento — funciona incluso sin
// sesión iniciada, para poder avisar antes incluso del login.
export function useEstadoApp() {
  const [estado, setEstado] = useState({ mantenimiento: false, mensaje: "" });
  useEffect(() => {
    return onSnapshot(doc(db, "config", "estado"), (snap) => {
      setEstado(snap.exists() ? snap.data() : { mantenimiento: false, mensaje: "" });
    });
  }, []);
  return estado;
}

// Solo un administrador puede llamar a esto (protegido también por las
// reglas de Firestore, no solo por la interfaz).
export async function cambiarMantenimiento(activo, mensaje) {
  await setDoc(doc(db, "config", "estado"), { mantenimiento: activo, mensaje: mensaje || "" });
}
