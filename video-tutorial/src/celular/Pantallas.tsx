import { faInstagram, faTiktok, faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import {
  faArrowLeft,
  faArrowRight,
  faBan,
  faCamera,
  faCheck,
  faChevronDown,
  faChevronRight,
  faCircleDollarToSlot,
  faGift,
  faLightbulb,
  faMars,
  faPaw,
  faPen,
  faPlus,
  faTrash,
  faVenus,
} from "@fortawesome/free-solid-svg-icons";
import type React from "react";
import { Img, staticFile } from "remotion";
import { Icono } from "../piezas/Icono";
import { Ilus, type CualIlus } from "../piezas/Ilus";
import { C, DEMO, FRAUNCES, POPPINS, mezcla, pop, prog } from "../tema";
import { T } from "../guion";

// Pantalla del celular en "px CSS" (como un iPhone de 390 de ancho); el marco la escala.
export const W = 390;
export const H = 760;
const STATUS = 44;
const TOPBAR = 92;
export const CONTENT_TOP = STATUS + TOPBAR;
const PAD = 18;

// Segundos -> 0..1 (las pantallas trabajan en segundos de la escena del tutorial).
const p = (s: number, a: number, b: number) => prog(s, 1, a, b);
const pp = (s: number, a: number, dur = 0.45) => pop(s, 1, a, dur);

const sombra1 = C.shadow1;

// ---------- Piezas comunes ----------

const Tick: React.FC<{ v: number }> = ({ v }) => (
  <span
    style={{
      position: "absolute",
      top: -8,
      right: -8,
      width: 26,
      height: 26,
      borderRadius: "50%",
      background: C.gradient,
      display: "grid",
      placeItems: "center",
      scale: v,
      boxShadow: "0 3px 8px rgba(191,74,34,.35)",
    }}
  >
    <Icono icon={faCheck} size={11} color="#fff" />
  </span>
);

/** Tarjeta-opcion (.op): se marca con borde terracota y tick al elegirla (sel 0..1). */
const Op: React.FC<{ sel: number; style?: React.CSSProperties; children: React.ReactNode }> = ({
  sel,
  style,
  children,
}) => (
  <div
    style={{
      position: "relative",
      background: sel > 0.5 ? C.accentSofter : C.surface,
      borderRadius: 18,
      boxShadow: sel > 0.5 ? "0 6px 18px rgba(232,112,58,.18)" : sombra1,
      border: `2px solid ${sel > 0.5 ? C.accent : "transparent"}`,
      ...style,
    }}
  >
    {children}
    <Tick v={sel} />
  </div>
);

const Boton: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; verde?: boolean; presion?: number }> = ({
  children,
  style,
  verde,
  presion = 1,
}) => (
  <div
    style={{
      height: 54,
      borderRadius: 99,
      background: verde ? C.wsp : C.gradient,
      color: "#fff",
      fontWeight: 700,
      fontSize: 16,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      boxShadow: verde ? "0 8px 22px rgba(31,175,90,.32)" : C.shadowCta,
      scale: presion,
      ...style,
    }}
  >
    {children}
  </div>
);

/** Escala de "presion" para un boton tocado en el segundo t. */
const presionEn = (s: number, t: number) => {
  const d = s - t;
  if (d < -0.08 || d > 0.2) return 1;
  return d < 0 ? mezcla(1, 0.96, (d + 0.08) / 0.08) : mezcla(0.96, 1, d / 0.2);
};

const Barra: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: 80,
      padding: "12px 18px 14px",
      background: "rgba(253,250,240,.96)",
      borderTop: "1px solid rgba(232,222,203,.8)",
      display: "flex",
      alignItems: "center",
      gap: 14,
    }}
  >
    {children}
  </div>
);

const BarraTotal: React.FC<{ chico: string; monto: string }> = ({ chico, monto }) => (
  <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
    <small style={{ color: C.muted, fontSize: 12, fontWeight: 500 }}>{chico}</small>
    <b style={{ fontFamily: FRAUNCES, fontWeight: 600, fontSize: 25, lineHeight: 1.05 }}>{monto}</b>
  </div>
);

const Titulo: React.FC<{ h: string; p: string; size?: number }> = ({ h, p: texto, size = 28 }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <div style={{ fontFamily: FRAUNCES, fontWeight: 600, fontSize: size, lineHeight: 1.1 }}>{h}</div>
    <div style={{ color: C.muted, fontSize: 14.5, lineHeight: 1.4 }}>{texto}</div>
  </div>
);

const Chip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      background: C.surface2,
      padding: "3px 10px",
      borderRadius: 99,
      fontSize: 12,
      fontWeight: 500,
    }}
  >
    {children}
  </span>
);

