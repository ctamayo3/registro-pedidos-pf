import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { useVideoConfig } from "remotion";
import { Cierre } from "./escenas/Cierre";
import { Gancho } from "./escenas/Gancho";
import { Tutorial } from "./escenas/Tutorial";
import { DURACION_TUTORIAL } from "./guion";
import { C } from "./tema";

export const DURACION_GANCHO = 5;
export const DURACION_CIERRE = 6;
export const TRANSICION = 0.5;
export const DURACION_TOTAL = DURACION_GANCHO + DURACION_TUTORIAL + DURACION_CIERRE - 2 * TRANSICION;

const FONDO = {
  background: `radial-gradient(130% 55% at 50% -12%, #FFE7D3 0%, rgba(255,231,211,0) 62%), ${C.bg}`,
};

export const ComoPedir = () => {
  const { fps } = useVideoConfig();
  return (
    <TransitionSeries style={{ backgroundColor: C.bg }}>
      <TransitionSeries.Sequence name="Gancho" durationInFrames={DURACION_GANCHO * fps}>
        <Gancho name="Gancho" style={FONDO} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: TRANSICION * fps })}
      />
      <TransitionSeries.Sequence name="Tutorial" durationInFrames={DURACION_TUTORIAL * fps}>
        <Tutorial name="Tutorial" style={FONDO} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: TRANSICION * fps })}
      />
      <TransitionSeries.Sequence name="Cierre" durationInFrames={DURACION_CIERRE * fps}>
        <Cierre name="Cierre" style={FONDO} />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
