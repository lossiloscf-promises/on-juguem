// Estructura de categorías del fútbol base/amateur (Comunitat Valenciana, FFCV).

export const GENEROS = ["Masculino", "Femenino"];

export const FORMATOS = ["Fútbol 11", "Fútbol 8"];

// Grupos de edad reales, cada uno independiente (nada de "englobar" varias edades juntas).
export const AGE_GROUPS_BY_FORMATO = {
  "Fútbol 11": ["Amateur", "Juvenil", "Cadete", "Infantil"],
  "Fútbol 8": ["Alevín", "Benjamín", "Prebenjamín", "Querubín"],
};

// Todas las edades en una sola lista (para colores, filtros, etc.)
export const ALL_AGE_GROUPS = [
  ...AGE_GROUPS_BY_FORMATO["Fútbol 11"],
  ...AGE_GROUPS_BY_FORMATO["Fútbol 8"],
];

// Estas categorías se dividen además por año de nacimiento dentro del mismo grupo de edad.
// Amateur y Juvenil no se dividen por año.
export const AGE_GROUPS_WITH_ANYO = ["Cadete", "Infantil", "Alevín", "Benjamín", "Prebenjamín", "Querubín"];

export const ANYOS = ["1er año", "2º año", "Mixto"];

// Ligas/categorías disponibles según género y grupo de edad.
export const CATEGORIAS = {
  Masculino: {
    "Amateur": ["Lliga Comunitat FFCV", "Primera FFCV", "Segona FFCV", "Tercera FFCV"],
    "Juvenil": ["Divisió d'Honor", "Liga Nacional", "Lliga Comunitat", "Primera FFCV", "Segona FFCV", "Tercera FFCV"],
    "Cadete": ["Liga Autonómica", "Preferente", "Primera Regional", "Segunda Regional"],
    "Infantil": ["Liga Autonómica", "Preferente", "Primera Regional", "Segunda Regional"],
    "Alevín": ["Preferente", "Primera", "Segona"],
    "Benjamín": ["Preferente", "Primera", "Segona"],
    "Prebenjamín": ["Preferente", "Primera", "Segona"],
    "Querubín": ["Preferente", "Primera", "Segona"],
  },
  Femenino: {
    "Amateur": ["Lliga Autonòmica Valenta", "Primera Valenta", "Segona Valenta"],
    "Juvenil": ["Lliga Juvenil Valenta"],
    "Cadete": ["Primera Cadet Valenta", "Segona Cadet Valenta"],
    "Infantil": ["Primera Infantil Valenta", "Segona Infantil Valenta"],
    "Alevín": ["Lliga Caixa Popular Valenta F8"],
    "Benjamín": ["Lliga Caixa Popular Valenta F8"],
    "Prebenjamín": ["Lliga Caixa Popular Valenta F8"],
    "Querubín": ["Lliga Caixa Popular Valenta F8"],
  },
};

// Nivel competitivo del equipo dentro de su categoría (para calibrar el rival).
export const NIVELES = ["Muy alto", "Alto", "Medio/alto", "Medio", "Medio/bajo", "Bajo", "Muy bajo"];

export const GROUP_COLORS = {
  "Amateur": "#2F6D5C",
  "Juvenil": "#C1502E",
  "Cadete": "#D48A34",
  "Infantil": "#C9A227",
  "Alevín": "#7A9A4A",
  "Benjamín": "#4C8A5E",
  "Prebenjamín": "#3F7D6B",
  "Querubín": "#6FA8A0",
};

export const groupColor = (grupo) => GROUP_COLORS[grupo] || "#2F6D5C";

export const formatoDeGrupo = (grupo) =>
  AGE_GROUPS_BY_FORMATO["Fútbol 11"].includes(grupo) ? "Fútbol 11" : "Fútbol 8";

// Fases del calendario de temporada, usadas para agrupar las columnas del cuadrante.
export const FASES = ["Pretemporada", "Postemporada"];

// Duración de cada PARTE en minutos, por grupo de edad (el partido completo son 2 partes).
export const DURACION_PARTE_MIN = {
  "Amateur": 45,
  "Juvenil": 45,
  "Cadete": 40,
  "Infantil": 35,
  "Alevín": 30,
  "Benjamín": 25,
  "Prebenjamín": 20,
  "Querubín": 15,
};

export const DESCANSO_ENTRE_PARTIDOS_MIN = 10;

export const duracionPartidoMin = (grupo) => (DURACION_PARTE_MIN[grupo] || 45) * 2;

// Devuelve la ventana de tiempo (en minutos desde medianoche) que ocupa un partido
// en un campo, incluyendo el descanso obligatorio posterior antes del siguiente.
export function ventanaOcupada(horaHHMM, grupo) {
  const [h, m] = horaHHMM.split(":").map(Number);
  const inicio = h * 60 + m;
  const fin = inicio + duracionPartidoMin(grupo) + DESCANSO_ENTRE_PARTIDOS_MIN;
  return [inicio, fin];
}

export function haySolape(horaA, grupoA, horaB, grupoB) {
  const [ia, fa] = ventanaOcupada(horaA, grupoA);
  const [ib, fb] = ventanaOcupada(horaB, grupoB);
  return ia < fb && ib < fa;
}