const Swatch: React.FC<{ hex: string; size?: number; r?: number }> = ({ hex, size = 11, r = 4 }) => (
  <i
    style={{
      width: size,
      height: size,
      borderRadius: r,
      background: hex,
      boxShadow: "inset 0 0 0 1px rgba(42,31,26,.14)",
      display: "inline-block",
      flex: "none",
    }}
  />
);

const ChipsProducto: React.FC = () => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
    <Chip>Talla M</Chip>
    <Chip>Short varón</Chip>
    <Chip>Clásico</Chip>
    <Chip>
      <Swatch hex={DEMO.color.hex} />
      {DEMO.color.codigo}
    </Chip>
    <Chip>
      <Img src={staticFile(`patron-perro-${DEMO.patron}.png`)} style={{ width: 16, height: 16, objectFit: "contain" }} />
      Patrón {DEMO.patron}
    </Chip>
  </div>
);

const Linea: React.FC<{ acciones?: boolean }> = ({ acciones }) => (
  <div style={{ background: C.surface, borderRadius: 18, boxShadow: sombra1, padding: 14, display: "flex", gap: 12 }}>
    <Img src={staticFile("perro.webp")} style={{ width: 72, height: 72, borderRadius: 14, objectFit: "cover", flex: "none" }} />
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, fontSize: 15 }}>
        <span>Pijama con short</span>
        <span style={{ color: C.accentDark, fontWeight: 700 }}>S/ {DEMO.precio}</span>
      </div>
      <ChipsProducto />
      {acciones ? (
        <div style={{ display: "flex", gap: 16, fontSize: 13, fontWeight: 600 }}>
          <span style={{ color: C.accentDark, display: "inline-flex", gap: 6, alignItems: "center" }}>
            <Icono icon={faPen} size={12} color={C.accentDark} />
            Editar
          </span>
          <span style={{ color: C.muted, display: "inline-flex", gap: 6, alignItems: "center" }}>
            <Icono icon={faTrash} size={12} color={C.muted} />
            Quitar
          </span>
        </div>
      ) : null}
    </div>
  </div>
);

const Contenido: React.FC<{ children: React.ReactNode; scroll?: number; gap?: number }> = ({
  children,
  scroll = 0,
  gap = 22,
}) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      top: CONTENT_TOP,
      padding: `22px ${PAD}px 0`,
      display: "flex",
      flexDirection: "column",
      gap,
      translate: `0 ${-scroll}px`,
    }}
  >
    {children}
  </div>
);

/** Aparece desde abajo, escalonado (como la animacion "entra" del formulario). */
const entra = (s: number, desde: number, i: number): React.CSSProperties => {
  const v = p(s, desde + i * 0.07, desde + i * 0.07 + 0.5);
  return { opacity: v, translate: `0 ${(1 - v) * 14}px` };
};

// ---------- Barra superior (fija) ----------

export const BarraEstado: React.FC = () => (
  <div
    style={{
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: STATUS,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "6px 30px 0 34px",
      fontWeight: 600,
      fontSize: 15,
      zIndex: 5,
      background: C.bg,
    }}
  >
    <span>9:41</span>
    <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <span style={{ display: "flex", gap: 2, alignItems: "flex-end" }}>
        {[5, 7, 9, 11].map((h) => (
          <i key={h} style={{ width: 3, height: h, borderRadius: 1, background: C.ink }} />
        ))}
      </span>
      <span style={{ width: 24, height: 12, borderRadius: 4, border: `1.5px solid ${C.ink}`, padding: 1.5 }}>
        <i style={{ display: "block", width: "75%", height: "100%", borderRadius: 2, background: C.ink }} />
      </span>
    </span>
  </div>
);

export const Topbar: React.FC<{ paso: number; atras: number }> = ({ paso, atras }) => (
  <div
    style={{
      position: "absolute",
      top: STATUS,
      left: 0,
      right: 0,
      height: TOPBAR,
      padding: "8px 18px 12px",
      background: C.bg,
      borderBottom: "1px solid rgba(232,222,203,.7)",
      display: "flex",
      flexDirection: "column",
      gap: 12,
      zIndex: 4,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 10, height: 36 }}>
      <div
        style={{
          width: 36 * atras,
          height: 36,
          marginRight: atras > 0 ? 0 : -10,
          borderRadius: "50%",
          background: C.surface,
          boxShadow: sombra1,
          display: "grid",
          placeItems: "center",
          opacity: atras,
          overflow: "hidden",
        }}
      >
        <Icono icon={faArrowLeft} size={14} color={C.ink} />
      </div>
      <Img src={staticFile("logo-icon.png")} style={{ width: 32, height: 32, borderRadius: 10 }} />
      <span style={{ fontFamily: FRAUNCES, fontWeight: 600, fontSize: 17 }}>Peludos Factory</span>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
      {["Tus datos", "Tu pedido", "Confirmado"].map((txt, i) => (
        <div
          key={txt}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            fontSize: 11.5,
            fontWeight: 600,
            color: i < paso ? C.muted : i === paso ? C.accentDark : C.faint,
          }}
        >
          <i
            style={{
              height: 5,
              borderRadius: 99,
              background: i < paso ? C.accent : i === paso ? C.gradient : C.line,
              opacity: i < paso ? 0.45 : 1,
            }}
          />
          {txt}
        </div>
      ))}
    </div>
  </div>
);

