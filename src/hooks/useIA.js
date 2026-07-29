import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

// Envuelve httpsCallable con un mensaje de error consistente si la función
// de IA falla o todavía no está desplegada.
async function llamar(nombreFuncion, datos) {
  try {
    const fn = httpsCallable(functions, nombreFuncion);
    const resultado = await fn(datos);
    return resultado.data;
  } catch (err) {
    if (err.code === "functions/not-found" || err.code === "not-found") {
      throw new Error("Esta función de IA todavía no está desplegada en tu proyecto de Firebase.");
    }
    throw new Error(err.message || "La IA no ha podido responder ahora mismo.");
  }
}

// 1) Alta rápida por texto libre
export function interpretarDisponibilidad(texto, gruposValidos, categoriasValidas, nivelesValidos) {
  return llamar("interpretarDisponibilidad", { texto, gruposValidos, categoriasValidas, nivelesValidos });
}

// 2) Explicación en lenguaje natural del modo inteligente
export function explicarRecomendacion(clubName, coincidencias, distanciaKm, pctCompletado) {
  return llamar("explicarRecomendacion", { clubName, coincidencias, distanciaKm, pctCompletado });
}

// 3) Revisor de errores antes de publicar
export function revisarErrores(jornadas, camposUsados) {
  return llamar("revisarErrores", { jornadas, camposUsados });
}

// 4) Redactor de mensajes de WhatsApp
export function redactarMensajeWhatsApp(tipo, datosPartido) {
  return llamar("redactarMensajeWhatsApp", { tipo, datosPartido });
}
