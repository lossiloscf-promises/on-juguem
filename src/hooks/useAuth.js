import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "../firebase";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const snap = await getDoc(doc(db, "users", u.uid));
        setProfile(snap.exists() ? snap.data() : null);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  // Comprueba si ya existe un club registrado con ese mismo nombre (para avisar,
  // no para bloquear — dos clubes podrían coincidir en nombre por casualidad,
  // pero es mejor que el coordinador lo sepa antes de crear el suyo).
  const comprobarNombreDuplicado = async (clubName) => {
    // Esta comprobación pasa por el servidor (no por Firestore directamente)
    // porque se llama ANTES de tener sesión iniciada, y las reglas normales
    // de "users" exigen sesión para leer (con razón: ahí vive el teléfono y
    // el email de cada club).
    const fn = httpsCallable(functions, "comprobarClubDuplicado");
    const resultado = await fn({ clubName });
    return !!resultado.data?.existe;
  };

  const signup = async (email, password, clubName, telefono) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: clubName });
    const data = {
      clubName, clubNameLower: clubName.trim().toLowerCase(), email, telefono: telefono || "",
      verificado: false, esAdmin: false,
    };
    await setDoc(doc(db, "users", cred.user.uid), data);
    setProfile(data);
    try {
      await sendEmailVerification(cred.user);
    } catch {
      // Si falla el envío del email de verificación no bloqueamos el alta,
      // el coordinador puede seguir usando la app igualmente.
    }
    return cred.user;
  };

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);
  const recuperarContrasena = (email) => sendPasswordResetEmail(auth, email);
  const reenviarVerificacion = () => sendEmailVerification(auth.currentUser);

  const updateContact = async (uid, { clubName, telefono, emailContacto }) => {
    const data = { clubName, clubNameLower: clubName.trim().toLowerCase(), telefono, emailContacto: emailContacto || "" };
    await updateDoc(doc(db, "users", uid), data);
    setProfile((prev) => ({ ...prev, ...data }));
  };

  // Guarda el mapa completo de coordinadores de contacto por categoría —
  // se guarda entero de golpe (no campo a campo) para no complicar las reglas.
  const updateCoordinadores = async (uid, coordinadores) => {
    await updateDoc(doc(db, "users", uid), { coordinadores });
    setProfile((prev) => ({ ...prev, coordinadores }));
  };

  // El propio subirEscudo/borrarEscudo (en useEscudo.js) ya actualiza
  // Firestore — esto solo refresca el perfil que se ve en pantalla al
  // momento, sin esperar a un refresco de página.
  const actualizarEscudoLocal = (escudoUrl) => {
    setProfile((prev) => ({ ...prev, escudoUrl }));
  };

  // Borra la cuenta y todos los datos que le pertenecen: equipos, huecos
  // propios y calendario de jornadas. Requiere volver a confirmar la
  // contraseña (Firebase lo exige por seguridad para operaciones sensibles
  // como borrar una cuenta).
  const deleteAccount = async (password) => {
    const cred = EmailAuthProvider.credential(auth.currentUser.email, password);
    await reauthenticateWithCredential(auth.currentUser, cred);

    const uid = auth.currentUser.uid;

    const teamsSnap = await getDocs(query(collection(db, "teams"), where("ownerUid", "==", uid)));
    await Promise.all(teamsSnap.docs.map((d) => deleteDoc(d.ref)));

    const slotsSnap = await getDocs(query(collection(db, "slots"), where("ownerUid", "==", uid)));
    await Promise.all(slotsSnap.docs.map((d) => deleteDoc(d.ref)));

    const jornadasSnap = await getDocs(query(collection(db, "jornadas"), where("ownerUid", "==", uid)));
    await Promise.all(jornadasSnap.docs.map((d) => deleteDoc(d.ref)));

    await deleteDoc(doc(db, "users", uid));
    await deleteUser(auth.currentUser);
  };

  // Solo funciona si quien lo llama es admin (la regla del servidor lo exige,
  // esto de aquí es solo para no mostrar el intento si no hace falta).
  const verificarClub = async (targetUid, verificado) => {
    await updateDoc(doc(db, "users", targetUid), { verificado });
  };

  return {
    user, profile, loading,
    signup, login, logout,
    updateContact, updateCoordinadores, actualizarEscudoLocal, recuperarContrasena, deleteAccount,
    comprobarNombreDuplicado, reenviarVerificacion,
    verificarClub,
  };
}

// Perfil de un club concreto en tiempo real (para comprobar si está verificado
// antes de dejar reservar, con un aviso claro en vez de un error genérico).
export function useClubProfile(uid) {
  const [perfil, setPerfil] = useState(null);
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, "users", uid), (snap) => setPerfil(snap.exists() ? snap.data() : null));
  }, [uid]);
  return perfil;
}

// Lista en tiempo real de todos los clubes registrados — pensado para el
// panel de administración (verificar teléfonos manualmente).
export function useTodosLosClubes() {
  const [clubes, setClubes] = useState([]);
  useEffect(() => {
    const q = collection(db, "users");
    return onSnapshot(q, (snap) => {
      const lista = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
      lista.sort((a, b) => (a.verificado === b.verificado ? 0 : a.verificado ? 1 : -1));
      setClubes(lista);
    });
  }, []);
  return clubes;
}