// ---------- 1. Tus datos ----------

const escribir = (s: number, texto: string, [a, b]: readonly [number, number]) =>
  texto.slice(0, Math.round(p(s, a, b) * texto.length));

const Input: React.FC<{ label: string; valor: string; foco: boolean; s: number }> = ({ label, valor, foco, s }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
    <div style={{ fontWeight: 600, fontSize: 14, height: 20 }}>{label}</div>
    <div
      style={{
        height: 52,
        background: C.surface,
        border: `1.5px solid ${foco ? C.accent : C.line}`,
        boxShadow: foco ? `0 0 0 4px ${C.accentSoft}` : "none",
        borderRadius: 14,
        padding: "0 16px",
        display: "flex",
        alignItems: "center",
        fontSize: 16,
      }}
    >
      {valor}
      {foco && Math.floor(s * 2.2) % 2 === 0 ? (
        <i style={{ width: 2, height: 22, background: C.accent, marginLeft: 1 }} />
      ) : null}
    </div>
  </div>
);

export const PantDatos: React.FC<{ s: number }> = ({ s }) => {
  const wsp = s >= T.tapWsp ? pp(s, T.tapWsp, 0.35) : 0;
  const focoNombre = s >= T.nombre[0] - 0.15 && s < T.tel[0] - 0.15;
  const focoTel = s >= T.tel[0] - 0.15 && s < T.tapContinuar;
  const canal = (icon: typeof faWhatsapp, color: string, txt: string, sel: number) => (
    <Op sel={sel} style={{ height: 88, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, fontWeight: 600, fontSize: 13.5, textAlign: "center" }}>
      <Icono icon={icon} size={26} color={color} />
      {txt}
    </Op>
  );
  return (
    <>
      <Contenido>
        <div style={{ height: 178, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
          <div style={{ width: 76, height: 76, borderRadius: 24, background: C.surface, boxShadow: C.shadow2, display: "grid", placeItems: "center" }}>
            <Img src={staticFile("logo-icon.png")} style={{ width: 64, height: 64, borderRadius: 18 }} />
          </div>
          <div style={{ fontFamily: FRAUNCES, fontWeight: 600, fontSize: 33, lineHeight: 1.05, height: 36 }}>Arma tu pedido</div>
          <div style={{ color: C.muted, fontSize: 15, lineHeight: 1.45, maxWidth: 290 }}>
            Elige tu producto, personalízalo y súbenos la foto de tu peludo 🐾
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontFamily: FRAUNCES, fontWeight: 600, fontSize: 19, height: 24 }}>¿Por dónde nos escribes?</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {canal(faWhatsapp, C.wsp, "WhatsApp", wsp)}
            {canal(faInstagram, "#D6338C", "Instagram", 0)}
            {canal(faTiktok, C.ink, "TikTok u otro", 0)}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label="Tu nombre" valor={escribir(s, DEMO.cliente, T.nombre)} foco={focoNombre} s={s} />
          <Input
            label={wsp > 0.5 ? "Tu número de WhatsApp" : "Teléfono o usuario de contacto"}
            valor={escribir(s, DEMO.telefono, T.tel)}
            foco={focoTel}
            s={s}
          />
        </div>
      </Contenido>
      <Barra>
        <Boton style={{ flex: 1 }} presion={presionEn(s, T.tapContinuar)}>
          Continuar <Icono icon={faArrowRight} size={14} color="#fff" />
        </Boton>
      </Barra>
    </>
  );
};

// ---------- 2. ¿Que quieres pedir? ----------

