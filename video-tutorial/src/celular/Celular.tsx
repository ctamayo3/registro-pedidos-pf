import type React from "react";
import { T } from "../guion";
import { Dedo, LluviaHuellitas, type Toque } from "../piezas/Decoracion";
import { C, POPPINS, mezcla, prog } from "../tema";
import {
  BarraEstado,
  Enviando,
  H,
  PantArmar,
  PantDatos,
  PantExito,
  PantPedido,
  PantTipo,
  Topbar,
  W,
  puntoArmar,
} from "./Pantallas";

const p = (s: number, a: number, b: number) => prog(s, 1, a, b);
const CAMBIO = 0.45;

const PANTALLAS: { desde: number; paso: number; Comp: React.FC<{ s: number }>; fundido?: boolean }[] = [
  { desde: -10, paso: 0, Comp: PantDatos },
  { desde: T.pantTipo, paso: 1, Comp: PantTipo },
  { desde: T.pantArmar, paso: 1, Comp: PantArmar },
  { desde: T.pantPedido, paso: 1, Comp: PantPedido },
  { desde: T.pantExito, paso: 2, Comp: PantExito, fundido: true },
];

// Donde toca el dedo en cada momento (coordenadas de la pantalla de 390 x 760).
const TOQUES: Toque[] = [
  { t: T.tapWsp, x: 74, y: 438 },
  { t: T.nombre[0] - 0.15, x: 210, y: 557 },
  { t: T.tel[0] - 0.15, x: 210, y: 648 },
  { t: T.tapContinuar, x: 195, y: 720 },
  { t: T.tapPijama, x: 200, y: 313 },
  puntoArmar("short", 111, 43, T.tapVaron),
  puntoArmar("talla", 222, 24, T.tapTalla),
  puntoArmar("corte", 111, 78, T.tapCorte),
  puntoArmar("color", 176, 19, T.tapFamilia),
  puntoArmar("color", 261, 168, T.tapTono),
  puntoArmar("patron", 84, 237, T.tapPatron),
  puntoArmar("fotos", 195, 194, T.tapFoto),
  puntoArmar("fotos", 80, 348, T.tapListoFotos),
  { t: T.tapAgregar, x: 274, y: 720 },
  { t: T.tapEnviar, x: 272, y: 720 },
  { t: T.tapWspFinal, x: 195, y: 654 },
];

/** El celular con el formulario. s = segundos de la escena; escala = px de video por px de pantalla. */
export const Celular: React.FC<{ s: number; escala: number; style?: React.CSSProperties }> = ({ s, escala, style }) => {
  const BISEL = 12;
  const actual = PANTALLAS.reduce((a, pt, i) => (s >= pt.desde ? i : a), 0);
  const paso = PANTALLAS[actual].paso;
  const atras = actual === 0 ? 0 : actual === 4 ? 1 - p(s, T.pantExito, T.pantExito + 0.3) : p(s, T.pantTipo, T.pantTipo + 0.3);

  return (
    <div
      style={{
        position: "absolute",
        width: (W + BISEL * 2) * escala,
        height: (H + BISEL * 2) * escala,
        ...style,
      }}
    >
      <div
        style={{
          width: W + BISEL * 2,
          height: H + BISEL * 2,
          scale: escala,
          transformOrigin: "0 0",
          position: "relative",
          fontFamily: POPPINS,
          color: C.ink,
          lineHeight: 1.45,
        }}
      >
        {/* marco */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 60,
            background: "#2A1F1A",
            boxShadow: "0 30px 70px rgba(74,52,32,.28), 0 8px 20px rgba(74,52,32,.18), inset 0 0 0 2px #4A3A30",
          }}
        />
        {/* pantalla */}
        <div
          style={{
            position: "absolute",
            left: BISEL,
            top: BISEL,
            width: W,
            height: H,
            borderRadius: 48,
            overflow: "hidden",
            background: `radial-gradient(130% 55% at 50% -12%, #FFE7D3 0%, rgba(255,231,211,0) 62%), ${C.bg}`,
          }}
        >
          {PANTALLAS.map((pt, i) => {
            const siguiente = PANTALLAS[i + 1];
            if (i > actual || (siguiente && s > siguiente.desde + CAMBIO)) return null;
            const entraK = i === 0 ? 1 : p(s, pt.desde, pt.desde + CAMBIO);
            const saleK = siguiente ? p(s, siguiente.desde, siguiente.desde + CAMBIO) : 0;
            const estilo: React.CSSProperties = pt.fundido
              ? { opacity: entraK }
              : siguiente?.fundido
                ? { opacity: 1 - saleK }
                : { translate: `${mezcla(W, 0, entraK) - saleK * W * 0.3}px 0`, opacity: 1 - saleK * 0.6 };
            return (
              <div key={i} style={{ position: "absolute", inset: 0, ...estilo }}>
                <pt.Comp s={s} />
              </div>
            );
          })}
          <Topbar paso={paso} atras={atras} />
          <BarraEstado />
          <Enviando s={s} />
          {/* isla */}
          <div style={{ position: "absolute", top: 11, left: W / 2 - 58, width: 116, height: 32, borderRadius: 20, background: "#000", zIndex: 7 }} />
          <LluviaHuellitas en={T.pantExito + 0.2} x={W / 2} y={200} semilla="exito" escala={0.42} />
        </div>
        <div style={{ position: "absolute", left: BISEL, top: BISEL }}>
          <Dedo toques={TOQUES} aparece={T.paso1 + 0.2} desaparece={T.fin} />
        </div>
      </div>
    </div>
  );
};
