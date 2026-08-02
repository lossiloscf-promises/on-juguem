const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

// La clave de la API de Claude se guarda como "secret" de Firebase, nunca en
// el código ni en el navegador. Se configura una vez con:
//   firebase functions:secrets:set ANTHROPIC_API_KEY
const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const MODELO = "claude-sonnet-5";

// Llama a la API de Claude desde el servidor (nunca desde el navegador, para
// que la clave nunca quede expuesta). Devuelve el texto de la respuesta.
async function llamarClaude(apiKey, systemPrompt, mensajeUsuario, maxTokens = 500) {
  const respuesta = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: mensajeUsuario }],
    }),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    logger.error("Error llamando a Claude", { status: respuesta.status, detalle });
    throw new HttpsError(
      "internal",
      `La IA no ha podido responder (código ${respuesta.status}). Revisa los logs de Firebase Functions para ver el detalle exacto.`
    );
  }

  const datos = await respuesta.json();
  const bloqueTexto = datos.content?.find((b) => b.type === "text");
  return bloqueTexto?.text || "";
}

function requerirSesion(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tienes que haber iniciado sesión para usar esto.");
  }
}

// Intenta extraer JSON de una respuesta de la IA, aunque venga con texto
// alrededor o con ```json``` — para que un formato inesperado no rompa la app.
function extraerJSON(texto) {
  const limpio = texto.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(limpio);
  } catch {
    const match = limpio.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

// --- 1) Alta rápida por texto libre (punto 52) ---------------------------
// Convierte una frase suelta en los campos estructurados de disponibilidad.
exports.interpretarDisponibilidad = onCall({ secrets: [ANTHROPIC_API_KEY], region: "europe-west1" }, async (request) => {
  requerirSesion(request);
  const { texto, gruposValidos, categoriasValidas, nivelesValidos } = request.data;
  if (!texto || texto.length > 300) {
    throw new HttpsError("invalid-argument", "Escribe una frase de menos de 300 caracteres.");
  }

  const systemPrompt = `Eres un asistente que convierte una frase en español sobre disponibilidad de un equipo
de fútbol base en un objeto JSON con estos campos, y NADA MÁS (sin explicación, sin markdown):
{
  "grupo": uno de estos valores exactos si lo detectas, si no null: ${JSON.stringify(gruposValidos || [])},
  "nivel": uno de estos valores exactos si lo detectas, si no null: ${JSON.stringify(nivelesValidos || [])},
  "campo": el nombre del campo/instalación si lo menciona, si no null,
  "preferenciaSede": "local" si dice que prefiere jugar en casa, "visitante" si prefiere fuera, si no null,
  "fechaMencionada": el texto tal cual de la fecha/jornada que mencione (ej. "4-5-6 septiembre"), si no null
}
Si no puedes deducir un campo con confianza, pon null en ese campo — mejor null que inventarte algo.`;

  const respuestaTexto = await llamarClaude(ANTHROPIC_API_KEY.value(), systemPrompt, texto, 400);
  const json = extraerJSON(respuestaTexto);
  if (!json) {
    throw new HttpsError("internal", "No se ha podido interpretar la frase. Prueba a rellenarlo a mano.");
  }
  return json;
});

// --- 2) Explicación en lenguaje natural del modo inteligente (punto 53) --
exports.explicarRecomendacion = onCall({ secrets: [ANTHROPIC_API_KEY], region: "europe-west1" }, async (request) => {
  requerirSesion(request);
  const { clubName, coincidencias, distanciaKm, pctCompletado } = request.data;

  const systemPrompt = `Eres un asistente de una app de amistosos de fútbol base. Te doy datos de compatibilidad
entre el club del usuario y otro club candidato. Escribe UNA frase corta (máximo 25 palabras), en español,
natural y directa, explicando por qué ese club es (o no) buena opción. No uses markdown ni comillas.`;

  const mensajeUsuario = `Club candidato: ${clubName}.
Coincidencias de equipos compatibles: ${coincidencias}.
Distancia aproximada: ${distanciaKm != null ? distanciaKm + " km" : "desconocida"}.
% de su temporada ya cerrada (señal de que responde y confirma): ${pctCompletado}%.`;

  const texto = await llamarClaude(ANTHROPIC_API_KEY.value(), systemPrompt, mensajeUsuario, 100);
  return { explicacion: texto.trim() };
});

// --- 3) Revisor de errores antes de publicar (punto 54) -------------------
exports.revisarErrores = onCall({ secrets: [ANTHROPIC_API_KEY], region: "europe-west1" }, async (request) => {
  requerirSesion(request);
  const { jornadas, camposUsados } = request.data;
  if (!jornadas || jornadas.length === 0) {
    return { avisos: [] };
  }

  const systemPrompt = `Eres un revisor cuidadoso de un calendario de amistosos de fútbol base. Te doy una
lista de jornadas (nombre + fecha de referencia) y una lista de nombres de campo usados. Responde SOLO con
un JSON de este formato, sin texto alrededor:
{ "avisos": ["frase corta describiendo un problema concreto", ...] }
Busca cosas como: fechas que no cuadran con el nombre de la jornada, nombres de campo casi iguales pero
escritos de forma distinta (posible error tipográfico que rompería la detección de conflictos de horario),
o jornadas duplicadas. Si no hay nada raro, devuelve { "avisos": [] }. Máximo 5 avisos.`;

  const mensajeUsuario = `Jornadas: ${JSON.stringify(jornadas)}\nCampos usados: ${JSON.stringify(camposUsados || [])}`;

  const respuestaTexto = await llamarClaude(ANTHROPIC_API_KEY.value(), systemPrompt, mensajeUsuario, 400);
  const json = extraerJSON(respuestaTexto);
  return json && Array.isArray(json.avisos) ? json : { avisos: [] };
});

// --- 4) Redactor de mensajes de WhatsApp (punto 55) -----------------------
exports.redactarMensajeWhatsApp = onCall({ secrets: [ANTHROPIC_API_KEY], region: "europe-west1" }, async (request) => {
  requerirSesion(request);
  const { tipo, datosPartido } = request.data;

  const tiposValidos = ["primer_contacto", "recordatorio", "cambio_ultima_hora", "confirmacion"];
  if (!tiposValidos.includes(tipo)) {
    throw new HttpsError("invalid-argument", "Tipo de mensaje no reconocido.");
  }

  const systemPrompt = `Eres un asistente que redacta mensajes cortos de WhatsApp entre coordinadores de
fútbol base en España. Tono cercano, breve, sin emojis excesivos (máximo 1). Nunca inventes datos que no
te den — usa solo los datos proporcionados. Responde SOLO con el texto del mensaje, sin comillas ni explicación.
El tipo de mensaje es "${tipo}":
- primer_contacto: presentarse y proponer el amistoso
- recordatorio: recordar el partido que se acerca
- cambio_ultima_hora: avisar de un cambio de hora/campo, pidiendo disculpas si aplica
- confirmacion: confirmar que el partido queda cerrado con los datos exactos`;

  const texto = await llamarClaude(ANTHROPIC_API_KEY.value(), systemPrompt, JSON.stringify(datosPartido || {}), 200);
  return { mensaje: texto.trim() };
});

// Cuadrante público de solo lectura — pensado para compartir sin necesitar
// cuenta. Lee con permisos de servidor (no pasa por las reglas del navegador)
// y devuelve SOLO lo necesario para pintar la tabla: nunca teléfono ni email
// de nadie, aunque el visitante inspeccione la respuesta a mano.
exports.cuadrantePublico = onRequest({ cors: true, region: "europe-west1" }, async (req, res) => {
  const uid = req.query.club;
  if (!uid || typeof uid !== "string") {
    res.status(400).json({ error: "Falta el parámetro club en la URL." });
    return;
  }
  try {
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) {
      res.status(404).json({ error: "No se ha encontrado ese club." });
      return;
    }

    const [teamsSnap, jornadasSnap, slotsSnap] = await Promise.all([
      db.collection("teams").where("ownerUid", "==", uid).get(),
      db.collection("jornadas").where("ownerUid", "==", uid).get(),
      db.collection("slots").where("ownerUid", "==", uid).get(),
    ]);

    const teams = teamsSnap.docs.map((d) => {
      const t = d.data();
      return { id: d.id, grupo: t.grupo, anyo: t.anyo || "", categoria: t.categoria, nivel: t.nivel, identificador: t.identificador || "" };
    });

    const jornadas = jornadasSnap.docs
      .map((d) => ({ id: d.id, label: d.data().label, orderDate: d.data().orderDate || "", fase: d.data().fase }))
      .sort((a, b) => a.orderDate.localeCompare(b.orderDate));

    const slots = slotsSnap.docs.map((d) => {
      const s = d.data();
      return {
        teamId: s.teamId,
        jornadaId: s.jornadaId,
        status: s.status,
        sede: s.sede || null,
        diaExacto: s.diaExacto || "",
        horaExacta: s.horaExacta || "",
        campoExacto: s.campoExacto || "",
        rivalClubName: s.requestedByClubName || null,
        cancelacionPropuestaPor: !!s.cancelacionPropuestaPor,
      };
    });

    res.set("Cache-Control", "public, max-age=60");
    res.status(200).json({ clubName: userSnap.data().clubName, teams, jornadas, slots });
  } catch (err) {
    logger.error("Error en cuadrantePublico", err);
    res.status(500).json({ error: "Error interno al cargar el cuadrante." });
  }
});