const PRODUCTOS: { ilus: CualIlus; titulo: string; desc?: string; precio: number; regalo: boolean }[] = [
  { ilus: "short", titulo: "Pijama con short", desc: "Polo manga corta + short", precio: 95, regalo: true },
  { ilus: "pantalon", titulo: "Pijama con pantalón", desc: "Polo manga corta + pantalón", precio: 109, regalo: true },
  { ilus: "polo", titulo: "Polo de algodón", precio: 60, regalo: true },
  { ilus: "tote_bag", titulo: "Bolso personalizado", precio: 45, regalo: false },
];

export const PantTipo: React.FC<{ s: number }> = ({ s }) => (
  <Contenido>
    <div style={{ ...entra(s, T.pantTipo, 0) }}>
      <Titulo h="¿Qué quieres pedir?" p="Luego podrás agregar más productos al mismo pedido." />
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {PRODUCTOS.map((pr, i) => (
        <div key={pr.titulo} style={{ ...entra(s, T.pantTipo + 0.1, i + 1) }}>
          <Op
            sel={i === 0 && s >= T.tapPijama ? pp(s, T.tapPijama, 0.3) : 0}
            style={{ height: 112, display: "flex", alignItems: "center", gap: 14, padding: "12px 16px 12px 12px", scale: i === 0 ? presionEn(s, T.tapPijama) : 1 }}
          >
            <Ilus cual={pr.ilus} size={80} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
              <b style={{ fontFamily: FRAUNCES, fontWeight: 600, fontSize: 20, lineHeight: 1.15 }}>{pr.titulo}</b>
              {pr.desc ? <span style={{ color: C.muted, fontSize: 13.5 }}>{pr.desc}</span> : null}
              <span style={{ fontWeight: 700, color: C.accentDark, fontSize: 15, marginTop: 3 }}>S/ {pr.precio}</span>
              {pr.regalo ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, alignSelf: "flex-start", marginTop: 5, background: C.successSoft, color: C.success, fontWeight: 600, fontSize: 11, padding: "3px 9px", borderRadius: 99 }}>
                  <Icono icon={faGift} size={10} color={C.success} /> Incluye bolso de regalo
                </span>
              ) : null}
            </div>
            <Icono icon={faChevronRight} size={12} color={C.faint} />
          </Op>
        </div>
      ))}
    </div>
  </Contenido>
);

// ---------- 3. Armar el producto (acordeon) ----------

type Sec = "short" | "talla" | "corte" | "color" | "patron" | "fotos" | "obs";
const ORDEN: Sec[] = ["short", "talla", "corte", "color", "patron", "fotos", "obs"];
const TITULOS: Record<Sec, string> = {
  short: "¿Short de varón o de mujer?",
  talla: "Talla",
  corte: "Corte del polo",
  color: "Color",
  patron: "Patrón",
  fotos: "Fotos de tu mascota",
  obs: "¿Algo más que debamos saber?",
};
const CIERRA = 0.35; // pausa tras elegir antes de pasar a la siguiente seccion
const ANIM = 0.45;
// Cuando queda elegida cada seccion y cuando se cierra.
const ELEGIDA: Record<Sec, number> = {
  short: T.tapVaron,
  talla: T.tapTalla,
  corte: T.tapCorte,
  color: T.tapTono,
  patron: T.tapPatron,
  fotos: T.fotoAparece,
  obs: 9999,
};
const CIERRE: Record<Sec, number> = {
  short: T.tapVaron + CIERRA,
  talla: T.tapTalla + CIERRA,
  corte: T.tapCorte + CIERRA,
  color: T.tapTono + CIERRA,
  patron: T.tapPatron + CIERRA,
  fotos: T.tapListoFotos + CIERRA,
  obs: 9999,
};
const APERTURA = (k: Sec) => (k === "short" ? -10 : k === "obs" ? 9999 : CIERRE[ORDEN[ORDEN.indexOf(k) - 1]]);

const apertura = (k: Sec, s: number) => p(s, APERTURA(k), APERTURA(k) + ANIM) * (1 - p(s, CIERRE[k], CIERRE[k] + ANIM));
const altoCuerpo = (k: Sec, s: number) => {
  const base: Record<Sec, number> = { short: 86, talla: 47, corte: 186, color: 262, patron: 312, fotos: 224, obs: 0 };
  const extra = k === "fotos" ? 146 * p(s, T.fotoAparece, T.fotoAparece + 0.4) : 0;
  return base[k] + extra;
};
const CABEZA = 58;
const SECCIONES_TOP = CONTENT_TOP + 22 + 70 + 22;

