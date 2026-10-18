import { faHandPointer } from "@fortawesome/free-solid-svg-icons";
import type React from "react";
import { interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { C, mezcla, pop, prog } from "../tema";
import { Icono } from "./Icono";
import { Pata } from "./Ilus";

const CORAZON_D =
  "M12 21.6C11.6 21.6 11.2 21.4 10.9 21.2C4.2 15.7 1.5 12.6 1.5 8.6C1.5 5.4 4 3 7.1 3C9.1 3 10.9 4 12 5.6C13.1 4 14.9 3 16.9 3C20 3 22.5 5.4 22.5 8.6C22.5 12.6 19.8 15.7 13.1 21.2C12.8 21.4 12.4 21.6 12 21.6Z";

export const Corazon: React.FC<{ size: number; color: string; style?: React.CSSProperties }> = ({
  size,
  color,
  style,
}) => (
  <svg viewBox="0 0 24 24" style={{ width: size, height: size, display: "block", ...style }}>
    <path d={CORAZON_D} fill={color} />
  </svg>
);

const COLORES_CORAZON = [C.accent, "#F59A6B", "#FC8CB4", C.accentDark, "#F6C177"];

/** Corazones que suben flotando desde una zona (coordenadas del lienzo). */
export const CorazonesFlotando: React.FC<{
  desde: number; // segundo en que empiezan
  cantidad: number;
  x: [number, number];
  yBase: number;
  semilla: string;
  tamano?: [number, number];
}> = ({ desde, cantidad, x, yBase, semilla, tamano = [44, 92] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <>
      {new Array(cantidad).fill(0).map((_, i) => {
        const r = (k: string) => random(`${semilla}-${i}-${k}`);
        const inicio = desde + i * 0.32 + r("d") * 0.25;
        const vida = 2.6 + r("v") * 1.2;
        const t = (frame / fps - inicio) / vida;
        if (t < 0 || t > 1) return null;
        const size = mezcla(tamano[0], tamano[1], r("s"));
        const px = mezcla(x[0], x[1], r("x")) + Math.sin(t * 6 + r("f") * 6) * 26;
        const py = yBase - t * (520 + r("h") * 260);
        return (
          <Corazon
            key={i}
            size={size}
            color={COLORES_CORAZON[i % COLORES_CORAZON.length]}
            style={{
              position: "absolute",
              left: px - size / 2,
              top: py - size / 2,
              opacity: interpolate(t, [0, 0.12, 0.75, 1], [0, 0.95, 0.85, 0]),
              scale: interpolate(t, [0, 0.15], [0.3, 1], { extrapolateRight: "clamp" }),
              rotate: `${(r("r") - 0.5) * 40}deg`,
            }}
          />
        );
      })}
    </>
  );
};

/** Huellitas tenues que flotan de fondo durante todo el video. */
export const FondoHuellitas: React.FC<{ semilla: string; opacidad?: number }> = ({ semilla, opacidad = 0.13 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <>
      {new Array(16).fill(0).map((_, i) => {
        const r = (k: string) => random(`${semilla}-${i}-${k}`);
        const size = 50 + r("s") * 70;
        const vel = 0.35 + r("v") * 0.5;
        const y = (((r("y") * (height + 300) - frame * vel) % (height + 300)) + height + 300) % (height + 300) - 150;
        return (
          <Pata
            key={i}
            size={size}
            color={C.accent}
            style={{
              position: "absolute",
              left: r("x") * width - size / 2,
              top: y,
              opacity: opacidad,
              rotate: `${(r("r") - 0.5) * 70 + Math.sin(frame / 40 + i) * 6}deg`,
            }}
          />
        );
      })}
    </>
  );
};

/** Explosion de huellitas y corazones desde un punto (para celebrar). */
export const LluviaHuellitas: React.FC<{ en: number; x: number; y: number; semilla: string; escala?: number }> = ({
  en,
  x,
  y,
  semilla,
  escala = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = (frame / fps - en) / 1.8;
  if (t < 0 || t > 1) return null;
  return (
    <>
      {new Array(22).fill(0).map((_, i) => {
        const r = (k: string) => random(`${semilla}-${i}-${k}`);
        const ang = r("a") * Math.PI * 2;
        const dist = (180 + r("d") * 320) * escala;
        const avance = 1 - Math.pow(1 - Math.min(1, t * 1.6), 3);
        const size = (34 + r("s") * 34) * escala;
        const px = x + Math.cos(ang) * dist * avance;
        const py = y + Math.sin(ang) * dist * avance + t * t * 260 * escala;
        const estilo: React.CSSProperties = {
          position: "absolute",
          left: px - size / 2,
          top: py - size / 2,
          opacity: interpolate(t, [0, 0.08, 0.7, 1], [0, 1, 1, 0]),
          rotate: `${(r("r") - 0.5) * 120 + t * 90}deg`,
        };
        const color = [C.accent, C.gold, "#FC8CB4", C.accentDark, C.wsp][i % 5];
        return i % 3 === 0 ? (
          <Corazon key={i} size={size} color={color} style={estilo} />
        ) : (
          <Pata key={i} size={size} color={color} style={estilo} />
        );
      })}
    </>
  );
};

export type Toque = { t: number; x: number; y: number };

/**
 * Dedo que se mueve entre toques (coordenadas de la pantalla del celular) y "presiona" en cada uno.
 * Llega a cada punto un poco antes de su t, presiona en t y deja una onda.
 */
export const Dedo: React.FC<{ toques: Toque[]; aparece: number; desaparece: number }> = ({
  toques,
  aparece,
  desaparece,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = frame / fps;
  const opacidad = prog(frame, fps, aparece, aparece + 0.3) * (1 - prog(frame, fps, desaparece, desaparece + 0.3));
  if (opacidad <= 0) return null;

  // Posicion: tras cada toque se retira un poco (para no tapar ni "tocar" lo que aparece debajo)
  // y viaja al siguiente toque en los 0.55 s previos.
  const reposo = (q: Toque) => {
    const r = prog(frame, fps, q.t + 0.25, q.t + 0.6);
    // Los botones de abajo de la pantalla: se retira hacia arriba para no salirse del celular.
    return { x: q.x + r * 34, y: q.y + r * (q.y > 600 ? -80 : 70) };
  };
  let x = toques[0].x + 60;
  let y = toques[0].y + 140;
  for (let i = 0; i < toques.length; i++) {
    const prev = i === 0 ? { x: toques[0].x + 60, y: toques[0].y + 140 } : reposo(toques[i - 1]);
    const k = prog(frame, fps, toques[i].t - 0.6, toques[i].t - 0.06);
    if (s >= toques[i].t - 0.6) {
      x = mezcla(prev.x, toques[i].x, k);
      y = mezcla(prev.y, toques[i].y, k);
    }
    if (s >= toques[i].t && (!toques[i + 1] || s < toques[i + 1].t - 0.6)) ({ x, y } = reposo(toques[i]));
  }
  const actual = [...toques].reverse().find((q) => s >= q.t - 0.08);
  const presion = actual ? interpolate(s - actual.t, [-0.08, 0, 0.16], [1, 0.84, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  const onda = actual ? prog(frame, fps, actual.t, actual.t + 0.5) : 1;

  return (
    <div style={{ position: "absolute", left: 0, top: 0, opacity: opacidad, pointerEvents: "none" }}>
      {actual && onda < 1 ? (
        <div
          style={{
            position: "absolute",
            left: actual.x - 30,
            top: actual.y - 30,
            width: 60,
            height: 60,
            borderRadius: "50%",
            border: `4px solid ${C.accent}`,
            opacity: 1 - onda,
            scale: 0.3 + onda * 1.1,
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          left: x - 15,
          top: y - 4,
          scale: presion,
          transformOrigin: "15px 4px",
          filter: "drop-shadow(0 6px 10px rgba(42,31,26,.35))",
        }}
      >
        <div style={{ position: "relative" }}>
          <Icono icon={faHandPointer} size={58} color={C.ink} />
          <Icono icon={faHandPointer} size={50} color="#FFFFFF" style={{ position: "absolute", left: 3.4, top: 4 }} />
        </div>
      </div>
      {/* pop que confirma el toque */}
      {actual ? (
        <div
          style={{
            position: "absolute",
            left: actual.x - 9,
            top: actual.y - 9,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: C.accent,
            opacity: interpolate(s - actual.t, [0, 0.1, 0.3], [0, 0.7, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            scale: pop(frame, fps, actual.t, 0.25),
          }}
        />
      ) : null}
    </div>
  );
};
