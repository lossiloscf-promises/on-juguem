// Sistema de traducción sencillo: un diccionario por idioma, y una función
// t(clave) que busca la traducción en el idioma actual, con el castellano
// como respaldo si a alguna clave todavía no le hemos puesto valenciano.
// El idioma elegido se guarda en el navegador (no hace falta cuenta).

const CLAVE_IDIOMA = "cl_idioma";

export const IDIOMAS = [
  { codigo: "es", nombre: "Castellano" },
  { codigo: "val", nombre: "Valencià" },
];

export function getIdioma() {
  try {
    return localStorage.getItem(CLAVE_IDIOMA) || "es";
  } catch {
    return "es";
  }
}

export function setIdioma(codigo) {
  try {
    localStorage.setItem(CLAVE_IDIOMA, codigo);
  } catch {
    // si el navegador bloquea localStorage, simplemente no se recuerda
  }
}

// Diccionario: castellano es el idioma base (siempre completo). El resto
// de idiomas solo necesitan tener las claves que ya se han traducido — las
// que falten, se muestran en castellano automáticamente.
const es = {
  "nav.mi_club": "MI CLUB",
  "nav.temporada": "PRE/POST TEMPORADA",
  "nav.busco_rival": "BUSCO RIVAL",
  "nav.cuadrante": "CUADRANTE",
  "nav.torneos": "TORNEOS",
  "nav.ajustes": "AJUSTES",
  "nav.salir": "SALIR",
  "app.subtitulo_dentro": "Amistosos sin lios de whatsapp",
  "app.subtitulo_fuera": "Amistosos pretemporada · sin lios de whatsapp",
  "identidad.titulo": "¿QUIÉN ERES HOY?",
  "identidad.explicacion": "si varias personas usáis este mismo acceso, decir quién eres ayuda a que quede claro en el historial de cada partido quién hizo cada cosa. No cambia lo que puedes ver ni hacer.",
  "identidad.continuar": "Continuar",
  "login.entrar": "ENTRAR",
  "login.crear_club": "CREAR CLUB",
  "login.email": "EMAIL",
  "login.contrasena": "CONTRASEÑA",
  "login.telefono": "TELÉFONO DE CONTACTO",
  "login.tu_club": "TU CLUB",
  "login.boton_entrar": "Entrar",
  "login.boton_crear": "Crear mi club",
  "login.olvidaste": "¿Has olvidado tu contraseña?",
  "login.no_tienes_club": "¿Aún no tienes club?",
  "login.crea_uno": "Crea uno",
  "login.ya_tienes_cuenta": "¿Ya tienes cuenta?",
  "login.entra": "Entra",
  "cuadrante.titulo": "CUADRANTE",
  "cuadrante.exportar_pdf": "Exportar a PDF",
  "cuadrante.exportar_excel": "Exportar a Excel",
  "cuadrante.equipo": "Equipo",
  "estado.libre": "Libre",
  "estado.no_disponible": "No disponible",
  "estado.pendiente": "Pendiente",
  "estado.pactado": "Pactado",
  "estado.confirmado": "Cerrado",
  "busco_rival.explorar": "Explorar clubes",
  "busco_rival.filtros": "Búsqueda por filtros",
  "busco_rival.volver": "Volver al directorio",
  "ajustes.titulo": "Ajustes",
  "temporada.titulo": "CALENDARIO DE LA TEMPORADA",
  "mi_club.titulo": "TUS EQUIPOS",
  "mi_club.anadir_equipo": "AÑADIR EQUIPO",
  "ajustes.datos_contacto": "Datos de contacto",
  "ajustes.administracion": "ADMINISTRACIÓN",
  "ajustes.verificar_telefonos": "VERIFICAR TELÉFONOS",
  "ajustes.lista_oficial": "LISTA OFICIAL DE CLUBES",
  "ajustes.notificaciones": "Notificaciones",
  "ajustes.escudo": "ESCUDO DEL CLUB",
  "ajustes.enlace_publico": "Enlace público de tu cuadrante",
  "ajustes.zona_peligrosa": "Zona peligrosa",
  "ajustes.instalaciones": "Tus instalaciones",
  "ajustes.coordinadores": "Coordinadores de contacto",
  "torneos.titulo": "TORNEOS Y TRIANGULARES",
  "torneos.nuevo": "NUEVO TORNEO",
  "torneos.organizados": "TUS TORNEOS ORGANIZADOS",
  "torneos.abiertos": "TORNEOS ABIERTOS PARA APUNTARSE",
  "busco_rival.resultados": "RESULTADOS",
};