/** Posicion (y de pantalla, sin scroll) de cada seccion en el segundo s. */
function tops(s: number) {
  const r = {} as Record<Sec, number>;
  let y = SECCIONES_TOP;
  for (const k of ORDEN) {
    r[k] = y;
    y += CABEZA + (altoCuerpo(k, s) + 20) * apertura(k, s) + 10;
  }
  return r;
}
/** Desplazamiento de la pantalla: sigue a la seccion abierta. */
export function scrollArmar(s: number) {
  const t = tops(s);
  const objetivo = (k: Sec) => (k === "short" ? 0 : Math.max(0, t[k] - (CONTENT_TOP + 12)));
  let sc = objetivo("short");
  for (let i = 0; i < ORDEN.length - 1; i++) {
    const k = ORDEN[i];
    const sig = k === "fotos" ? 0 : objetivo(ORDEN[i + 1]); // al terminar vuelve arriba: todo en verde
    sc = mezcla(sc, sig, p(s, CIERRE[k], CIERRE[k] + ANIM));
  }
  return sc;
}
/** Punto de pantalla de un elemento dentro del cuerpo de una seccion, en el segundo s. */
export const puntoArmar = (k: Sec, dx: number, dy: number, s: number) => ({
  t: s,
  x: dx,
  y: tops(s)[k] - scrollArmar(s) + CABEZA + 2 + dy,
});

const RESUMEN: Partial<Record<Sec, React.ReactNode>> = {
  short: "Varón",
  talla: "M",
  corte: "Clásico",
  color: (
    <>
      <Swatch hex={DEMO.color.hex} size={20} r={6} />
      {DEMO.color.codigo}
    </>
  ),
  patron: (
    <>
      <Img src={staticFile(`patron-perro-${DEMO.patron}.png`)} style={{ width: 20, height: 20, objectFit: "contain" }} />
      N.º {DEMO.patron}
    </>
  ),
  fotos: "1 foto",
};

const FAMILIAS = [
  { nombre: "Rojos", hex: "#CD0000" },
  { nombre: "Azul", hex: "#062D77" },
  { nombre: "Verde", hex: "#115234" },
  { nombre: "Rosa", hex: "#FDA4C4" },
  { nombre: "Lila", hex: "#A774D3" },
];
const ROJOS = ["#820000", "#9A0001", "#B30000", "#CD0000", "#E70000", "#FF0000", "#FF1818", "#FF3232", "#F84848", "#FA5354"];
const AZULES = ["#041037", "#031846", "#082065", "#062D77", "#114D94", "#022239", "#013B63", "#01487C", "#2A6F98", "#2D7DA0"];

const PERRO_GUIA = `<path d="M17 22C7 25 6 45 14 53C21 50 25 40 25 29Z" fill="#B97A45"/><path d="M63 22C73 25 74 45 66 53C59 50 55 40 55 29Z" fill="#B97A45"/><ellipse cx="40" cy="42" rx="24" ry="25" fill="#E8B57F"/><ellipse cx="40" cy="53" rx="13" ry="10" fill="#FBEBD6"/><circle cx="31" cy="38" r="2.8" fill="#2A1F1A"/><circle cx="49" cy="38" r="2.8" fill="#2A1F1A"/><ellipse cx="40" cy="48" rx="4.2" ry="3" fill="#2A1F1A"/><path d="M40 51v4M40 55c-3 4-8 3-9 0M40 55c3 4 8 3 9 0" fill="none" stroke="#2A1F1A" stroke-width="1.6" stroke-linecap="round"/><path d="M37 58q3 7 6 0z" fill="#E8703A"/>`;

