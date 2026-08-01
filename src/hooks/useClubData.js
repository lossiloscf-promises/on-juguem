import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { hayConflictoDeAforo } from "../constants";

// Anota una entrada en el historial de auditoría — quién hizo qué y cuándo,
// sobre un hueco/partido concreto. Si falla el registro (raro), no rompe la
// acción principal: el historial es informativo, no crítico para el flujo.
async function registrarHistorial(slotId, accion) {
  try {
    const nombreClub = auth.currentUser?.displayName || "";
    // Se lee el hueco para saber quiénes son las dos partes implicadas, y
    // guardarlo también en la propia entrada — así la regla de lectura no
    // depende de que el hueco siga existiendo más adelante.
    let ownerUid = null;
    let requestedByUid = null;
    try {
      const slotSnap = await getDoc(doc(db, "slots", slotId));
      if (slotSnap.exists()) {
        ownerUid = slotSnap.data().ownerUid || null;
        requestedByUid = slotSnap.data().requestedByUid || null;
      }
    } catch {
      // si no se puede leer el hueco, se registra igualmente sin esos datos
    }
    await addDoc(collection(db, "historial"), {
      slotId,
      accion,
      quienUid: auth.currentUser?.uid || null,
      quienClubName: nombreClub,
      ownerUid,
      requestedByUid,
      timestamp: serverTimestamp(),
    });
  } catch {
    // silencioso a propósito
  }
}

// Se reutiliza desde el módulo de torneos, que también escribe historial.
export const registrarHistorialTorneo = registrarHistorial;

// Equipos del propio coordinador (en tiempo real)
export function useMyTeams(uid) {
  const [teams, setTeams] = useState([]);
  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, "teams"), where("ownerUid", "==", uid));
    return onSnapshot(q, (snap) => setTeams(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, [uid]);
  return teams;
}

// Huecos de MIS equipos (para el panel de coordinador)
export function useMySlots(uid) {
  const [slots, setSlots] = useState([]);
  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, "slots"), where("ownerUid", "==", uid));
    return onSnapshot(q, (snap) => setSlots(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, [uid]);
  return slots;
}