// Comprueba si ya existe un club con ese nombre — se llama ANTES de crear la
// cuenta, cuando todavía no hay sesión iniciada, así que no puede pasar por
// las reglas normales de Firestore (que exigen sesión para leer "users",
// precisamente para no exponer teléfonos/emails a cualquiera). Aquí solo se
// devuelve un true/false, nunca datos de contacto de nadie.
exports.comprobarClubDuplicado = onCall({ region: "europe-west1" }, async (request) => {
  const nombre = (request.data?.clubName || "").trim().toLowerCase();
  if (!nombre) return { existe: false };
  const snap = await db.collection("users").where("clubNameLower", "==", nombre).limit(1).get();
  return { existe: !snap.empty };
});

// Envía un aviso push a todos los dispositivos guardados de un club — y
// limpia solo los tokens que ya no sirven (dispositivo desinstalado, etc.),
// sin tocar los demás.
// Misma clave que usa el cliente para guardar coordinadores y contactos.
function claveCategoria(genero, formato) {
  const f = formato === "Fútbol 8" ? "f8" : "f11";
  const g = genero === "Femenino" ? "f" : "m";
  return `${f}_${g}`;
}

// Envía un aviso solo a quien le corresponde: el coordinador general SIEMPRE
// lo recibe (supervisa todo el club), y además el coordinador específico de
// esa categoría si el partido tiene una (genero/formato). Si no se sabe la
// categoría del partido, se manda a todos los dispositivos guardados, sea
// cual sea su categoría, para no perder el aviso.
async function enviarAviso(uid, titulo, cuerpo, categoria) {
  if (!uid) {
    logger.info("enviarAviso: sin uid destinatario, no se envía nada");
    return;
  }
  try {
    const userSnap = await db.collection("users").doc(uid).get();
    const porCategoria = userSnap.data()?.fcmTokensPorCategoria || {};

    let claves;
    if (categoria?.genero && categoria?.formato) {
      claves = ["general", claveCategoria(categoria.genero, categoria.formato)];
    } else {
      claves = Object.keys(porCategoria);
    }
    const tokens = [...new Set(claves.flatMap((c) => porCategoria[c] || []))];

    logger.info(`enviarAviso: destinatario=${uid}, categoria=${categoria ? claveCategoria(categoria.genero, categoria.formato) : "(todas)"}, tokens=${tokens.length}, titulo="${titulo}"`);
    if (tokens.length === 0) {
      logger.info("enviarAviso: no hay ningún dispositivo guardado para avisar aquí");
      return;
    }
    const respuesta = await messaging.sendEachForMulticast({
      tokens,
      data: { title: titulo, body: cuerpo },
      webpush: { fcmOptions: { link: "/on-juguem/" } },
    });
    logger.info(`enviarAviso: enviados=${respuesta.successCount}, fallidos=${respuesta.failureCount}`);
    respuesta.responses.forEach((r) => {
      if (!r.success) logger.info(`enviarAviso: fallo en un token — ${r.error?.code}: ${r.error?.message}`);
    });
    const tokensInvalidos = [];
    respuesta.responses.forEach((r, i) => {
      const codigo = r.error?.code;
      if (!r.success && (codigo === "messaging/registration-token-not-registered" || codigo === "messaging/invalid-registration-token")) {
        tokensInvalidos.push(tokens[i]);
      }
    });
    if (tokensInvalidos.length > 0) {
      // Se quita de todas las categorías donde pudiera estar, por si acaso.
      const limpieza = {};
      Object.keys(porCategoria).forEach((clave) => {
        limpieza[`fcmTokensPorCategoria.${clave}`] = admin.firestore.FieldValue.arrayRemove(...tokensInvalidos);
      });
      await db.collection("users").doc(uid).update(limpieza);
    }
  } catch (err) {
    logger.error("Error enviando notificación push", err);
  }
}

