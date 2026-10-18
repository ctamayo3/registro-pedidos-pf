import { Img, Interactive, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { CorazonesFlotando, FondoHuellitas } from "../piezas/Decoracion";
import { Ilus } from "../piezas/Ilus";
import { C, FRAUNCES, POPPINS, mezcla, pop } from "../tema";

const CierreInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = frame / fps;
  const aparece = (a: number) => {
    const k = pop(frame, fps, a, 0.6);
    return { opacity: Math.min(1, k * 1.4), scale: mezcla(0.7, 1, k), translate: `0 ${(1 - k) * 40}px` };
  };
  return (
    <>
      <FondoHuellitas semilla="cierre" />
      <CorazonesFlotando desde={0.5} cantidad={7} x={[90, 240]} yBase={900} semilla="cierre-i" tamano={[40, 80]} />
      <CorazonesFlotando desde={0.7} cantidad={7} x={[840, 990]} yBase={900} semilla="cierre-d" tamano={[40, 80]} />
      <div style={{ position: "absolute", left: 540 - 250, top: 290, width: 500, height: 500, ...aparece(0.2) }}>
        <div style={{ width: 500, height: 500, borderRadius: "50%", overflow: "hidden", border: "16px solid #fff", boxShadow: "0 30px 80px rgba(196,82,42,.28), 0 8px 24px rgba(74,52,32,.16)" }}>
          <Img src={staticFile("perro.webp")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <div style={{ position: "absolute", right: -70, bottom: -30, background: "#fff", borderRadius: "50%", padding: 12, boxShadow: C.shadow2, scale: pop(frame, fps, 0.8, 0.6), rotate: `${Math.sin(s * 4) * 6}deg` }}>
          <Ilus cual="short" size={180} />
        </div>
      </div>
      <div style={{ position: "absolute", top: 870, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 30, fontFamily: POPPINS, textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, ...aparece(0.6) }}>
          <Img src={staticFile("logo-icon.png")} style={{ width: 92, height: 92, borderRadius: 26, boxShadow: C.shadow1 }} />
          <span style={{ fontFamily: FRAUNCES, fontWeight: 600, fontSize: 60, color: C.ink }}>Peludos Factory</span>
        </div>
        <div style={{ fontFamily: FRAUNCES, fontWeight: 700, fontSize: 100, lineHeight: 1.02, color: C.ink, ...aparece(0.9) }}>
          Haz tu pedido <span style={{ color: C.accent }}>💛</span>
        </div>
        <div style={{ background: C.gradient, color: "#fff", borderRadius: 99, padding: "26px 56px", fontWeight: 700, fontSize: 56, boxShadow: C.shadowCta, ...aparece(1.3), scale: mezcla(0.7, 1, pop(frame, fps, 1.3, 0.6)) * (1 + Math.max(0, Math.sin((s - 2) * 3.2)) * 0.035) }}>
          Link en nuestra bio 👆
        </div>
        <div style={{ fontWeight: 600, fontSize: 50, color: C.accentDark, ...aparece(1.7) }}>@peludosfactory</div>
      </div>
    </>
  );
};

export const Cierre = Interactive.create({
  Component: CierreInner,
  layout: "absolute-fill",
});
