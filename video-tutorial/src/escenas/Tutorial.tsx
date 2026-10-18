import { Interactive, useCurrentFrame, useVideoConfig } from "remotion";
import { Celular } from "../celular/Celular";
import { PASOS, T } from "../guion";
import { FondoHuellitas } from "../piezas/Decoracion";
import { C, FRAUNCES, POPPINS, mezcla, pop, prog } from "../tema";

const ESCALA = 1.5;
const ANCHO_CEL = (390 + 24) * ESCALA;

/** Un texto grande que entra desde abajo y sale hacia arriba. */
const Rotulo: React.FC<{ s: number; desde: number; hasta: number; children: React.ReactNode }> = ({
  s,
  desde,
  hasta,
  children,
}) => {
  const en = pop(s, 1, desde, 0.55);
  const sale = prog(s, 1, hasta - 0.1, hasta + 0.3);
  if (s < desde || s > hasta + 0.3) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 70,
        right: 70,
        top: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        opacity: Math.min(1, en * 1.4) * (1 - sale),
        translate: `0 ${(1 - en) * 60 - sale * 50}px`,
      }}
    >
      {children}
    </div>
  );
};

const TutorialInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = frame / fps;
  const entra = pop(frame, fps, T.entraCelular, 1.1);
  const flota = Math.sin(s * 1.3) * 8;

  return (
    <>
      <FondoHuellitas semilla="tutorial" opacidad={0.1} />
      <div style={{ position: "absolute", top: 240, left: 0, right: 0, height: 380, fontFamily: POPPINS }}>
        <Rotulo s={s} desde={0.6} hasta={T.paso1}>
          <div style={{ fontFamily: FRAUNCES, fontWeight: 700, fontSize: 100, lineHeight: 1.08, color: C.ink, marginTop: 40 }}>
            Pedirla es <span style={{ color: C.accent }}>así de fácil</span> 👇
          </div>
        </Rotulo>
        {PASOS.map((paso, i) => (
          <Rotulo key={paso.titulo} s={s} desde={paso.desde} hasta={PASOS[i + 1]?.desde ?? 999}>
            <div style={{ display: "flex", alignItems: "center", gap: 18, background: "#fff", borderRadius: 99, padding: "12px 28px 12px 14px", boxShadow: C.shadow1, fontWeight: 600, fontSize: 36, color: C.accentDark }}>
              <span style={{ width: 56, height: 56, borderRadius: "50%", background: C.gradient, color: "#fff", display: "grid", placeItems: "center", fontFamily: FRAUNCES, fontWeight: 700, fontSize: 34 }}>
                {i + 1}
              </span>
              Paso {i + 1} de {PASOS.length}
              <span style={{ display: "flex", gap: 8, marginLeft: 6 }}>
                {PASOS.map((_, j) => (
                  <i key={j} style={{ width: j === i ? 34 : 12, height: 12, borderRadius: 99, background: j <= i ? C.accent : C.line }} />
                ))}
              </span>
            </div>
            <div style={{ fontFamily: FRAUNCES, fontWeight: 700, fontSize: 92, lineHeight: 1.05, color: C.ink, marginTop: 26 }}>{paso.titulo}</div>
            <div style={{ fontWeight: 500, fontSize: 44, color: C.muted, marginTop: 14 }}>{paso.sub}</div>
          </Rotulo>
        ))}
      </div>
      <Celular
        s={s}
        escala={ESCALA}
        style={{
          left: (1080 - ANCHO_CEL) / 2,
          top: 650,
          translate: `0 ${mezcla(1300, 0, entra) + flota}px`,
          rotate: `${mezcla(8, 0, entra) + Math.sin(s * 0.9) * 0.6}deg`,
        }}
      />
    </>
  );
};

export const Tutorial = Interactive.create({
  Component: TutorialInner,
  layout: "absolute-fill",
});