// Se dispara con CUALQUIER cambio en un hueco/partido, y decide si hay que
// avisar a alguien según qué ha cambiado exactamente.
exports.avisosDeHuecos = onDocumentWritten({ document: "slots/{slotId}", region: "europe-west1" }, async (event) => {
  const antes = event.data.before.exists ? event.data.before.data() : null;
  const despues = event.data.after.exists ? event.data.after.data() : null;
  if (!despues) return; // el hueco se ha borrado, no aplica

  logger.info(`avisosDeHuecos: status ${antes?.status ?? "(nuevo)"} → ${despues.status}, sedePropuestaPor ${antes?.sedePropuestaPor ?? "-"} → ${despues.sedePropuestaPor ?? "-"}, cancelacionPropuestaPor ${antes?.cancelacionPropuestaPor ?? "-"} → ${despues.cancelacionPropuestaPor ?? "-"}`);

  const nombreDueño = despues.clubName || "Un club";
  const nombreSolicitante = despues.requestedByClubName || "Un club";
  const equipo = despues.grupo ? `${despues.grupo}${despues.anyo ? ` (${despues.anyo})` : ""}` : "vuestro amistoso";
  const categoria = { genero: despues.genero, formato: despues.formato };

  // 1) Nueva solicitud pendiente — avisa al dueño del hueco.
  if ((!antes || antes.status !== "pendiente") && despues.status === "pendiente") {
    await enviarAviso(despues.ownerUid, "Nueva solicitud de amistoso",
      `${nombreSolicitante} quiere reservar un hueco de ${equipo}.`, categoria);
  }

  // 2) El dueño acepta (pendiente → pactado) — avisa a quien reservó.
  if (antes?.status === "pendiente" && despues.status === "pactado") {
    await enviarAviso(despues.requestedByUid, "Solicitud aceptada",
      `${nombreDueño} ha aceptado vuestra solicitud de amistoso para ${equipo}.`, categoria);
  }

  // 3) Propuesta de sede nueva — avisa a la otra parte, diciendo si venía
  //    con día/hora/campo ya incluidos o solo la sede.
  if (despues.sedePropuestaPor && antes?.sedePropuestaPor !== despues.sedePropuestaPor) {
    const soyDueñoQuienPropone = despues.sedePropuestaPor === despues.ownerUid;
    const destinatario = soyDueñoQuienPropone ? despues.requestedByUid : despues.ownerUid;
    const quienPropone = soyDueñoQuienPropone ? nombreDueño : nombreSolicitante;
    const d = despues.sedePropuestaDetalles;
    const cuerpo = d
      ? `${quienPropone} te ha propuesto campo, día y hora para ${equipo}: ${d.diaExacto} ${d.horaExacta} en ${d.campoExacto}.`
      : `${quienPropone} te ha propuesto sede para ${equipo} — entra a ver dónde.`;
    await enviarAviso(destinatario, "Propuesta de dónde jugar", cuerpo, categoria);
  }

  // 4) Sede aceptada — avisa a quien la había propuesto.
  if (antes?.sedePropuestaPor && !despues.sedePropuestaPor && despues.sede) {
    const quienAcepta = antes.sedePropuestaPor === despues.ownerUid ? nombreSolicitante : nombreDueño;
    await enviarAviso(antes.sedePropuestaPor, "Sede aceptada",
      `${quienAcepta} ha aceptado tu propuesta de dónde jugar para ${equipo}.`, categoria);
  }

  // 5) Propuesta de cancelación — avisa a la otra parte.
  if (despues.cancelacionPropuestaPor && antes?.cancelacionPropuestaPor !== despues.cancelacionPropuestaPor) {
    const soyDueñoQuienPropone = despues.cancelacionPropuestaPor === despues.ownerUid;
    const destinatario = soyDueñoQuienPropone ? despues.requestedByUid : despues.ownerUid;
    const quienPropone = soyDueñoQuienPropone ? nombreDueño : nombreSolicitante;
    await enviarAviso(destinatario, "Propuesta de cancelación",
      `${quienPropone} ha propuesto cancelar el amistoso de ${equipo} — entra a revisarlo.`, categoria);
  }

  // 6) Propuesta de cambio de día/hora/campo — avisa a la otra parte.
  if (despues.cambioPropuestoPor && antes?.cambioPropuestoPor !== despues.cambioPropuestoPor) {
    const soyDueñoQuienPropone = despues.cambioPropuestoPor === despues.ownerUid;
    const destinatario = soyDueñoQuienPropone ? despues.requestedByUid : despues.ownerUid;
    const quienPropone = soyDueñoQuienPropone ? nombreDueño : nombreSolicitante;
    const d = despues.cambioPropuesto;
    await enviarAviso(destinatario, "Cambio de horario propuesto",
      `${quienPropone} te ha propuesto cambiar ${equipo} a ${d?.diaExacto || ""} ${d?.horaExacta || ""} en ${d?.campoExacto || ""}.`, categoria);
  }

  // 7) Partido cerrado del todo (día/hora/campo ya fijos) — avisa a las dos partes.
  if (antes?.status !== "confirmado" && despues.status === "confirmado") {
    await enviarAviso(despues.ownerUid, "Partido cerrado",
      `Vuestro amistoso de ${equipo} contra ${nombreSolicitante} ya tiene día, hora y campo: ${despues.diaExacto} ${despues.horaExacta} en ${despues.campoExacto}.`, categoria);
    await enviarAviso(despues.requestedByUid, "Partido cerrado",
      `Vuestro amistoso de ${equipo} contra ${nombreDueño} ya tiene día, hora y campo: ${despues.diaExacto} ${despues.horaExacta} en ${despues.campoExacto}.`, categoria);
  }

  // 8) Un hueco que tenía algo en marcha (solicitud, pactado o ya cerrado) ha
  //    vuelto a "libre" — por el motivo que sea: cancelación aceptada, un
  //    equipo borrado, o cualquiera de las dos partes usando "Limpiar
  //    pre/postemporada". Se avisa a las dos partes (no se puede saber aquí
  //    quién lo inició) — para quien no lo inició, esto rompe su compromiso
  //    sin que lo haya decidido, así que nunca debe enterarse solo si mira
  //    la app.
  //    EXCEPCIÓN: si la jornada de ese hueco ya pasó, no se avisa a nadie —
  //    a esas alturas es limpieza rutinaria de fin de temporada.
  const jornadaYaPaso = antes?.jornadaOrderDate && antes.jornadaOrderDate < new Date().toISOString().slice(0, 10);
  if (antes && ["pendiente", "pactado", "confirmado"].includes(antes.status) && despues.status === "libre" && antes.requestedByUid && !jornadaYaPaso) {
    const nombreDueñoAntes = antes.clubName || "Un club";
    const nombreSolicitanteAntes = antes.requestedByClubName || "Un club";
    const equipoAntes = antes.grupo ? `${antes.grupo}${antes.anyo ? ` (${antes.anyo})` : ""}` : "vuestro amistoso";
    await enviarAviso(
      antes.requestedByUid,
      "Un partido ha quedado libre otra vez",
      `Vuestro amistoso de ${equipoAntes} con ${nombreDueñoAntes} (${antes.jornadaLabel || ""}) ya no está en marcha — el hueco ha vuelto a estar disponible.`,
      { genero: antes.genero, formato: antes.formato }
    );
    await enviarAviso(
      antes.ownerUid,
      "Un partido ha quedado libre otra vez",
      `Vuestro amistoso de ${equipoAntes} con ${nombreSolicitanteAntes} (${antes.jornadaLabel || ""}) ya no está en marcha — el hueco ha vuelto a estar disponible.`,
      { genero: antes.genero, formato: antes.formato }
    );
  }
});

