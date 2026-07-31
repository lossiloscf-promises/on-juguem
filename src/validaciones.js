// Validaciones ligeras reutilizadas en varios formularios.

export function telefonoValido(telefono) {
  const limpio = (telefono || "").replace(/[\s-]/g, "");
  return /^\+?\d{9,15}$/.test(limpio);
}

export const LIMITES = {
  clubName: 60,
  telefono: 20,
  identificador: 30,
  jornadaLabel: 40,
  campo: 60,
};

// Una jornada no debería crearse con una fecha de referencia absurda
// (muy en el pasado, o dentro de demasiados años) — esto es solo para
// evitar despistes al escribir, no una regla de negocio estricta.
export function fechaJornadaRazonable(fechaISO) {
  const fecha = new Date(fechaISO);
  if (isNaN(fecha.getTime())) return false;
  const hoy = new Date();
  const haceUnMes = new Date(hoy);
  haceUnMes.setMonth(hoy.getMonth() - 1);
  const enDosAnyos = new Date(hoy);
  enDosAnyos.setFullYear(hoy.getFullYear() + 2);
  return fecha >= haceUnMes && fecha <= enDosAnyos;
}

// Comprueba que el día exacto elegido al cerrar un partido esté razonablemente
// cerca de la fecha de referencia de la jornada (para pillar despistes tipo
// cerrar "5-6 septiembre" con una fecha de otro fin de semana distinto).
export function diaCoincideConJornada(diaExactoISO, jornadaOrderDateISO, toleranciaDias = 4) {
  if (!jornadaOrderDateISO) return true;
  const dia = new Date(diaExactoISO);
  const referencia = new Date(jornadaOrderDateISO);
  if (isNaN(dia.getTime()) || isNaN(referencia.getTime())) return true;
  const diffDias = Math.abs((dia - referencia) / (1000 * 60 * 60 * 24));
  return diffDias <= toleranciaDias;
}

// Calcula el rango exacto de días que vale para una jornada, leyendo su
// etiqueta (ej. "5-6 septiembre" → del 5 al 6 de ese mes/año). Si la etiqueta
// no tiene ese formato, usa un margen de un día alrededor de la fecha de
// referencia. Devuelve { min, max } en formato YYYY-MM-DD para usar
// directamente como límites de un <input type="date">.
export function rangoFechasDeJornada(label, orderDateISO) {
  const base = new Date(orderDateISO);
  if (isNaN(base.getTime())) return { min: undefined, max: undefined };
  const match = (label || "").match(/^\s*(\d{1,2})\s*-\s*(\d{1,2})/);
  const aISO = (d) => d.toISOString().slice(0, 10);
  if (match) {
    const d1 = parseInt(match[1], 10);
    const d2 = parseInt(match[2], 10);
    const año = base.getFullYear();
    const mes = base.getMonth();
    const fechaMenor = new Date(año, mes, Math.min(d1, d2));
    const fechaMayor = new Date(año, mes, Math.max(d1, d2));
    return { min: aISO(fechaMenor), max: aISO(fechaMayor) };
  }
  const min = new Date(base);
  const max = new Date(base);
  max.setDate(max.getDate() + 1);
  return { min: aISO(min), max: aISO(max) };
}

// Comprueba si el club que quiere reservar tiene, en SU PROPIO calendario,
// alguna jornada con una fecha de referencia parecida a la del hueco que
// quiere pedir — si no tiene ninguna fecha cercana, no tiene sentido que
// reserve ahí, porque no tiene ese fin de semana contemplado en su propia
// planificación.
export function tieneJornadaCoincidente(misJornadas, jornadaObjetivoOrderDate, toleranciaDias = 4) {
  if (!jornadaObjetivoOrderDate) return true; // sin fecha de referencia que comparar, no bloqueamos
  return (misJornadas || []).some((j) => {
    if (!j.orderDate) return false;
    const diff = Math.abs((new Date(j.orderDate) - new Date(jornadaObjetivoOrderDate)) / (1000 * 60 * 60 * 24));
    return diff <= toleranciaDias;
  });
}
