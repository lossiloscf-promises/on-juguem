// Este archivo es especial: lo carga el navegador directamente (no pasa por
// Vite), así que las claves de Firebase NO pueden venir de variables de
// entorno aquí — hay que escribirlas a mano, copiándolas de tu .env.local.
// Son las mismas 6 líneas que ya tienes ahí (son públicas por diseño, no son
// secretas, Firebase las expone siempre en el navegador de todas formas).
importScripts("https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDJcTrdeMxw3PFXWgwhdKBMlwdOczV_HL8",
  authDomain: "partitscv.firebaseapp.com",
  projectId: "partitscv",
  storageBucket: "partitscv.firebasestorage.app",
  messagingSenderId: "628851831451",
  appId: "1:628851831451:web:311fa5730475a76a558c3e",
});

const messaging = firebase.messaging();

// Qué hacer cuando llega una notificación con la app cerrada o en segundo
// plano (con la app abierta en primer plano, se gestiona desde el propio
// código de la app, no desde aquí).
messaging.onBackgroundMessage((payload) => {
  const titulo = payload.notification?.title || "On Juguem";
  const opciones = {
    body: payload.notification?.body || "",
    icon: "/on-juguem/icon-192.png",
    badge: "/on-juguem/icon-192.png",
  };
  self.registration.showNotification(titulo, opciones);
});