// Aviso general a TODOS los clubes de la plataforma — solo lo puede llamar
// un administrador de verdad (se comprueba contra su propio documento, no
// contra lo que diga el propio navegador). Pensado para avisos tipo
// mantenimiento, novedades importantes, etc.
exports.enviarAvisoGlobal = onCall({ region: "europe-west1" }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Necesitas sesión iniciada.");

  const llamanteSnap = await db.collection("users").doc(uid).get();
  if (!llamanteSnap.data()?.esAdmin) {
    throw new HttpsError("permission-denied", "Solo un administrador puede enviar avisos generales.");
  }

  const titulo = (request.data?.titulo || "").trim();
  const cuerpo = (request.data?.cuerpo || "").trim();
  if (!titulo || !cuerpo) {
    throw new HttpsError("invalid-argument", "Falta el título o el mensaje.");
  }

  const usersSnap = await db.collection("users").get();
  let tokens = [];
  usersSnap.docs.forEach((doc) => {
    const porCategoria = doc.data().fcmTokensPorCategoria || {};
    Object.values(porCategoria).forEach((arr) => { tokens = tokens.concat(arr || []); });
  });
  tokens = [...new Set(tokens)];

  if (tokens.length === 0) return { enviados: 0, total: 0 };

  // FCM solo admite 500 tokens por llamada — se manda en lotes si hace falta.
  let enviados = 0;
  for (let i = 0; i < tokens.length; i += 500) {
    const lote = tokens.slice(i, i + 500);
    const respuesta = await messaging.sendEachForMulticast({
      tokens: lote,
      data: { title: titulo, body: cuerpo },
      webpush: { fcmOptions: { link: "/on-juguem/" } },
    });
    enviados += respuesta.successCount;
  }
  logger.info(`enviarAvisoGlobal: enviados=${enviados} de ${tokens.length} dispositivos totales`);
  return { enviados, total: tokens.length };
});
