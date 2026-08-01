// Guarda, solo para esta sesión del navegador (se olvida al cerrar), quién
// de vuestro club está usando la app ahora mismo — únicamente para que el
// historial de cada partido pueda distinguir quién hizo cada cosa, si varias
// personas compartís el mismo acceso. No afecta a lo que se puede ver o hacer.
const CLAVE = "cl_identidad";

export const IDENTIDADES_SUGERIDAS = [
  "Coordinador Fútbol 11 Masculino",
  "Coordinador Fútbol 8 Masculino",
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
    sessionStorage.setItem(CLAVE, valor);
  } catch {
    // si el navegador bloquea sessionStorage, simplemente no se recuerda
  }
}