const Cuerpo: React.FC<{ k: Sec; s: number }> = ({ k, s }) => {
  const sel = (t: number) => (s >= t ? pp(s, t, 0.35) : 0);
  if (k === "short")
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[
          { icon: faMars, txt: "Varón", v: sel(T.tapVaron) },
          { icon: faVenus, txt: "Mujer", v: 0 },
        ].map((o) => (
          <Op key={o.txt} sel={o.v} style={{ height: 86, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, fontWeight: 600, fontSize: 16 }}>
            <Icono icon={o.icon} size={21} color={C.accent} />
            {o.txt}
          </Op>
        ))}
      </div>
    );
  if (k === "talla")
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
        {["12", "14", "S", "M", "L", "XL"].map((t) => (
          <Op key={t} sel={t === "M" ? sel(T.tapTalla) : 0} style={{ height: 47, display: "grid", placeItems: "center", fontWeight: 700, fontSize: 16, borderRadius: 14 }}>
            {t}
          </Op>
        ))}
      </div>
    );
  if (k === "corte")
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[
          { f: "corte-clasico.png", txt: "Clásico", v: sel(T.tapCorte) },
          { f: "corte-princesa.png", txt: "Princesa", v: 0 },
        ].map((o) => (
          <Op key={o.txt} sel={o.v} style={{ padding: "8px 8px 12px", display: "flex", flexDirection: "column", gap: 8, textAlign: "center", fontWeight: 600, fontSize: 15 }}>
            <Img src={staticFile(o.f)} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 12 }} />
            {o.txt}
          </Op>
        ))}
      </div>
    );
  if (k === "color") {
    const azul = s >= T.tapFamilia;
    const tonos = azul ? AZULES : ROJOS;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 8, height: 38, overflow: "hidden", margin: "0 -16px", padding: "0 16px" }}>
          {FAMILIAS.map((f, i) => {
            const on = azul ? i === 1 : i === 0;
            return (
              <span key={f.nombre} style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 7, padding: "0 14px 0 9px", borderRadius: 99, background: on ? C.accentSofter : C.surface2, border: `2px solid ${on ? C.accent : "transparent"}`, color: on ? C.accentDark : C.ink, fontWeight: 600, fontSize: 13.5 }}>
                <Swatch hex={f.hex} size={18} r={9} />
                {f.nombre}
              </span>
            );
          })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "10px 8px" }}>
          {tonos.map((hex, i) => {
            const cod = `${azul ? "A" : "R"}${String(i + 1).padStart(2, "0")}`;
            const v = azul && cod === DEMO.color.codigo ? sel(T.tapTono) : 0;
            return (
              <div key={cod} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: v > 0.5 ? C.accentDark : C.muted }}>
                <i style={{ width: 58, height: 58, borderRadius: 16, background: hex, display: "grid", placeItems: "center", boxShadow: v > 0.5 ? `0 0 0 3px #fff, 0 0 0 5px ${C.accent}` : "inset 0 0 0 1px rgba(42,31,26,.12)", scale: v > 0.5 ? 0.94 : 1 }}>
                  <span style={{ scale: v }}>
                    <Icono icon={faCheck} size={15} color="#fff" />
                  </span>
                </i>
                {cod}
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.4 }}>Los colores pueden variar un poco según la pantalla de tu celular.</div>
      </div>
    );
  }
  if (k === "patron")
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", background: C.surface2, borderRadius: 99, padding: 4, gap: 4, height: 42 }}>
          <span style={{ borderRadius: 99, background: C.surface, boxShadow: sombra1, display: "grid", placeItems: "center", fontWeight: 600, fontSize: 14 }}>🐶 Perro</span>
          <span style={{ borderRadius: 99, display: "grid", placeItems: "center", fontWeight: 600, fontSize: 14, color: C.muted }}>🐱 Gato</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <Op key={n} sel={n === DEMO.patron ? sel(T.tapPatron) : 0} style={{ padding: "8px 8px 9px", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: C.muted, height: 121 }}>
              <div style={{ width: "100%", aspectRatio: "1", borderRadius: 12, background: C.surface2, padding: 8, display: "grid", placeItems: "center" }}>
                {n === 0 ? (
                  <Icono icon={faBan} size={24} color={C.faint} />
                ) : (
                  <Img src={staticFile(`patron-perro-${n}.png`)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                )}
              </div>
              {n === 0 ? "Sin patrón" : `N.º ${n}`}
            </Op>
          ))}
        </div>
      </div>
    );
  if (k === "fotos") {
    const foto = p(s, T.fotoAparece, T.fotoAparece + 0.4);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ height: 150, background: C.surface2, borderRadius: 14, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, display: "flex", alignItems: "center", gap: 7 }}>
            <Icono icon={faLightbulb} size={13} color={C.accent} /> Un consejo para que quede mejor
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {["Lo ideal: de frente y con buena luz", "Que no esté oscura", "Que no esté lejos"].map((txt, i) => (
              <div key={txt} style={{ display: "flex", flexDirection: "column", gap: 5, textAlign: "center", fontSize: 10.5, lineHeight: 1.2, fontWeight: i === 0 ? 600 : 500, color: i === 0 ? C.success : C.muted }}>
                <svg viewBox="0 0 80 80" style={{ width: "100%", height: 62, borderRadius: 12, background: "#FFE3CC", boxShadow: i === 0 ? `0 0 0 2px ${C.success}` : "none", filter: i === 1 ? "brightness(.74) blur(.8px)" : "none" }} dangerouslySetInnerHTML={{ __html: i === 2 ? `<g transform="translate(-10 -8) scale(.68)">${PERRO_GUIA}</g>` : PERRO_GUIA }} />
                {txt}
              </div>
            ))}
          </div>
        </div>
        <div style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 18, border: `2px dashed ${C.accent}`, background: C.accentSofter, color: C.accentDark, fontWeight: 600, fontSize: 15, scale: presionEn(s, T.tapFoto) }}>
          <Icono icon={faCamera} size={20} color={C.accentDark} />
          {foto > 0.5 ? "Agregar otra foto" : "Elegir foto"}
        </div>
        {foto > 0 ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, height: 74 }}>
              <div style={{ position: "relative", opacity: foto, scale: mezcla(0.4, 1, pp(s, T.fotoAparece, 0.5)) }}>
                <Img src={staticFile("perro.webp")} style={{ width: "100%", height: 74, objectFit: "cover", borderRadius: 14, display: "block" }} />
              </div>
            </div>
            <Boton style={{ height: 44, width: 92, fontSize: 14.5, opacity: foto }} presion={presionEn(s, T.tapListoFotos)}>
              Listo
            </Boton>
          </>
        ) : null}
      </div>
    );
  }
  return null;
};

