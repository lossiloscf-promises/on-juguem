import React from "react";
import { AbsoluteFill, Audio, Composition, interpolate, staticFile } from "remotion";
import "./fonts";
import { FPS, SCENES, TOTAL_DURATION } from "./timing";
import { theme } from "./theme";
import { Scene1Hook } from "./scenes/Scene1Hook";
import { Scene2Logo } from "./scenes/Scene2Logo";
import { Scene3Calendar } from "./scenes/Scene3Calendar";
import { Scene4Search } from "./scenes/Scene4Search";
import { Scene5Notification } from "./scenes/Scene5Notification";
import { Scene6Outro } from "./scenes/Scene6Outro";
import { SequenceScene } from "./components/SequenceScene";

const clampBoth = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

// Volumen dinámico de la música: entra con fundido, se mantiene a volumen
// base durante el gancho y el logo, se atenúa (duck) durante el bloque de
// las tres funciones -donde hay subtítulos largos que leer y compiten con la
// música-, y vuelve a subir para el cierre. Fundido de salida al final.
const BASE_VOLUME = 0.34;
const DUCK_VOLUME = 0.17;
const RAMP = 24;
const DUCK_START = SCENES.calendar.from;
const DUCK_END = SCENES.notification.from + SCENES.notification.duration;
const FADE_IN = 15;
const FADE_OUT = 45;

const musicVolume = (frame: number) => {
  let v = BASE_VOLUME;
  if (frame < DUCK_START - RAMP) {
    v = BASE_VOLUME;
  } else if (frame < DUCK_START) {
    v = interpolate(frame, [DUCK_START - RAMP, DUCK_START], [BASE_VOLUME, DUCK_VOLUME], clampBoth);
  } else if (frame <= DUCK_END) {
    v = DUCK_VOLUME;
  } else if (frame <= DUCK_END + RAMP) {
    v = interpolate(frame, [DUCK_END, DUCK_END + RAMP], [DUCK_VOLUME, BASE_VOLUME], clampBoth);
  } else {
    v = BASE_VOLUME;
  }
  v *= interpolate(frame, [0, FADE_IN], [0, 1], clampBoth);
  v *= interpolate(frame, [TOTAL_DURATION - FADE_OUT, TOTAL_DURATION - 1], [1, 0], clampBoth);
  return v;
};

export const OnJuguemPromo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: theme.colors.bg, fontFamily: theme.fonts.body }}>
      {/* La pista dura 111.75s; solo usamos su tramo inicial (arranque de
          energía de 0-8s + primeros ~60s de energía sostenida), que es
          exactamente lo que necesita este vídeo de 68s. Sin recorte de
          entrada: el minuto 0 de la pista cae en el minuto 0 del vídeo, así
          que su propio pico de energía (~seg. 8) coincide solo con el reveal
          del logo en la escena 2, que también empieza en el segundo 8. */}
      <Audio src={staticFile("audio/sport.mp3")} volume={musicVolume} />

      <SequenceScene {...SCENES.hook}>
        <Scene1Hook />
      </SequenceScene>
      <SequenceScene {...SCENES.logo}>
        <Scene2Logo />
      </SequenceScene>
      <SequenceScene {...SCENES.calendar}>
        <Scene3Calendar />
      </SequenceScene>
      <SequenceScene {...SCENES.search}>
        <Scene4Search />
      </SequenceScene>
      <SequenceScene {...SCENES.notification}>
        <Scene5Notification />
      </SequenceScene>
      <SequenceScene {...SCENES.outro}>
        <Scene6Outro />
      </SequenceScene>
    </AbsoluteFill>
  );
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="OnJuguemPromo"
      component={OnJuguemPromo}
      durationInFrames={TOTAL_DURATION}
      fps={FPS}
      width={1080}
      height={1920}
    />
  );
};
