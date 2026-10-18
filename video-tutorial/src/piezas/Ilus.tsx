import type React from "react";

// Copia de las ilustraciones de pedido.html (función ilus()). Si cambian alla, actualizar aqui.
const DEFS = `<defs>
<clipPath id="cp-tee"><path d="M30 8L42 3C45 11 55 11 58 3L70 8L92 26L82 42L72 36L72 86C72 89 70 91 67 91L33 91C30 91 28 89 28 86L28 36L18 42L8 26Z"/></clipPath>
<clipPath id="cp-short"><path d="M22 4L78 4C80 4 81 5 81 7L86 40C86 43 84 45 81 45L58 45C56 45 54 43 54 41L50 24L46 41C46 43 44 45 42 45L19 45C16 45 14 43 14 40L19 7C19 5 20 4 22 4Z"/></clipPath>
<clipPath id="cp-pant"><path d="M22 4L78 4C80 4 81 5 81 7L84 78C84 81 82 83 79 83L61 83C59 83 57 81 57 79L50 26L43 79C43 81 41 83 39 83L21 83C18 83 16 81 16 78L19 7C19 5 20 4 22 4Z"/></clipPath>
<clipPath id="cp-tote"><path d="M30 46L90 46C92 46 93 47 93 49L97 98C97 102 95 104 91 104L29 104C25 104 23 102 23 98L27 49C27 47 28 46 30 46Z"/></clipPath>
</defs>`;