const val = {
  "nav.mi_club": "EL MEU CLUB",
  "nav.temporada": "PRE/POST TEMPORADA",
  "nav.busco_rival": "BUSQUE RIVAL",
  "nav.cuadrante": "QUADRE",
  "nav.torneos": "TORNEIGS",
  "nav.ajustes": "AJUSTS",
  "nav.salir": "EIXIR",
  "app.subtitulo_dentro": "Amistosos sense embolics de whatsapp",
  "app.subtitulo_fuera": "Amistosos pretemporada · sense embolics de whatsapp",
  "identidad.titulo": "QUI ERES HUI?",
  "identidad.explicacion": "si diverses persones useu este mateix accés, dir qui eres ajuda a que quede clar en l'historial de cada partit qui va fer cada cosa. No canvia el que pots vore ni fer.",
  "identidad.continuar": "Continuar",
  "login.entrar": "ENTRAR",
  "login.crear_club": "CREAR CLUB",
  "login.email": "CORREU ELECTRÒNIC",
  "login.contrasena": "CONTRASENYA",
  "login.telefono": "TELÈFON DE CONTACTE",
  "login.tu_club": "EL TEU CLUB",
  "login.boton_entrar": "Entrar",
  "login.boton_crear": "Crear el meu club",
  "login.olvidaste": "Has oblidat la contrasenya?",
  "login.no_tienes_club": "Encara no tens club?",
  "login.crea_uno": "Crea'n un",
  "login.ya_tienes_cuenta": "Ja tens compte?",
  "login.entra": "Entra",
  "cuadrante.titulo": "QUADRE",
  "cuadrante.exportar_pdf": "Exportar a PDF",
  "cuadrante.exportar_excel": "Exportar a Excel",
  "cuadrante.equipo": "Equip",
  "estado.libre": "Lliure",
  "estado.no_disponible": "No disponible",
  "estado.pendiente": "Pendent",
  "estado.pactado": "Pactat",
  "estado.confirmado": "Tancat",
  "busco_rival.explorar": "Explorar clubs",
  "busco_rival.filtros": "Busca per filtres",
  "busco_rival.volver": "Tornar al directori",
  "ajustes.titulo": "Ajusts",
  "temporada.titulo": "CALENDARI DE LA TEMPORADA",
  "mi_club.titulo": "ELS TEUS EQUIPS",
  "mi_club.anadir_equipo": "AFEGIR EQUIP",
  "ajustes.datos_contacto": "Dades de contacte",
  "ajustes.administracion": "ADMINISTRACIÓ",
  "ajustes.verificar_telefonos": "VERIFICAR TELÈFONS",
  "ajustes.lista_oficial": "LLISTA OFICIAL DE CLUBS",
  "ajustes.notificaciones": "Notificacions",
  "ajustes.escudo": "ESCUT DEL CLUB",
  "ajustes.enlace_publico": "Enllaç públic del teu quadre",
  "ajustes.zona_peligrosa": "Zona perillosa",
  "ajustes.instalaciones": "Les teues instal·lacions",
  "ajustes.coordinadores": "Coordinadors de contacte",
  "torneos.titulo": "TORNEIGS I TRIANGULARS",
  "torneos.nuevo": "NOU TORNEIG",
  "torneos.organizados": "ELS TEUS TORNEIGS ORGANITZATS",
  "torneos.abiertos": "TORNEIGS OBERTS PER APUNTAR-SE",
  "busco_rival.resultados": "RESULTATS",
};

const DICCIONARIOS = { es, val };

export function t(clave) {
  const idioma = getIdioma();
  return DICCIONARIOS[idioma]?.[clave] || es[clave] || clave;
}
