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
import { haySolape } from "../constants";

// Anota una entrada en el historial de auditoría — quién hizo qué y cuándo,
// sobre un hueco/partido concreto. Si falla el registro (raro), no rompe la
// acción principal: el historial es informativo, no crítico para el flujo.
async function registrarHistorial(slotId, accion) {
  try {
    await addDoc(collection(db, "historial"), {
      slotId,
      accion,
      quienUid: auth.currentUser?.uid || null,
      quienClubName: auth.currentUser?.displayName || "",
      timestamp: serverTimestamp(),
    });
  } catch {
    // silencioso a propósito
  }
}

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

  await Promise.all(propiosActivos.map((s) => liberarPorBajaDeEquipo(s.id, s.requestedByClubName)));
  await Promise.all(propiosInactivos.map((s) => deleteDoc(doc(db, "slots", s.id))));

  // Además, este club podría tener reservado un hueco en el cuadrante de OTRO
  // club (donde este equipo no es el "dueño" del hueco, solo quien lo pidió).
  const comoSolicitanteSnap = await getDocs(query(collection(db, "slots"), where("requestedByUid", "==", uid)));
  const comoSolicitanteActivos = comoSolicitanteSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((s) => ["pendiente", "pactado", "confirmado"].includes(s.status));
  await Promise.all(comoSolicitanteActivos.map((s) => liberarPorBajaDeEquipo(s.id, s.clubName)));

  return deleteDoc(doc(db, "teams", teamId));
}

export async function requestBooking(slotId, requesterUid, requesterClubName, requesterTelefono, requesterEmail) {
  await updateDoc(doc(db, "slots", slotId), {
    status: "pendiente",
    requestedByUid: requesterUid,
    requestedByClubName: requesterClubName,
    requestedByTelefono: requesterTelefono || "",
    requestedByEmail: requesterEmail || "",
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

// El coordinador (dueño del hueco) acepta y propone jugar EN SU CAMPO.
// Igual que aceptarFueraCasa: queda "pactado" al momento. El día/hora/campo
// exactos se fijan después (aunque sea el mismo dueño quien los sabrá,
// puede tardar en decidirlo hasta la semana del partido) con cerrarComoLocal.
export async function aceptarEnCasa(slotId) {
  await updateDoc(doc(db, "slots", slotId), {
    status: "pactado",
    sede: "local",
  });
  registrarHistorial(slotId, "Aceptado — se juega en el campo del anfitrión");
}

// El coordinador acepta pero propone jugar EN CAMPO DEL RIVAL.
// Queda "pactado" (el partido está cerrado en cuanto a que se va a jugar),
// pero falta que el rival diga día/hora/campo exactos, porque es él quien lo sabe.
export async function aceptarFueraCasa(slotId) {
  await updateDoc(doc(db, "slots", slotId), {
    status: "pactado",
    sede: "visitante",
  });
  registrarHistorial(slotId, "Aceptado — se juega en el campo del rival");
}

// El club que reservó (y va a hacer de local porque se decidió jugar en su campo)
// cierra el partido con el día, hora y campo exactos. También pasa por la
// transacción atómica, por la misma razón que aceptarEnCasa.
export async function cerrarComoVisitante(slotId, { diaExacto, horaExacta, campoExacto, grupo, teamId }, allSlots) {
  return cerrarPartidoAtomico(slotId, { diaExacto, horaExacta, campoExacto, grupo }, allSlots, teamId);
}

// El dueño del hueco, cuando decidió jugar EN SU campo, fija el día/hora/campo
// exactos cuando le venga bien (no hace falta que sea al aceptar la solicitud).
export async function cerrarComoLocal(slotId, { diaExacto, horaExacta, campoExacto, grupo, teamId }, allSlots) {
  return cerrarPartidoAtomico(slotId, { diaExacto, horaExacta, campoExacto, grupo }, allSlots, teamId);
}

// Comprueba si programar un partido en un campo/día/hora concretos chocaría con otro
// partido ya confirmado en ese mismo campo (dejando el descanso obligatorio entre ambos).
export function hayConflictoDeHorario(allSlots, { campoExacto, diaExacto, horaExacta, grupo }, slotIdExcluir) {
  const campoNormalizado = campoExacto.trim().toLowerCase();
  const conflicto = allSlots.find((s) => {
    if (s.id === slotIdExcluir) return false;
    if (s.status !== "confirmado") return false;
    if (!s.campoExacto || !s.diaExacto || !s.horaExacta) return false;
    if (s.campoExacto.trim().toLowerCase() !== campoNormalizado) return false;
    if (s.diaExacto !== diaExacto) return false;
    return haySolape(horaExacta, grupo, s.horaExacta, s.grupo);
  });
  return conflicto || null;
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
  const porCampo = hayConflictoDeHorario(allSlots, datosCierre, slotIdExcluir);
  if (porCampo) ids.add(porCampo.id);
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

    for (const candidatoId of candidatoIds) {
      const candidatoSnap = await transaction.get(doc(db, "slots", candidatoId));
      if (!candidatoSnap.exists()) continue;
      const c = candidatoSnap.data();
      if (c.status !== "confirmado") continue; // ya no está confirmado de verdad, no choca

      const mismoCampo =
        c.campoExacto && c.diaExacto && c.horaExacta &&
        c.campoExacto.trim().toLowerCase() === datosNuevos.campoExacto.trim().toLowerCase() &&
        c.diaExacto === datosNuevos.diaExacto &&
        haySolape(datosNuevos.horaExacta, datosNuevos.grupo, c.horaExacta, c.grupo);

      const mismoEquipoMismoDia = c.teamId === teamId && c.diaExacto === datosNuevos.diaExacto;

      if (mismoCampo) {
        throw new Error(`Justo se ha confirmado otro partido en ese campo a las ${c.horaExacta}. Elige otra hora.`);
      }
      if (mismoEquipoMismoDia) {
        throw new Error("Justo se ha confirmado otro partido de este mismo equipo ese día. Elige otra jornada u otro equipo.");
      }
    }

    transaction.update(slotRef, {
      status: "confirmado",
      diaExacto: datosNuevos.diaExacto,
      horaExacta: datosNuevos.horaExacta,
      campoExacto: datosNuevos.campoExacto,
      ...(datosNuevos.sede ? { sede: datosNuevos.sede } : {}),
    });

    const historialRef = doc(collection(db, "historial"));
    transaction.set(historialRef, {
      slotId,
      accion: `Partido cerrado: ${datosNuevos.diaExacto} ${datosNuevos.horaExacta} en ${datosNuevos.campoExacto}`,
      quienUid: auth.currentUser?.uid || null,
      quienClubName: auth.currentUser?.displayName || "",
      timestamp: serverTimestamp(),
    });
  });
}

