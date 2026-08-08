import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { doc, updateDoc, getDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { app, db } from "../firebase";
import { getIdentidadActual } from "../identidad";
import { CLAVES_COORDINADOR } from "../constants";

// El token de ESTE dispositivo concreto (no "algún dispositivo del club" —
// cada navegador/móvil tiene el suyo). Vive en localStorage porque es un
// dato del dispositivo, no de la cuenta.
export function tokenDeEsteDispositivo() {
  try {
    return localStorage.getItem("cl_fcm_token");
  } catch {
    return null;
  }
}

// Si este dispositivo concreto está realmente activado: su token debe
// seguir presente en Firestore, en el perfil del club, bajo alguna
// categoría. Que el club tenga otros dispositivos activados no cuenta —
// cada dispositivo se comprueba por su propio token.
export function estaActivoEnEsteDispositivo(fcmTokensPorCategoria) {
  const token = tokenDeEsteDispositivo();
  if (!token) return false;
  return Object.values(fcmTokensPorCategoria || {}).some((arr) => Array.isArray(arr) && arr.includes(token));
}

// Clave pública VAPID de este proyecto (Firebase Console → Configuración del
// proyecto → Cloud Messaging → Certificados push web). No es secreta.
const VAPID_KEY = "BFo14LZYxz4osG-7OwGwlIWYUW4bCTjS3Yj0jJJd-9GHyedS0QCUHJ5XhLXjEkBcZYPeqqhlES59IHLfjwTkUtI";

// Comprueba si este navegador puede recibir notificaciones push en absoluto
// (Safari de escritorio antiguo, o iOS sin haber "añadido a pantalla de
// inicio", no pueden — mejor avisarlo claro que fallar en silencio).
export async function notificacionesSoportadas() {
  try {
    return await isSupported();
  } catch {
    return false;
  }
}

// Averigua bajo qué categoría hay que guardar este dispositivo — según quién
// haya dicho ser en esta sesión (si el club tiene varios coordinadores). Si
// no hay identidad elegida (club con un solo coordinador), va a "general".
function claveDelDispositivoActual() {
  const identidad = getIdentidadActual();
  const encontrada = CLAVES_COORDINADOR.find((c) => c.label === identidad);
  return encontrada ? encontrada.clave : "general";
}

// Pide permiso al navegador, y si lo da, guarda el "token" de este
// dispositivo concreto en el perfil del club, bajo la categoría que le
// corresponda — así luego cada aviso puede llegar solo a quien le toca.
export async function activarNotificaciones(uid) {
  const soportado = await notificacionesSoportadas();
  if (!soportado) {
    throw new Error("Este navegador no admite notificaciones push (en iPhone, tienen que estar añadidas a la pantalla de inicio).");
  }
  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") {
    throw new Error("No has dado permiso para las notificaciones — puedes activarlo luego desde los ajustes del navegador.");
  }
  const messaging = getMessaging(app);
  const registro = await navigator.serviceWorker.register("/on-juguem/firebase-messaging-sw.js");
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registro });
  if (!token) throw new Error("No se ha podido activar — inténtalo de nuevo en un momento.");

  // Si este mismo dispositivo ya se había activado antes (con un token
  // distinto de una vez anterior), se limpia primero — así no se quedan
  // varios tokens del mismo móvil acumulados, que provocarían recibir cada
  // aviso duplicado.
  const tokenAnterior = localStorage.getItem("cl_fcm_token");
  if (tokenAnterior && tokenAnterior !== token) {
    await desactivarNotificaciones(uid, tokenAnterior);
  }
  localStorage.setItem("cl_fcm_token", token);

  const clave = claveDelDispositivoActual();
  await updateDoc(doc(db, "users", uid), { [`fcmTokensPorCategoria.${clave}`]: arrayUnion(token) });

  // Devolvemos el mapa ya actualizado (no solo el token) para que quien
  // llame pueda refrescar el perfil que tiene en memoria al instante, sin
  // esperar a un recargo de página ni a un listener en vivo.
  const snap = await getDoc(doc(db, "users", uid));
  return { token, fcmTokensPorCategoria: snap.data()?.fcmTokensPorCategoria || {} };
}

// Quita este dispositivo de TODAS las categorías donde pudiera estar
// guardado (no siempre se sabe bajo cuál se activó, así que se limpia de
// todas por si acaso — quitar algo que no está en un sitio no da error).
export async function desactivarNotificaciones(uid, token) {
  if (!token) return { fcmTokensPorCategoria: {} };
  const actualizacion = {};
  CLAVES_COORDINADOR.forEach((c) => {
    actualizacion[`fcmTokensPorCategoria.${c.clave}`] = arrayRemove(token);
  });
  await updateDoc(doc(db, "users", uid), actualizacion);

  const snap = await getDoc(doc(db, "users", uid));
  return { fcmTokensPorCategoria: snap.data()?.fcmTokensPorCategoria || {} };
}

// Borra TODOS los dispositivos guardados del club de golpe — útil para
// empezar de cero si se han quedado tokens antiguos/duplicados de pruebas
// anteriores, provocando avisos repetidos.
export async function reiniciarTodosLosDispositivos(uid) {
  const actualizacion = {};
  CLAVES_COORDINADOR.forEach((c) => {
    actualizacion[`fcmTokensPorCategoria.${c.clave}`] = [];
  });
  await updateDoc(doc(db, "users", uid), actualizacion);
  localStorage.removeItem("cl_fcm_token");
}

// Con la app ABIERTA en primer plano, las notificaciones no las muestra el
// sistema operativo solas — hay que capturarlas aquí y decidir qué hacer
// (de momento, un aviso simple del navegador).
export function escucharEnPrimerPlano() {
  notificacionesSoportadas().then((ok) => {
    if (!ok) return;
    const messaging = getMessaging(app);
    onMessage(messaging, (payload) => {
      const titulo = payload.data?.title || "On Juguem";
      const cuerpo = payload.data?.body || "";
      if (Notification.permission === "granted") {
        new Notification(titulo, { body: cuerpo, icon: "/on-juguem/icon-192.png" });
      }
    });
  });
}