export const PantArmar: React.FC<{ s: number }> = ({ s }) => {
  const sc = scrollArmar(s);
  const t = tops(s);
  let n = 0;
  return (
    <>
      <div style={{ position: "absolute", inset: 0, translate: `0 ${-sc}px` }}>
        <div style={{ position: "absolute", top: CONTENT_TOP + 22, left: PAD, right: PAD, height: 70, display: "flex", alignItems: "center", gap: 12, ...entra(s, T.pantArmar, 0) }}>
          <Ilus cual="short" size={64} />
          <Titulo h="Pijama con short" p="Toca cada opción. Puedes volver a cualquiera." size={25} />
        </div>
        {ORDEN.map((k, i) => {
          const ab = apertura(k, s);
          const lista = s >= ELEGIDA[k];
          const opcional = k === "obs";
          if (!opcional) n++;
          const abierta = ab > 0.5;
          return (
            <div
              key={k}
              style={{
                position: "absolute",
                left: PAD,
                right: PAD,
                top: t[k],
                background: C.surface,
                borderRadius: 18,
                boxShadow: abierta ? C.shadow2 : sombra1,
                overflow: "hidden",
                ...entra(s, T.pantArmar + 0.1, i + 1),
              }}
            >
              <div style={{ height: CABEZA, display: "flex", alignItems: "center", gap: 12, padding: "0 16px" }}>
                <span style={{ width: 28, height: 28, borderRadius: "50%", flex: "none", display: "grid", placeItems: "center", fontSize: 12.5, fontWeight: 700, background: lista ? C.success : abierta ? C.accentSoft : C.surface2, color: lista ? "#fff" : abierta ? C.accentDark : C.muted, scale: lista ? mezcla(0.6, 1.04, pp(s, ELEGIDA[k], 0.4)) : 1 }}>
                  {lista ? <Icono icon={faCheck} size={12} color="#fff" /> : opcional ? <Icono icon={faPen} size={11} color={C.muted} /> : n}
                </span>
                <span style={{ flex: 1, fontWeight: 600, fontSize: abierta ? 18 : 15, fontFamily: abierta ? FRAUNCES : POPPINS }}>{TITULOS[k]}</span>
                {!abierta && lista && RESUMEN[k] ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: C.muted, fontSize: 13.5, fontWeight: 500, opacity: 1 - ab * 2 }}>{RESUMEN[k]}</span>
                ) : null}
                {!abierta && opcional ? <span style={{ fontSize: 11.5, fontWeight: 600, color: C.faint }}>Opcional</span> : null}
                <Icono icon={faChevronDown} size={11} color={C.faint} style={{ rotate: `${ab * 180}deg` }} />
              </div>
              <div style={{ height: (altoCuerpo(k, s) + 20) * ab, overflow: "hidden" }}>
                <div style={{ padding: "2px 16px 18px", opacity: ab }}>
                  <Cuerpo k={k} s={s} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <Barra>
        <BarraTotal chico="Pijama con short" monto={`S/ ${DEMO.precio}`} />
        <Boton style={{ width: 196, flex: "none" }} presion={presionEn(s, T.tapAgregar)}>
          Agregar al pedido
        </Boton>
      </Barra>
    </>
  );
};

// ---------- 4. Tu pedido ----------

export const PantPedido: React.FC<{ s: number }> = ({ s }) => (
  <>
    <Contenido>
      <div style={entra(s, T.pantPedido, 0)}>
        <Titulo h="Tu pedido" p="Revisa que todo esté como lo quieres antes de enviarlo." />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, ...entra(s, T.pantPedido, 1) }}>
        <Linea acciones />
        <div style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 18, border: `2px dashed ${C.line}`, color: C.muted, fontWeight: 600, fontSize: 15 }}>
          <Icono icon={faPlus} size={14} color={C.muted} /> Agregar otro producto
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: C.surface, borderRadius: 18, boxShadow: sombra1, padding: "13px 16px", ...entra(s, T.pantPedido, 2) }}>
        <Icono icon={faWhatsapp} size={22} color={C.wsp} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", fontSize: 15 }}>
          <b>{DEMO.cliente}</b>
          <small style={{ color: C.muted, fontSize: 13 }}>{DEMO.telefono}</small>
        </div>
        <span style={{ color: C.accentDark, fontWeight: 600, fontSize: 14 }}>Cambiar</span>
      </div>
      <div style={{ background: C.accentSoft, color: "#8A3A19", padding: "14px 16px", borderRadius: 18, fontSize: 14, lineHeight: 1.45, ...entra(s, T.pantPedido, 3) }}>
        El plazo máximo de producción son 7 días hábiles 🗓️ Si tu pedido está listo antes, te escribimos ⭐
      </div>
    </Contenido>
    <Barra>
      <BarraTotal chico="Total" monto={`S/ ${DEMO.precio}`} />
      <Boton style={{ width: 200, flex: "none" }} presion={presionEn(s, T.tapEnviar)}>
        Confirmar y enviar
      </Boton>
    </Barra>
  </>
);