const TEE_D = "M30 8L42 3C45 11 55 11 58 3L70 8L92 26L82 42L72 36L72 86C72 89 70 91 67 91L33 91C30 91 28 89 28 86L28 36L18 42L8 26Z";
const TOTE_D = "M30 46L90 46C92 46 93 47 93 49L97 98C97 102 95 104 91 104L29 104C25 104 23 102 23 98L27 49C27 47 28 46 30 46Z";
const CARITA = (x: number, y: number, s = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-8.5 -5q-8-11 0-14q7 3 7 11zM8.5 -5q8-11 0-14q-7 3-7 11z" fill="#C4522A"/><circle r="10" fill="#E8703A"/><ellipse cy="3.6" rx="5.2" ry="4.2" fill="#FBD9C3"/><circle cx="-3.8" cy="-2" r="1.45" fill="#2A1F1A"/><circle cx="3.8" cy="-2" r="1.45" fill="#2A1F1A"/><ellipse cy="1.9" rx="2.2" ry="1.6" fill="#2A1F1A"/><path d="M0 3.4v1.6M0 5c-1.4 1.7-3.4 1.2-3.8 0M0 5c1.4 1.7 3.4 1.2 3.8 0" fill="none" stroke="#2A1F1A" stroke-width=".9" stroke-linecap="round"/></g>`;
const ESTAMPA = (x: number, y: number, s: number) =>
  `<circle cx="${x}" cy="${y - 2 * s}" r="${15.5 * s}" fill="#FCE6D8"/>${CARITA(x, y, 1.12 * s)}`;
export const PATA = (x: number, y: number, s = 1, r = 0) =>
  `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})"><ellipse cy="2.3" rx="2.7" ry="2.2"/><circle cx="-3.1" cy="-.9" r="1.15"/><circle cx="-1.15" cy="-3" r="1.2"/><circle cx="1.15" cy="-3" r="1.2"/><circle cx="3.1" cy="-.9" r="1.15"/></g>`;
const BRILLO = (x: number, y: number, s: number) =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -5C.6 -1.4 1.4 -.6 5 0C1.4 .6 .6 1.4 0 5C-.6 1.4 -1.4 .6 -5 0C-1.4 -.6 -.6 -1.4 0 -5Z" fill="#F0C29E"/>`;
const TEE = `<g clip-path="url(#cp-tee)"><rect width="100" height="96" fill="#FFFFFF"/><path d="M64 0H100V96H62C68 70 69 40 64 0Z" fill="#F5ECDD"/><path d="M28 36L18 42L28 54ZM72 36L82 42L72 54Z" fill="#EDE0CB"/></g>
<path d="${TEE_D}" fill="none" stroke="#D8C5A6" stroke-width="2.2" stroke-linejoin="round"/>
<path d="M40.5 3.6C44 14.5 56 14.5 59.5 3.6L58 3C55 11 45 11 42 3Z" fill="#EADBC3" stroke="#D8C5A6" stroke-width="1.4" stroke-linejoin="round"/>
<path d="M10.5 24.4L20.5 40.4M89.5 24.4L79.5 40.4M29 85H71" fill="none" stroke="#E2D1B5" stroke-width="1.5" stroke-linecap="round"/>
${ESTAMPA(50, 54, 1)}`;
const CINTURA = `<rect width="100" height="11.5" fill="#C4522A"/><path d="M24 2.5v7M30 2.5v7M36 2.5v7M42 2.5v7M58 2.5v7M64 2.5v7M70 2.5v7M76 2.5v7" stroke="#9E3B1A" stroke-width="1.1" opacity=".6"/>`;
const LAZO = `<g fill="none" stroke="#FFF4EC" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M50 8.5c-5-5-9-1-5.5 2.2c1.6 1.4 4 .2 5.5-2.2zM50 8.5c5-5 9-1 5.5 2.2c-1.6 1.4-4 .2-5.5-2.2z"/><path d="M49 9.6l-2.6 8.4M51 9.6l2.6 8.4"/></g><circle cx="50" cy="8.6" r="1.6" fill="#FFF4EC"/>`;
const SHORT = `<g clip-path="url(#cp-short)"><rect width="100" height="50" fill="#EE7F47"/><rect x="50" width="50" height="50" fill="#C4522A" opacity=".13"/>
<g fill="#FFE9DA" opacity=".92">${PATA(28, 23, 1.2, -18)}${PATA(72, 22, 1.2, 16)}${PATA(38, 33, 0.95, 12)}${PATA(64, 34, 0.95, -14)}</g>
<rect y="38.5" width="100" height="8" fill="#D9602F"/><path d="M50 11.5V24" stroke="#C4522A" stroke-width="1.6"/>${CINTURA}</g>${LAZO}`;
const PANTALON = `<g clip-path="url(#cp-pant)"><rect width="100" height="86" fill="#EE7F47"/><rect x="50" width="50" height="86" fill="#C4522A" opacity=".13"/>
<g fill="#FFE9DA" opacity=".92">${PATA(28, 24, 1.2, -18)}${PATA(72, 23, 1.2, 16)}${PATA(36, 40, 1, 10)}${PATA(66, 42, 1, -12)}${PATA(26, 56, 1.1, -8)}${PATA(73, 58, 1.1, 14)}${PATA(34, 69, 0.9, 16)}${PATA(67, 70, 0.9, -16)}</g>
<rect y="75" width="100" height="9" fill="#D9602F"/><path d="M50 11.5V26" stroke="#C4522A" stroke-width="1.6"/>${CINTURA}</g>${LAZO}`;

export type CualIlus = "short" | "pantalon" | "polo" | "tote_bag";

function ilusHtml(cual: CualIlus, conFondo: boolean) {
  const fondo = conFondo
    ? `<circle cx="60" cy="60" r="56" fill="#F7EAD7"/>${BRILLO(101, 27, 1)}${BRILLO(18, 86, 0.75)}${BRILLO(25, 25, 0.55)}`
    : "";
  const sombra = (cy: number, rx: number) => `<ellipse cx="60" cy="${cy}" rx="${rx}" ry="3.4" fill="#E7D5BB"/>`;
  let dibujo;
  if (cual === "polo") dibujo = `${sombra(105, 30)}<g transform="translate(13 12) scale(.94)">${TEE}</g>`;
  else if (cual === "tote_bag")
    dibujo = `${sombra(108, 32)}<path d="M43 50C43 22 77 22 77 50" fill="none" stroke="#C4522A" stroke-width="5.5" stroke-linecap="round"/><path d="M45.5 48C46 28 74 28 74.5 48" fill="none" stroke="#E8703A" stroke-width="1.5" stroke-linecap="round"/>
<g clip-path="url(#cp-tote)"><rect x="20" y="44" width="80" height="62" fill="#FFFFFF"/><path d="M74 44H100V106H70C76 88 77 66 74 44Z" fill="#F5ECDD"/></g>
<path d="${TOTE_D}" fill="none" stroke="#D8C5A6" stroke-width="2.2" stroke-linejoin="round"/><path d="M28.5 54H91.5" stroke="#E2D1B5" stroke-width="1.5" stroke-dasharray="3 3"/>${ESTAMPA(60, 80, 1.15)}`;
  else if (cual === "pantalon")
    dibujo = `${sombra(110, 22)}<g transform="translate(29 7) scale(.62)">${TEE}</g><g transform="translate(31 59) scale(.58)">${PANTALON}</g>`;
  else
    dibujo = `${sombra(101, 25)}<g transform="translate(27 14) scale(.66)">${TEE}</g><g transform="translate(29.5 69) scale(.61)">${SHORT}</g>`;
  return `${DEFS}${fondo}${dibujo}`;
}

export const Ilus: React.FC<{ cual: CualIlus; size: number; conFondo?: boolean; style?: React.CSSProperties }> = ({
  cual,
  size,
  conFondo = true,
  style,
}) => (
  <svg
    viewBox="0 0 120 120"
    style={{ width: size, height: size, flex: "none", display: "block", ...style }}
    dangerouslySetInnerHTML={{ __html: ilusHtml(cual, conFondo) }}
  />
);

/** Huellita suelta (para decorar). */
export const Pata: React.FC<{ size: number; color: string; style?: React.CSSProperties }> = ({ size, color, style }) => (
  <svg
    viewBox="-6 -6 12 12"
    style={{ width: size, height: size, display: "block", ...style }}
    fill={color}
    dangerouslySetInnerHTML={{ __html: PATA(0, 0, 1, 0) }}
  />
);
