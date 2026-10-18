import { Img, Interactive, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { CorazonesFlotando, FondoHuellitas } from "../piezas/Decoracion";
import { Ilus } from "../piezas/Ilus";
import { C, FRAUNCES, mezcla, pop, prog } from "../tema";

const LINEAS: { txt: string; acento?: boolean }[][] = [
  [{ txt: "¿Y" }, { txt: "si" }, { txt: "tu" }, { txt: "peludito" }],
  [{ txt: "tuviera" }, { txt: "su", acento: true }, { txt: "propia", acento: true }],
  [{ txt: "pijama?", acento: true }],
];

const GanchoInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = frame / fps;
  let n = 0;
  return (
    <>
      <FondoHuellitas semilla="gancho" />
      <div style={{ position: "absolute", top: 250, left: 80, right: 80, textAlign: "center", fontFamily: FRAUNCES, fontWeight: 700, fontSize: 104, lineHeight: 1.08, color: C.ink, letterSpacing: "-0.01em" }}>
        {LINEAS.map((linea, i) => (
          <div key={i}>
            {linea.map((w) => {
              const k = pop(frame, fps, 0.15 + n++ * 0.11, 0.5);
              return (
                <span key={w.txt} style={{ display: "inline-block", margin: "0 14px", color: w.acento ? C.accent : C.ink, opacity: Math.min(1, k * 1.5), scale: mezcla(0.6, 1, k), translate: `0 ${(1 - k) * 40}px` }}>
                  {w.txt}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          left: 540 - 330,
          top: 760,
          width: 660,
          height: 660,
          borderRadius: "50%",
          overflow: "hidden",
          border: "18px solid #fff",
          boxShadow: "0 30px 80px rgba(196,82,42,.28), 0 8px 24px rgba(74,52,32,.16)",
          scale: pop(frame, fps, 0.35, 0.7),
          rotate: `${mezcla(-8, 0, prog(frame, fps, 0.35, 1.2))}deg`,
        }}
      >
        <Img src={staticFile("perro.webp")} style={{ width: "100%", height: "100%", objectFit: "cover", scale: mezcla(1.0, 1.08, prog(frame, fps, 0.3, 5)) }} />
      </div>
      <div style={{ position: "absolute", left: 700, top: 1220, scale: pop(frame, fps, 2.1, 0.6), rotate: `${Math.sin(s * 4) * 6}deg` }}>
        <div style={{ background: "#fff", borderRadius: "50%", padding: 14, boxShadow: C.shadow2 }}>
          <Ilus cual="short" size={210} />
        </div>
      </div>
      <CorazonesFlotando desde={0.9} cantidad={10} x={[160, 920]} yBase={1450} semilla="gancho-c" />
    </>
  );
};

export const Gancho = Interactive.create({
  Component: GanchoInner,
  layout: "absolute-fill",
});
