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

// Orden de mayor a menor edad, usado para mostrar equipos y columnas siempre
// en el mismo orden lógico en toda la app (alta, cuadrante, selector de reserva...).
export const ORDEN_EDAD = ["Amateur", "Juvenil", "Cadete", "Infantil", "Alevín", "Benjamín", "Prebenjamín", "Querubín"];

// Dentro del mismo grupo de edad, el orden pedido es 2º año, luego Mixto,
// luego 1er año (no alfabético).
const ORDEN_ANYO = ["2º año", "Mixto", "1er año"];

export function compararEquipos(a, b) {
  const edadA = ORDEN_EDAD.indexOf(a.grupo);
  const edadB = ORDEN_EDAD.indexOf(b.grupo);
  if (edadA !== edadB) return edadA - edadB;
  const anyoA = ORDEN_ANYO.indexOf(a.anyo || "");
  const anyoB = ORDEN_ANYO.indexOf(b.anyo || "");
  return anyoA - anyoB;
}

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

// Un único sitio con el color y el nombre de cada estado de un hueco/partido,
// para que todo (cuadrante, tarjetas, exportaciones) use siempre lo mismo.
export const ESTADO_INFO = {
  libre: { label: "Libre", color: "#BFDBFE" },
  no_disponible: { label: "No disponible", color: "#E4E4E0" },
  pendiente: { label: "Pendiente", color: "#FFD8A8" },
  pactado: { label: "Pactado", color: "#FFE58A" },
  confirmado: { label: "Cerrado", color: "#B7E4C7" },
};
export const COLOR_CANCELACION_PENDIENTE = "#FFC9C0";

// Horarios válidos para cerrar un partido: de 9:00 a 22:00, cada 15 minutos —
// así nadie puede meter una hora rara tipo "12:08".
export const HORARIOS_VALIDOS = (() => {
  const lista = [];
  for (let h = 9; h <= 22; h++) {
    for (const m of [0, 15, 30, 45]) {
      if (h === 22 && m > 0) break; // no pasar de las 22:00
      lista.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return lista;
})();

// --- Coordinadores de contacto por categoría ---
// Un club puede tener un coordinador distinto por cada combinación de
// formato/género (F11 Masculino, F8 Masculino, F11 Femenino, F8 Femenino),
// o simplemente uno "general" que vale para todo si es una sola persona.
export const CLAVES_COORDINADOR = [
  { clave: "general", label: "Coordinador general" },
  { clave: "f11_m", label: "Coordinador Fútbol 11 Masculino" },
  { clave: "f8_m", label: "Coordinador Fútbol 8 Masculino" },
  { clave: "f11_f", label: "Coordinador Fútbol 11 Femenino" },
  { clave: "f8_f", label: "Coordinador Fútbol 8 Femenino" },
];

export function claveCoordinador(genero, formato) {
  const f = formato === "Fútbol 8" ? "f8" : "f11";
  const g = genero === "Femenino" ? "f" : "m";
  return `${f}_${g}`;
}

// Devuelve el contacto que corresponde a una categoría concreta: el
// específico si existe, si no el general, y si tampoco hay general, el
// contacto de siempre del club (para no dejar tirados a los clubes antiguos
// que todavía no han rellenado ningún coordinador).
export function contactoParaCategoria(profile, genero, formato) {
  const clave = claveCoordinador(genero, formato);
  const especifico = profile?.coordinadores?.[clave];
  if (especifico?.telefono || especifico?.email) return especifico;
  const general = profile?.coordinadores?.general;
  if (general?.telefono || general?.email) return general;
  return { nombre: profile?.clubName || "", telefono: profile?.telefono || "", email: profile?.email || "" };
}

export function tieneContactoParaCategoria(profile, genero, formato) {
  const c = contactoParaCategoria(profile, genero, formato);
  return !!(c?.telefono || c?.email);
}

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

// Dado un partido nuevo y la lista de partidos YA existentes en el mismo
// campo y día, decide si cabe o choca de verdad. Los partidos de Fútbol 11
// van de uno en uno; los de Fútbol 8 caben hasta de dos en dos, pero nunca
// mezclados con uno de Fútbol 11 en la misma franja horaria.
export function hayConflictoDeAforo(grupoNuevo, horaNueva, existentes) {
  const solapados = existentes.filter((e) => haySolape(horaNueva, grupoNuevo, e.horaExacta, e.grupo));
  if (solapados.length === 0) return null;
  const nuevoEsF8 = formatoDeGrupo(grupoNuevo) === "Fútbol 8";
  const todosF8 = nuevoEsF8 && solapados.every((e) => formatoDeGrupo(e.grupo) === "Fútbol 8");
  if (todosF8 && solapados.length < 2) return null; // cabe como 2º partido de F8
  return solapados[0]; // choque real: hay F11 de por medio, o ya hay 2 F8 (aforo lleno)
}
