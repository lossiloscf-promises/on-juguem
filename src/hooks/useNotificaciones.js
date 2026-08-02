import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { app, db } from "../firebase";

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

// Pide permiso al navegador, y si lo da, guarda el "token" de este
// dispositivo concreto en el perfil del club — un club puede tener varios
// dispositivos a la vez (varios coordinadores, cada uno con su móvil).
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
  await updateDoc(doc(db, "users", uid), { fcmTokens: arrayUnion(token) });
  return token;
}

export async function desactivarNotificaciones(uid, token) {
  if (!token) return;
  await updateDoc(doc(db, "users", uid), { fcmTokens: arrayRemove(token) });
}

// Con la app ABIERTA en primer plano, las notificaciones no las muestra el
// sistema operativo solas — hay que capturarlas aquí y decidir qué hacer
// (de momento, un aviso simple del navegador).
export function escucharEnPrimerPlano() {
  notificacionesSoportadas().then((ok) => {
    if (!ok) return;
    const messaging = getMessaging(app);
    onMessage(messaging, (payload) => {
      const titulo = payload.notification?.title || "On Juguem";
      const cuerpo = payload.notification?.body || "";
      if (Notification.permission === "granted") {
        new Notification(titulo, { body: cuerpo, icon: "/on-juguem/icon-192.png" });
      }
    });
  });
}