// Todos los equipos de la plataforma (para el directorio "Explorar clubes")
export function useAllTeams() {
  const [teams, setTeams] = useState([]);
  useEffect(() => {
    const q = collection(db, "teams");
    return onSnapshot(q, (snap) => setTeams(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, []);
  return teams;
}

// Todos los huecos de la plataforma (para el buscador de rivales y las comprobaciones de solape)
export function useAllSlots() {
  const [slots, setSlots] = useState([]);
  useEffect(() => {
    const q = collection(db, "slots");
    return onSnapshot(q, (snap) => setSlots(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, []);
  return slots;
}

// Historial de un hueco/partido concreto (para mostrar "qué ha pasado aquí").
export function useHistorialDeSlot(slotId) {
  const [historial, setHistorial] = useState([]);
  useEffect(() => {
    if (!slotId) return;
    const q = query(collection(db, "historial"), where("slotId", "==", slotId));
    return onSnapshot(q, (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      lista.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));
      setHistorial(lista);
    });
  }, [slotId]);
  return historial;
}

const slotDocId = (teamId, jornadaId) => `${teamId}__${jornadaId}`;

// Crea huecos "libre" para cada combinación equipo×jornada que todavía no
// exista — se usa tanto al dar de alta un equipo nuevo (rellena todas las
// jornadas ya creadas) como al crear una jornada nueva (rellena todos los
// equipos ya existentes). Si el hueco ya existe (con cualquier estado),
// no se toca, para no pisar nada que ya esté en marcha.
export async function crearHuecosLibresEnBloque(uid, combinaciones) {
  await Promise.all(
    combinaciones.map(async ({ team, jornada }) => {
      const id = slotDocId(team.id, jornada.id);
      const ref = doc(db, "slots", id);
      const actual = await getDoc(ref);
      if (actual.exists()) return; // ya hay algo ahí, no lo tocamos

      const estadoInicial = "libre";

      await setDoc(ref, {
        ownerUid: uid,
        teamId: team.id,
        clubName: team.clubName,
        ownerTelefono: team.ownerTelefono || "",
        ownerEmail: team.ownerEmail || "",
        genero: team.genero,
        formato: team.formato,
        grupo: team.grupo,
        anyo: team.anyo || "",
        categoria: team.categoria,
        nivel: team.nivel,
        identificador: team.identificador || "",
        jornadaId: jornada.id,
        jornadaLabel: jornada.label,
        jornadaOrderDate: jornada.orderDate,
        fase: jornada.fase,
        status: estadoInicial,
        sede: null,
        diaExacto: "",
        horaExacta: "",
        campoExacto: "",
        requestedByUid: null,
        requestedByClubName: null,
        requestedByTelefono: null,
        requestedByEmail: null,
        cancelacionPropuestaPor: null,
        avisoEquipoBorrado: false,
        avisoTexto: "",
        createdAt: serverTimestamp(),
      });
    })
  );
}

export async function addTeam(
  uid,
  clubName,
  { genero, formato, grupo, anyo, categoria, nivel, identificador, ownerTelefono, ownerEmail }
) {
  return addDoc(collection(db, "teams"), {
    ownerUid: uid,
    clubName,
    ownerTelefono: ownerTelefono || "",
    ownerEmail: ownerEmail || "",
    genero,
    formato,
    grupo,
    anyo: anyo || "",
    categoria,
    nivel,
    identificador: identificador || "",
    createdAt: serverTimestamp(),
  });
}

// Marca un equipo como DISPONIBLE o NO DISPONIBLE para una jornada del calendario.
// Solo se puede tocar si todavía no hay nada pactado con nadie (si no, hay que gestionarlo
// desde las solicitudes / el cierre del partido).
// Quita del todo la relación equipo-jornada (la celda vuelve a quedar vacía,
// como si nunca hubiera existido para ese equipo) — para cuando un equipo
// simplemente no participa esa jornada. Si hay un partido en marcha, se
// bloquea: primero hay que cancelarlo de mutuo acuerdo con el rival.
export async function eliminarHuecoDeEquipo(uid, teamId, jornadaId, statusActual) {
  if (!["libre", "no_disponible"].includes(statusActual)) {
    throw new Error("Este hueco tiene un partido en marcha. Cancélalo primero (de mutuo acuerdo con el rival) antes de quitarlo del cuadrante.");
  }
  const id = slotDocId(teamId, jornadaId);
  return deleteDoc(doc(db, "slots", id));
}

export async function setDisponibilidad(uid, team, jornada, disponible) {
  const id = slotDocId(team.id, jornada.id);
  const ref = doc(db, "slots", id);

  // Salvaguarda: si ya hay algo en marcha con otro club (pendiente/pactado/confirmado),
  // no lo pisamos por aquí — hay que gestionarlo desde las solicitudes o cancelar antes.
  const actual = await getDoc(ref);
  if (actual.exists() && !["libre", "no_disponible"].includes(actual.data().status)) {
    throw new Error(
      "Este hueco ya tiene un partido en marcha con otro club (pendiente, pactado o confirmado). Gestiónalo desde ahí antes de cambiar la disponibilidad."
    );
  }

  return setDoc(
    ref,
    {
      ownerUid: uid,
      teamId: team.id,
      clubName: team.clubName,
      ownerTelefono: team.ownerTelefono || "",
      ownerEmail: team.ownerEmail || "",
      genero: team.genero,
      formato: team.formato,
      grupo: team.grupo,
      anyo: team.anyo || "",
      categoria: team.categoria,
      nivel: team.nivel,
      identificador: team.identificador || "",
      jornadaId: jornada.id,
      jornadaLabel: jornada.label,
      jornadaOrderDate: jornada.orderDate,
      fase: jornada.fase,
      status: disponible ? "libre" : "no_disponible",
      sede: null,
      diaExacto: "",
      horaExacta: "",
      campoExacto: "",
      requestedByUid: null,
      requestedByClubName: null,
      requestedByTelefono: null,
      requestedByEmail: null,
      cancelacionPropuestaPor: null,
      avisoEquipoBorrado: false,
      avisoTexto: "",
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

// Propone cancelar un partido pactado/confirmado — no cambia el estado
// todavía, solo deja marcado quién lo propone. La otra parte tiene que
// aceptarlo (o puede rechazarlo) para que se libere de verdad.
export async function proponerCancelacion(slotId) {
  await updateDoc(doc(db, "slots", slotId), {
    cancelacionPropuestaPor: auth.currentUser?.uid || null,
  });
  registrarHistorial(slotId, "Ha propuesto cancelar este partido");
}

// Rechaza la propuesta de cancelación (o la retira, si eres quien la propuso).
// El partido se queda exactamente como estaba.
export async function rechazarCancelacion(slotId) {
  await updateDoc(doc(db, "slots", slotId), {
    cancelacionPropuestaPor: null,
  });
  registrarHistorial(slotId, "Propuesta de cancelación rechazada/retirada");
}

// Acepta la cancelación propuesta por la otra parte — aquí sí se libera
// el hueco de verdad, volviendo a quedar "libre" para buscar otro rival.
export async function aceptarCancelacion(slotId) {
  await updateDoc(doc(db, "slots", slotId), {
    status: "libre",
    sede: null,
    diaExacto: "",
    horaExacta: "",
    campoExacto: "",
    requestedByUid: null,
    requestedByClubName: null,
    requestedByTelefono: null,
    requestedByEmail: null,
    cancelacionPropuestaPor: null,
  });
  registrarHistorial(slotId, "Cancelación aceptada — partido cancelado de mutuo acuerdo");
}

// Descarta el aviso de "el equipo rival fue borrado" una vez leído.
export async function descartarAviso(slotId) {
  return updateDoc(doc(db, "slots", slotId), {
    avisoEquipoBorrado: false,
    avisoTexto: "",
  });
}

// Libera un hueco AUTOMÁTICAMENTE porque el equipo implicado (propio o del
// rival) se ha borrado — no hace falta acuerdo mutuo aquí, porque la otra
// parte ya no puede aceptar nada. Deja un aviso visible para quien lo vea.
async function liberarPorBajaDeEquipo(slotId, otroClubName) {
  await updateDoc(doc(db, "slots", slotId), {
    status: "libre",
    sede: null,
    diaExacto: "",
    horaExacta: "",
    campoExacto: "",
    requestedByUid: null,
    requestedByClubName: null,
    requestedByTelefono: null,
    requestedByEmail: null,
    cancelacionPropuestaPor: null,
    avisoEquipoBorrado: true,
    avisoTexto: `Este partido se ha liberado automáticamente porque ${otroClubName || "el otro club"} borró el equipo implicado.`,
  });
  registrarHistorial(slotId, "Hueco liberado automáticamente: el equipo implicado fue borrado");
}

export async function updateTeam(teamId, cambios) {
  return updateDoc(doc(db, "teams", teamId), cambios);
}

// Borra un equipo. Si tenía partidos en marcha (propios, o reservados en huecos
// de otros clubes), esos huecos se LIBERAN automáticamente en vez de bloquear
// el borrado — porque una vez el equipo desaparece, la otra parte ya no puede
// "aceptar" nada, así que no tiene sentido pedirle acuerdo mutuo. Queda un aviso
// visible para el club afectado explicando qué ha pasado.
export async function deleteTeam(uid, teamId, slotsPropiosDeEsteEquipo) {
  const propiosActivos = slotsPropiosDeEsteEquipo.filter((s) =>
    ["pendiente", "pactado", "confirmado"].includes(s.status)
  );
  const propiosInactivos = slotsPropiosDeEsteEquipo.filter((s) =>
    ["libre", "no_disponible"].includes(s.status)
  );

  // Importante: el equipo se borra PRIMERO. Las reglas del servidor exigen
  // que el equipo ya no exista de verdad antes de dejar liberar sus huecos
  // automáticamente — así nadie puede fingir una baja de equipo para
  // saltarse el acuerdo mutuo de cancelación.
  await deleteDoc(doc(db, "teams", teamId));

  await Promise.all(propiosActivos.map((s) => liberarPorBajaDeEquipo(s.id, s.requestedByClubName)));
  await Promise.all(propiosInactivos.map((s) => deleteDoc(doc(db, "slots", s.id))));

  // Además, este club podría tener reservado un hueco en el cuadrante de OTRO
  // club (donde este equipo no es el "dueño" del hueco, solo quien lo pidió).
  const comoSolicitanteSnap = await getDocs(query(collection(db, "slots"), where("requestedByUid", "==", uid)));
  const comoSolicitanteActivos = comoSolicitanteSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((s) => ["pendiente", "pactado", "confirmado"].includes(s.status) && s.requestedByTeamId === teamId);
  await Promise.all(comoSolicitanteActivos.map((s) => liberarPorBajaDeEquipo(s.id, s.clubName)));
}

export async function requestBooking(slotId, requesterUid, requesterClubName, requesterTelefono, requesterEmail, requesterTeamId) {
  await updateDoc(doc(db, "slots", slotId), {
    status: "pendiente",
    requestedByUid: requesterUid,
    requestedByClubName: requesterClubName,
    requestedByTelefono: requesterTelefono || "",
    requestedByEmail: requesterEmail || "",
    requestedByTeamId: requesterTeamId || null,
  });
  registrarHistorial(slotId, `${requesterClubName} solicitó este hueco`);
}

export async function rejectRequest(slotId) {
  await updateDoc(doc(db, "slots", slotId), {
    status: "libre",
    requestedByUid: null,
    requestedByClubName: null,
    requestedByTelefono: null,
    requestedByEmail: null,
  });
  registrarHistorial(slotId, "Solicitud rechazada");
}

// El coordinador acepta la solicitud — el partido queda PACTADO al momento,
// sin necesitar decidir todavía dónde se juega. Eso se decide después con
// decidirJugarEnCasa/decidirJugarFuera, cuando os venga bien.
export async function aceptarPartido(slotId) {
  await updateDoc(doc(db, "slots", slotId), {
    status: "pactado",
    sede: null,
  });
  registrarHistorial(slotId, "Solicitud aceptada — pactado, falta decidir dónde se juega");
}

// Ya con el partido pactado, el dueño decide dónde se juega.
// Propone dónde se juega — cualquiera de las dos partes puede hacerlo, tanto
// para decidirlo por primera vez como para proponer CAMBIARLO más adelante
// (mientras siga "pactado", antes de cerrar día/hora/campo exactos).
// detalles (opcional) = { diaExacto, horaExacta, campoExacto } — si se dan,
// al aceptar se pasa directo a "cerrado", sin el paso intermedio. Vale tanto
// para pactar por primera vez como para cambiar de campo en un partido que
// ya estaba cerrado (por ejemplo, si a última hora hay que jugar en el otro).
export async function proponerSede(slotId, sedePropuesta, detalles) {
  await updateDoc(doc(db, "slots", slotId), {
    sedePropuestaPor: auth.currentUser?.uid || null,
    sedePropuesta,
    sedePropuestaDetalles: detalles || null,
  });
  const conDetalle = detalles ? ` el ${detalles.diaExacto} ${detalles.horaExacta} en ${detalles.campoExacto}` : "";
  registrarHistorial(slotId, `Ha propuesto jugar ${sedePropuesta === "local" ? "en campo del anfitrión" : "en campo de quien reservó"}${conDetalle}`);
}

// La otra parte acepta — se aplica de verdad. Si venían día/hora/campo en la
// propuesta, el partido queda "cerrado" al momento; si no, queda "pactado"
// como antes, para cerrarlo más adelante.
export async function aceptarSede(slotId, sedePropuesta, detalles) {
  const payload = {
    sede: sedePropuesta,
    sedePropuestaPor: null,
    sedePropuesta: null,
    sedePropuestaDetalles: null,
  };
  if (detalles?.diaExacto && detalles?.horaExacta && detalles?.campoExacto) {
    payload.status = "confirmado";
    payload.diaExacto = detalles.diaExacto;
    payload.horaExacta = detalles.horaExacta;
    payload.campoExacto = detalles.campoExacto;
  } else {
    payload.status = "pactado";
  }
  await updateDoc(doc(db, "slots", slotId), payload);
  registrarHistorial(slotId, payload.status === "confirmado" ? "Sede y horario aceptados — partido cerrado" : "Sede aceptada");
}

// Rechaza la propuesta (o la retira, si eres quien la hizo) — se queda como
// estaba (sin sede decidida, o con la sede anterior si ya había una).
export async function rechazarSede(slotId) {
  await updateDoc(doc(db, "slots", slotId), {
    sedePropuestaPor: null,
    sedePropuesta: null,
    sedePropuestaDetalles: null,
  });
  registrarHistorial(slotId, "Propuesta de sede rechazada/retirada");
}

// El club que reservó (y va a hacer de local porque se decidió jugar en su campo)
// cierra el partido con el día, hora y campo exactos. También pasa por la
// transacción atómica, por la misma razón que cerrarComoLocal.
export async function cerrarComoVisitante(slotId, { diaExacto, horaExacta, campoExacto, grupo, teamId }, allSlots) {
  return cerrarPartidoAtomico(slotId, { diaExacto, horaExacta, campoExacto, grupo }, allSlots, teamId);
}

// El dueño del hueco, cuando decidió jugar EN SU campo, fija el día/hora/campo
// exactos cuando le venga bien (no hace falta que sea al aceptar la solicitud).
// Propone cambiar el día/hora/campo de un partido YA cerrado — no se aplica
// al momento, queda pendiente de que la otra parte lo acepte o lo rechace.
export async function proponerCambioHorario(slotId, { diaExacto, horaExacta, campoExacto }) {
  await updateDoc(doc(db, "slots", slotId), {
    cambioPropuestoPor: auth.currentUser?.uid || null,
    cambioPropuesto: { diaExacto, horaExacta, campoExacto },
  });
  registrarHistorial(slotId, `Ha propuesto cambiar el partido a ${diaExacto} ${horaExacta} en ${campoExacto}`);
}

// La otra parte acepta el cambio propuesto — se aplica de verdad.
export async function aceptarCambioHorario(slotId, cambioPropuesto) {
  await updateDoc(doc(db, "slots", slotId), {
    diaExacto: cambioPropuesto.diaExacto,
    horaExacta: cambioPropuesto.horaExacta,
    campoExacto: cambioPropuesto.campoExacto,
    cambioPropuestoPor: null,
    cambioPropuesto: null,
  });
  registrarHistorial(slotId, "Cambio de horario aceptado");
}

// Rechaza el cambio propuesto (o lo retira, si eres quien lo propuso) — el
// partido se queda con el día/hora/campo que ya tenía.
export async function rechazarCambioHorario(slotId) {
  await updateDoc(doc(db, "slots", slotId), {
    cambioPropuestoPor: null,
    cambioPropuesto: null,
  });
  registrarHistorial(slotId, "Cambio de horario rechazado/retirado");
}

export async function cerrarComoLocal(slotId, { diaExacto, horaExacta, campoExacto, grupo, teamId }, allSlots) {
  return cerrarPartidoAtomico(slotId, { diaExacto, horaExacta, campoExacto, grupo }, allSlots, teamId);
}

// Comprueba si programar un partido en un campo/día/hora concretos chocaría con otro
// partido ya confirmado en ese mismo campo (dejando el descanso obligatorio entre ambos).
export function hayConflictoDeHorario(allSlots, { campoExacto, diaExacto, horaExacta, grupo }, slotIdExcluir) {
  const campoNormalizado = campoExacto.trim().toLowerCase();
  const mismoCampoDia = allSlots.filter((s) => {
    if (s.id === slotIdExcluir) return false;
    if (s.status !== "confirmado") return false;
    if (!s.campoExacto || !s.diaExacto || !s.horaExacta) return false;
    if (s.campoExacto.trim().toLowerCase() !== campoNormalizado) return false;
    return s.diaExacto === diaExacto;
  });
  return hayConflictoDeAforo(grupo, horaExacta, mismoCampoDia);
}

// Comprueba si este equipo YA tiene otro partido confirmado ese mismo día,
// en cualquier campo (un equipo no puede jugar dos partidos el mismo día).
export function hayOtroPartidoMismoDia(allSlots, { teamId, diaExacto }, slotIdExcluir) {
  const conflicto = allSlots.find((s) => {
    if (s.id === slotIdExcluir) return false;
    if (s.teamId !== teamId) return false;
    if (s.status !== "confirmado") return false;
    if (!s.diaExacto) return false;
    return s.diaExacto === diaExacto;
  });
  return conflicto || null;
}

// Reúne, a partir de lo que ya tenemos cargado en el navegador, qué otros huecos
// PODRÍAN chocar con este cierre (mismo campo/hora, o mismo equipo el mismo día).
// Estos candidatos son los que luego se vuelven a comprobar de verdad, uno a uno,
// dentro de la transacción atómica — así evitamos que dos coordinadores cerrando
// a la vez, en el mismo segundo, cuelen los dos un partido que en realidad chocan.
function candidatosDeConflicto(allSlots, datosCierre, slotIdExcluir) {
  const ids = new Set();
  const campoNormalizado = datosCierre.campoExacto.trim().toLowerCase();
  allSlots.forEach((s) => {
    if (s.id === slotIdExcluir) return;
    if (s.status !== "confirmado") return;
    if (!s.campoExacto || !s.diaExacto || !s.horaExacta) return;
    if (s.campoExacto.trim().toLowerCase() === campoNormalizado && s.diaExacto === datosCierre.diaExacto) {
      ids.add(s.id); // mismo campo/día: candidato a recontar el aforo, choque o no
    }
  });
  const porEquipo = hayOtroPartidoMismoDia(allSlots, datosCierre, slotIdExcluir);
  if (porEquipo) ids.add(porEquipo.id);
  return [...ids];
}

// Cierra un partido (a casa o como visitante) de forma ATÓMICA: dentro de una única
// transacción, se vuelve a leer el propio hueco y cada candidato de conflicto
// directamente de Firestore (no de lo que tenemos cargado en el navegador, que
// puede estar unos segundos desactualizado) y solo si sigue sin haber choque
// real se guarda el cierre. Si alguien más se ha adelantado en el mismo instante,
// la transacción se cancela entera y no se guarda nada a medias.
async function cerrarPartidoAtomico(slotId, datosNuevos, allSlots, teamId) {
  const candidatoIds = candidatosDeConflicto(allSlots, { ...datosNuevos, teamId }, slotId);

  return runTransaction(db, async (transaction) => {
    const slotRef = doc(db, "slots", slotId);
    const slotSnap = await transaction.get(slotRef);
    if (!slotSnap.exists()) {
      throw new Error("Este partido ya no existe. Puede que se haya cancelado justo ahora.");
    }

    const candidatosMismoCampoDia = [];
    for (const candidatoId of candidatoIds) {
      const candidatoSnap = await transaction.get(doc(db, "slots", candidatoId));
      if (!candidatoSnap.exists()) continue;
      const c = candidatoSnap.data();
      if (c.status !== "confirmado") continue; // ya no está confirmado de verdad, no choca

      const mismoCampoDia =
        c.campoExacto && c.diaExacto && c.horaExacta &&
        c.campoExacto.trim().toLowerCase() === datosNuevos.campoExacto.trim().toLowerCase() &&
        c.diaExacto === datosNuevos.diaExacto;
      if (mismoCampoDia) candidatosMismoCampoDia.push(c);

      const mismoEquipoMismoDia = c.teamId === teamId && c.diaExacto === datosNuevos.diaExacto;
      if (mismoEquipoMismoDia) {
        throw new Error("Justo se ha confirmado otro partido de este mismo equipo ese día. Elige otra jornada u otro equipo.");
      }
    }

    const choqueDeAforo = hayConflictoDeAforo(datosNuevos.grupo, datosNuevos.horaExacta, candidatosMismoCampoDia);
    if (choqueDeAforo) {
      throw new Error(`Justo se ha confirmado otro partido en ese campo a las ${choqueDeAforo.horaExacta}. Elige otra hora.`);
    }

    transaction.update(slotRef, {
      status: "confirmado",
      diaExacto: datosNuevos.diaExacto,
      horaExacta: datosNuevos.horaExacta,
      campoExacto: datosNuevos.campoExacto,
      ...(datosNuevos.sede ? { sede: datosNuevos.sede } : {}),
    });

    const historialRef = doc(collection(db, "historial"));
    const nombreClubCierre = auth.currentUser?.displayName || "";
    const datosSlot = slotSnap.data();
    transaction.set(historialRef, {
      slotId,
      accion: `Partido cerrado: ${datosNuevos.diaExacto} ${datosNuevos.horaExacta} en ${datosNuevos.campoExacto}`,
      quienUid: auth.currentUser?.uid || null,
      quienClubName: nombreClubCierre,
      ownerUid: datosSlot.ownerUid || null,
      requestedByUid: datosSlot.requestedByUid || null,
      timestamp: serverTimestamp(),
    });
  });
}

