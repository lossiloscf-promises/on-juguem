// Este archivo es especial: lo carga el navegador directamente (no pasa por
// Vite), así que las claves de Firebase NO pueden venir de variables de
// entorno aquí — hay que escribirlas a mano, copiándolas de tu .env.local.
// Son las mismas 6 líneas que ya tienes ahí (son públicas por diseño, no son
// secretas, Firebase las expone siempre en el navegador de todas formas).
importScripts("https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "PON_AQUI_TU_VITE_FIREBASE_API_KEY",
  authDomain: "PON_AQUI_TU_VITE_FIREBASE_AUTH_DOMAIN",
  projectId: "PON_AQUI_TU_VITE_FIREBASE_PROJECT_ID",
  storageBucket: "PON_AQUI_TU_VITE_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "PON_AQUI_TU_VITE_FIREBASE_MESSAGING_SENDER_ID",
  appId: "PON_AQUI_TU_VITE_FIREBASE_APP_ID",
});

const messaging = firebase.messaging();

// Qué hacer cuando llega una notificación con la app cerrada o en segundo
// plano (con la app abierta en primer plano, se gestiona desde el propio
// código de la app, no desde aquí).
// IMPORTANTE: el servidor manda el mensaje como "data" (no "notification") a
// propósito — si llevara "notification", el navegador la mostraría él solo
// ADEMÁS de esta, duplicando cada aviso.
messaging.onBackgroundMessage((payload) => {
  const titulo = payload.data?.title || "On Juguem";
  const opciones = {
    body: payload.data?.body || "",
    icon: "/on-juguem/icon-192.png",
    badge: "/on-juguem/icon-192.png",
  };
  self.registration.showNotification(titulo, opciones);
});