export const Enviando: React.FC<{ s: number }> = ({ s }) => {
  const v = p(s, T.enviando[0], T.enviando[0] + 0.2) * (1 - p(s, T.enviando[1] - 0.05, T.enviando[1] + 0.15));
  if (v <= 0) return null;
  const barra = p(s, T.enviando[0] + 0.1, T.enviando[1] - 0.15);
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(253,250,240,.95)", display: "grid", placeItems: "center", opacity: v, zIndex: 6 }}>
      <div style={{ width: 280, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
        <span style={{ translate: `0 ${-Math.abs(Math.sin(s * 6)) * 10}px`, rotate: `${Math.sin(s * 6) * 8}deg` }}>
          <Icono icon={faPaw} size={38} color={C.accent} />
        </span>
        <b style={{ fontFamily: FRAUNCES, fontWeight: 600, fontSize: 21 }}>Enviando tu pedido</b>
        <div style={{ width: "100%", height: 8, borderRadius: 99, background: C.line, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${barra * 100}%`, borderRadius: 99, background: C.gradient }} />
        </div>
        <small style={{ color: C.muted, fontSize: 13 }}>No cierres esta pantalla</small>
      </div>
    </div>
  );
};

// ---------- 5. Pedido registrado ----------

export const PantExito: React.FC<{ s: number }> = ({ s }) => (
  <Contenido gap={20}>
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
      <div style={{ width: 84, height: 84, borderRadius: "50%", background: C.success, display: "grid", placeItems: "center", boxShadow: "0 12px 28px rgba(47,125,91,.35)", scale: pp(s, T.pantExito + 0.15, 0.6) }}>
        <Icono icon={faCheck} size={34} color="#fff" />
      </div>
      <div style={{ fontFamily: FRAUNCES, fontWeight: 600, fontSize: 31, height: 34, lineHeight: 1.1, ...entra(s, T.pantExito + 0.3, 0) }}>¡Pedido registrado!</div>
      <span style={{ fontFamily: FRAUNCES, fontWeight: 600, fontSize: 22, background: C.surface, padding: "6px 20px", borderRadius: 99, boxShadow: sombra1, height: 44, display: "grid", placeItems: "center", ...entra(s, T.pantExito + 0.4, 0) }}>
        {DEMO.codigo}
      </span>
    </div>
    <div style={{ background: C.gradient, color: "#fff", padding: "14px 18px", borderRadius: 18, fontWeight: 600, fontSize: 14.5, display: "flex", alignItems: "center", gap: 13, lineHeight: 1.35, boxShadow: C.shadowCta, height: 76, ...entra(s, T.pantExito + 0.5, 0) }}>
      <Icono icon={faCircleDollarToSlot} size={26} color="#fff" />
      <span>Solo falta coordinar el adelanto del 50% por WhatsApp para empezar tu pedido 💛</span>
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 10, ...entra(s, T.pantExito + 0.6, 0) }}>
      <Linea />
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FRAUNCES, fontWeight: 600, fontSize: 21, padding: "4px 4px 0" }}>
        <span>Total</span>
        <span>S/ {DEMO.precio}</span>
      </div>
    </div>
    <div style={entra(s, T.pantExito + 0.7, 0)}>
      <Boton verde presion={presionEn(s, T.tapWspFinal)}>
        <Icono icon={faWhatsapp} size={20} color="#fff" /> Escribir por WhatsApp
      </Boton>
    </div>
  </Contenido>
);
