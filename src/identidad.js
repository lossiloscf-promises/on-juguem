// Guardado solo en esta pestaña/sesión del navegador (no en la cuenta) —
// cada coordinador que comparte el login del club puede decir "quién es"
// para que quede reflejado en el historial, sin que esto dé ni quite
// ningún permiso real: es solo una etiqueta para el rastro de auditoría.
const CLAVE = "cl_identidad_actual";

export const IDENTIDADES_SUGERIDAS = [
  "Coordinador general",
  "Coordinador Fútbol 11",
  "Coordinador Fútbol 8",
  "Coordinador Fútbol 11 Femenino",
  "Coordinador Fútbol 8 Femenino",
];

export function getIdentidadActual() {
  try {
    return sessionStorage.getItem(CLAVE) || "";
  } catch {
    return "";
  }
}

export function setIdentidadActual(valor) {
  try {
    sessionStorage.setItem(CLAVE, valor || "");
  } catch {
    // si el navegador bloquea sessionStorage, simplemente no se guarda
  }
}
