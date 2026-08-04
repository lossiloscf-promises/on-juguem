// Único sitio con los tiempos del vídeo, en segundos legibles, convertidos a
// frames aquí una sola vez. Las escenas importan SCENES, nunca escriben un
// número de frame "mágico" suelto.
export const FPS = 30;
const s = (seconds: number) => Math.round(seconds * FPS);

const SCENE_ORDER: Array<[string, number]> = [
  ["hook", 8], // 0-8s: gancho
  ["logo", 7], // 8-15s: logo + eslogan, sincronizado con el pico de energía de la música
  ["calendar", 14], // 15-29s: función 1, calendario claro
  ["search", 12], // 29-41s: función 2, búsqueda por cercanía
  ["notification", 12], // 41-53s: función 3, avisos al momento
  ["outro", 15], // 53-68s: cierre + CTA
];

type SceneName = "hook" | "logo" | "calendar" | "search" | "notification" | "outro";

const build = () => {
  let cursor = 0;
  const map = {} as Record<SceneName, { from: number; duration: number }>;
  for (const [name, seconds] of SCENE_ORDER) {
    const duration = s(seconds);
    map[name as SceneName] = { from: cursor, duration };
    cursor += duration;
  }
  return { map, total: cursor };
};

const { map, total } = build();
export const SCENES = map;
export const TOTAL_DURATION = total; // 2040 frames = 68s a 30fps
