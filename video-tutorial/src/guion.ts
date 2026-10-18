// Tiempos (en segundos) de la escena del tutorial, contados desde que empieza esa escena.
// Mover un numero aqui mueve el toque, la pantalla y el texto juntos.
export const T = {
  entraCelular: 0.2,
  paso1: 2.4,
  tapWsp: 3.3,
  nombre: [4.0, 4.9] as const,
  tel: [5.2, 6.3] as const,
  tapContinuar: 7.1,
  pantTipo: 7.45,
  paso2: 7.9,
  tapPijama: 10.4,
  pantArmar: 10.75,
  paso3: 11.2,
  tapVaron: 12.4,
  tapTalla: 13.7,
  tapCorte: 15.0,
  tapFamilia: 16.3,
  tapTono: 17.1,
  tapPatron: 18.6,
  tapFoto: 20.0,
  fotoAparece: 20.55,
  tapListoFotos: 21.9,
  tapAgregar: 23.2,
  pantPedido: 23.55,
  paso4: 24.0,
  tapEnviar: 26.6,
  enviando: [26.85, 28.0] as const,
  pantExito: 28.0,
  paso5: 28.6,
  tapWspFinal: 32.2,
  fin: 33.6,
};

/** Duracion total de la escena del tutorial (s). */
export const DURACION_TUTORIAL = 34.5;

export const PASOS = [
  { desde: T.paso1, titulo: "Cuéntanos quién eres", sub: "Tu nombre y tu WhatsApp" },
  { desde: T.paso2, titulo: "Elige su prenda", sub: "Pijama, polo o bolso" },
  { desde: T.paso3, titulo: "Hazla única ✨", sub: "Talla, color, patrón y su foto" },
  { desde: T.paso4, titulo: "Revisa y envía", sub: "Todo tu pedido en una pantalla" },
  { desde: T.paso5, titulo: "Coordina tu adelanto", sub: "por WhatsApp, ¡y a crear! 💛" },
];
