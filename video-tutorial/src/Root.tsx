import { Composition, Folder } from "remotion";
import { ComoPedir, DURACION_CIERRE, DURACION_GANCHO, DURACION_TOTAL } from "./ComoPedir";
import { Cierre } from "./escenas/Cierre";
import { Gancho } from "./escenas/Gancho";
import { Tutorial } from "./escenas/Tutorial";
import { DURACION_TUTORIAL } from "./guion";
import { C } from "./tema";

const FPS = 30;
const fondo = {
  style: { background: `radial-gradient(130% 55% at 50% -12%, #FFE7D3 0%, rgba(255,231,211,0) 62%), ${C.bg}` },
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ComoPedir"
        component={ComoPedir}
        durationInFrames={Math.round(DURACION_TOTAL * FPS)}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Folder name="Escenas">
        <Composition id="Gancho" component={Gancho} durationInFrames={DURACION_GANCHO * FPS} fps={FPS} width={1080} height={1920} defaultProps={fondo} />
        <Composition id="Tutorial" component={Tutorial} durationInFrames={DURACION_TUTORIAL * FPS} fps={FPS} width={1080} height={1920} defaultProps={fondo} />
        <Composition id="Cierre" component={Cierre} durationInFrames={DURACION_CIERRE * FPS} fps={FPS} width={1080} height={1920} defaultProps={fondo} />
      </Folder>
    </>
  );
};
