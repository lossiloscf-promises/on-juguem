const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

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
