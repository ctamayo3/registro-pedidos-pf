# Video «Cómo hacer tu pedido» — diseño

**Fecha:** 2026-10-18 · **Herramienta:** Remotion (React → MP4)

## Objetivo

Video corto para Reels / TikTok / Historias que muestre lo fácil que es pedir en Peludos Factory
con el formulario público (`pedido.html`). Tono emocional, tierno y cálido, como la marca.

## Decisiones tomadas con Cesar

- **Formato:** vertical 9:16, 1080×1920, 30 fps, ~45 s.
- **Audio:** sin voz ni música incrustada. Textos animados grandes que se entienden sin sonido; Cesar
  le pone un audio en tendencia al subirlo.
- **Estilo:** el formulario real recreado dentro de un celular animado, con un dedito que toca, más
  huellitas y corazones entre pasos. Marca actual: crema `#FDFAF0`, terracota `#E8703A`/`#C4522A`,
  dorado, Fraunces (títulos) + Poppins (texto), ilustraciones planas del formulario. Sin temas oscuros.
- **Mascota:** foto real de un perro (cara de frente, lengua afuera), entregada por Cesar. Nombre
  de muestra: «Canela» (se cambia en una constante).
- **Cierre:** logo + «Haz tu pedido · link en nuestra bio · @peludosfactory».

## Guion

| Tiempo | Escena | Texto |
|---|---|---|
| 0–4 s | Gancho: la foto del perro aparece en un marco redondo con corazones flotando | ¿Y si tu peludito tuviera su propia pijama? |
| 4–7 s | Entra el celular con el logo | Pedirla es así de fácil 👇 |
| 7–13 s | Paso 1 «Tus datos»: toca WhatsApp, se escribe el nombre | Cuéntanos quién eres |
| 13–19 s | Paso 2: 4 tarjetas de producto, toca «Pijama manga corta + short» | Elige su prenda |
| 19–31 s | Paso 3 en cortes rápidos: talla M → short varón → color → patrón de perro → sube la foto | Hazla única ✨ |
| 31–37 s | Paso 4 «Tu pedido»: resumen con la foto, toca Enviar, lluvia de huellitas, código `PF-2610-…` | Revisa y envía |
| 37–41 s | Paso 5: botón de WhatsApp | Coordinamos tu adelanto por WhatsApp 💬 |
| 41–47 s | Cierre: la foto del perro con pijama ilustrada / logo y CTA | Haz tu pedido · link en nuestra bio · @peludosfactory |

Cada paso lleva una etiqueta numerada («1 de 5») para que se note lo corto que es.

## Contenido fiel al formulario

- Las pantallas imitan las vistas reales de `pedido.html` (`datos` → `tipo` → `armar` → `pedido` →
  `exito`): mismos textos, chips, ilustraciones SVG (`ilus()`) y barra inferior con precio y botón.
- Precio: S/95 (precio regular; no se muestra la promo, que termina el 19/10).
- Patrón: imagen real de un patrón de perro (Storage) y color de la `PANTONERA`.
- Los textos en pantalla deben coincidir con el formulario actual; si el formulario cambia, el
  video no se actualiza solo.

## Implementación

- Proyecto Remotion en `video-tutorial/` dentro del repo (`node_modules/` y `out/` en `.gitignore`).
  La raíz del repo no tiene `package.json`, así que Vercel sigue sirviendo solo archivos estáticos.
- Una composición `ComoPedir` hecha de escenas (`<Series>`), cada una en su componente: `Gancho`,
  `EntraCelular`, `PasoDatos`, `PasoProducto`, `PasoArmar`, `PasoPedido`, `PasoWhatsApp`, `Cierre`;
  piezas comunes: `Celular`, `Dedo`, `TextoGrande`, `Huellitas`, `Corazones`.
- Assets en `video-tutorial/public/`: foto del perro, `logo-icon.png`, imagen del patrón.
- Salida: `video-tutorial/out/como-pedir.mp4` (H.264), que se le entrega a Cesar.

## Verificación

- Revisar fotogramas fijos de cada escena (render de stills) antes del MP4 final: legibilidad del
  texto en celular, que nada quede bajo las zonas tapadas por la interfaz de Reels/TikTok (dejar
  ~250 px libres arriba y ~400 px abajo).
- Render completo y revisar duración y peso del archivo.
