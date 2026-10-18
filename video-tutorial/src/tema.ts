import { loadFont as cargarFraunces } from "@remotion/google-fonts/Fraunces";
import { loadFont as cargarPoppins } from "@remotion/google-fonts/Poppins";
import { Easing, interpolate } from "remotion";

// Mismas variables que pedido.html (:root), para que el video se vea igual que el formulario.
export const C = {
  bg: "#FDFAF0",
  surface: "#FFFFFF",
  surface2: "#F7F0E3",
  ink: "#2A1F1A",
  muted: "#6F6254",
  faint: "#A39683",
  line: "#E8DECB",
  accent: "#E8703A",
  accentDark: "#BF4A22",
  accentSoft: "#FCE6D8",
  accentSofter: "#FFF4EC",
  gradient: "linear-gradient(135deg, #E2672F 0%, #BF4A22 100%)",
  success: "#2F7D5B",
  successSoft: "#E2F0E8",
  wsp: "#1FAF5A",
  gold: "#E8B04B",
  shadow1: "0 1px 2px rgba(74,52,32,.05), 0 6px 18px rgba(196,82,42,.08)",
  shadow2: "0 2px 6px rgba(74,52,32,.06), 0 18px 40px rgba(74,52,32,.14)",
  shadowCta: "0 8px 22px rgba(191,74,34,.32)",
};

export const { fontFamily: FRAUNCES } = cargarFraunces("normal", {
  weights: ["600", "700"],
  subsets: ["latin"],
});
export const { fontFamily: POPPINS } = cargarPoppins("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

// Datos de muestra que se "escriben" en el formulario.
export const DEMO = {
  cliente: "Andrea",
  telefono: "987 654 321",
  codigo: "PF-2610-123",
  precio: 95,
  color: { codigo: "A09", hex: "#2A6F98" },
  patron: 3,
};

const SUAVE = Easing.bezier(0.16, 1, 0.3, 1);

/** 0→1 entre los segundos a y b (con easing suave), fijo fuera del rango. */
export const prog = (frame: number, fps: number, a: number, b: number, easing = SUAVE) =>
  interpolate(frame, [a * fps, b * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

/** Rebote tipo "pop" (spring) que empieza en el segundo a. */
export const pop = (frame: number, fps: number, a: number, dur = 0.5) =>
  interpolate(frame, [a * fps, (a + dur) * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
  });

export const mezcla = (a: number, b: number, t: number) => a + (b - a) * t;
