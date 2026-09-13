# PDFs de producción (confección y estampado) — Diseño

**Fecha:** 2026-09-12
**Archivo afectado:** `index.html` (solo frontend, sin cambios de base de datos)

## Contexto y objetivo

La producción de pijamas pasa por dos personas externas:

- **Confeccionista**: arma los pantalones/shorts de las pijamas. Ya recibe los cortes de tela y tiene
  los elásticos; necesita saber cuántas piezas son, de qué tipo, talla, color y patrón.
- **Estampador**: estampa la parte de arriba (el polo) de las pijamas. Necesita la foto de la mascota
  junto a la talla y el corte del polo, para saber qué foto va en qué prenda.

Hoy esa información se arma a mano. El objetivo es que desde la app interna se descarguen (o
compartan directo por WhatsApp desde el iPhone) **2 PDFs separados**, uno para cada persona.

**Regla clave:** ningún PDF dice para quién es ("confeccionista"/"estampador"). Esa separación existe
solo dentro de la app; el documento describe su contenido ("Pantalones y shorts" / "Polos") y Cesar
decide a quién mandarlo.

## Alcance

- **Solo productos `tipo_producto = 'pijama'`** (las 3 variantes). Los productos Polo y Tote bag
  vendidos sueltos **no** entran en ningún PDF (decisión explícita del usuario — se manejan por otro
  lado). Tampoco la tote bag de regalo de la pijama.
- Sin columnas ni tablas nuevas, sin SQL. Solo lectura con la sesión `authenticated` existente.
- No se guarda nada de lo que se elige al generar (ni filtros ni fotos elegidas).

## Experiencia de uso

### Tarjeta "Producción" en el Dashboard

Nueva tarjeta en el Dashboard, junto a "Materiales a comprar" (dentro de `.dashboard-lower-grid`),
con 2 botones: **Confección** y **Estampado** (etiquetas internas, nunca aparecen en el PDF).

### Modal de generación

Al tocar cualquiera de los 2 botones se abre un modal con:

1. **Lote**: selector con todos los lotes, preseleccionado el lote activo.
2. **Estados**: un checkbox por estado — `Pendiente`, `Diseño enviado`, `En producción`, `Listo`,
   `Entregado`. Por defecto marcados: **Pendiente, Diseño enviado, En producción**. `Por confirmar`
   no se ofrece nunca (pedidos no confirmados no entran a producción).
3. **Solo en Estampado — elección de fotos**: al elegir lote/estados se lista cada pijama que cumple
   el filtro (número `N-L#`, talla, corte o "Manga larga") con miniaturas de todas sus fotos. Se
   pueden marcar **una o varias** fotos por pijama; por defecto viene marcada la primera. Pijamas sin
   fotos se listan con el texto "sin foto" (no se puede marcar nada). La lista se recarga si cambia
   el lote o los estados.
4. Botón **Generar PDF**. Cuando termina de armarse, se reemplaza por **Descargar** y **Compartir**
   (este último solo si el navegador soporta compartir archivos — ver abajo). Cambiar lote, estados
   o fotos elegidas descarta el PDF ya generado y vuelve a mostrar "Generar PDF".

   *Por qué 2 pasos:* Safari iOS solo permite abrir el menú de compartir (y descargas) dentro de un
   toque reciente del usuario; si el toque dispara primero varios segundos de descarga de fotos, iOS
   bloquea `navigator.share`. Generando antes, Descargar/Compartir se ejecutan al instante.

## Contenido de los PDFs

Formato A4 vertical, jsPDF, fuente Helvetica (soporta tildes y ñ).

### Encabezado común

- `logo-icon.png` (la carita del logo; no existe versión limpia del logo completo con texto).
- Línea principal: `Lote {numero} · {DD/MM/YYYY}` (fecha de generación).
- Subtítulo según el contenido: **"Pantalones y shorts"** (confección) o **"Polos"** (estampado).
- Total de prendas incluidas.

### PDF de confección ("Pantalones y shorts")

- **Pieza**: "Manga corta + short" → **Short**; "Manga corta + pantalón" y "Manga larga + pantalón"
  → **Pantalón**.
- **Resumen de totales** arriba: agrupado por pieza + talla + color, ej. `Pantalón · M · A04: 2`.
  Ordenado por pieza, luego talla (orden `12, 14, XS, S, M, L, XL, XXL`; valores desconocidos al
  final en orden alfabético), luego código de color.
- **Detalle** debajo: una fila por pijama con número de pedido (`N-L#`), pieza, talla, código de
  color y miniatura del patrón (buscada por `nombre` **y** `tipo_mascota`; si es "Sin patrón" o no se
  encuentra, se muestra el texto sin miniatura).
  - **Ajuste 2026-09-12 (feedback del usuario tras probarlo):** cada fila del detalle se pinta de
    fondo con el color real del pantalón (rectángulo redondeado con borde fino, para que tonos casi
    blancos se distingan del papel), porque el confeccionista reconoce la tela por el color y el
    cuadradito original era muy chico. Texto blanco si el fondo es oscuro (luminancia < 150), oscuro si
    es claro. La miniatura del patrón va sobre un cuadradito blanco para que se vea sobre fondos
    oscuros. Código fuera de `PANTONERA`: fila blanca. **El resumen de totales NO cambia** (sigue con
    cuadradito), decisión explícita del usuario.

### PDF de estampado ("Polos")

- Una fila por pijama con número de pedido (`N-L#`), talla, **corte** ("Clásico"/"Princesa") o
  **"Manga larga"** para la variante manga larga, y las **fotos elegidas** en el modal, en miniatura
  lado a lado (saltando de línea si no entran).
- Pijamas sin fotos (o sin ninguna foto marcada) aparecen igual, con un recuadro "sin foto" en lugar
  de las imágenes — nunca se omiten en silencio.
- Nada más: sin color, patrón, observaciones ni datos del cliente.

### Orden de filas (ambos PDFs)

Por `numero_pedido` ascendente; dentro de un mismo pedido, por `items_pedido.orden` (nulls al final).

### Nombre del archivo

- `Lote{numero}-pantalones-{YYYY-MM-DD}.pdf`
- `Lote{numero}-polos-{YYYY-MM-DD}.pdf`

## Funcionamiento interno

### Datos

Consulta con la sesión existente (`sb`):

- `pedidos`: `id, numero_pedido, estado` filtrado por `lote_id` y `estado IN (estados marcados)`.
- `items_pedido`: `pedido_id, tipo_producto, variante, talla, corte, color, patron, tipo_mascota,
  fotos, orden` filtrado por `pedido_id IN (...)` y `tipo_producto = 'pijama'`.
- Patrones desde el array `patterns` ya cargado en memoria; colores vía `buscarColorPorCodigo`;
  número vía `formatNumeroPedido`.

### Preparación de imágenes

- Cada foto se descarga (`fetch` a la URL pública), se dibuja en un `<canvas>` reducida a un máximo
  de ~800 px por lado y se exporta como JPEG (calidad ~0.75) antes de `addImage`. Objetivo: que el PDF
  sea liviano para mandarlo por WhatsApp.
- Patrones (PNG transparente) y logo se dibujan sobre fondo blanco antes de exportar.
- Si una imagen falla (red, formato no decodificable como HEIC en navegadores que no lo soportan), se
  dibuja un recuadro gris con el texto "foto no disponible" y el PDF se genera igual. Errores al
  `console.error`, sin cortar la generación.
- Las imágenes se procesan de forma secuencial para no saturar la memoria de Safari iOS.

### Estructura del código

Funciones separadas por responsabilidad (todas en `index.html`):

- **Obtener datos**: dado lote + estados, devuelve la lista de pijamas ya ordenada con sus campos.
- **Preparar imagen**: URL → `{ dataUrl, ancho, alto }` reducida, o `null` si falla.
- **Construir PDF de confección** y **construir PDF de estampado**: reciben datos ya listos (y, para
  estampado, las fotos elegidas) y devuelven un `Blob` PDF. No consultan Supabase ni el DOM, para
  poder probarlos solos.
- **Modal**: render de filtros, lista de fotos elegibles (solo estampado), y acciones
  Descargar/Compartir.

jsPDF se carga desde `cdnjs.cloudflare.com` con versión fija, solo en `index.html`.

### Descargar y Compartir

- **Descargar**: `URL.createObjectURL(blob)` + `<a download>` con el nombre de archivo definido.
- **Compartir**: `new File([blob], nombre, { type: 'application/pdf' })`; si
  `navigator.canShare({ files: [file] })` es verdadero se muestra el botón y llama a
  `navigator.share({ files: [file] })`. Si no está soportado (ej. Chrome en Windows), el botón no se
  muestra. Cancelar el menú de compartir (`AbortError`) no muestra error.

### Casos borde

- Sin pijamas para el lote/estados elegidos: mensaje en el modal "No hay pijamas con esos filtros"
  (texto fijo, no toast — cambia con cada filtro), "Generar PDF" deshabilitado.
- Mientras se genera: botón en estado "Generando…" y deshabilitado (evita doble toque). Si el filtro o
  las fotos cambian mientras se genera, ese resultado se descarta.
- Estados sin ningún checkbox marcado: mensaje "Marca al menos un estado", "Generar PDF" deshabilitado.

## Pruebas

- **Aisladas**: las funciones que construyen los PDFs se prueban localmente con datos de ejemplo que
  usan fotos e imágenes de patrones reales de Storage (URLs públicas), revisando visualmente el PDF
  generado (confección con resumen + detalle, estampado con 1 foto, varias fotos, sin foto, manga
  larga, color fuera de `PANTONERA`, "Sin patrón").
- **En la app real**: requiere sesión iniciada; la verificación final la hace el usuario en el iPhone
  (descargar, compartir a WhatsApp, revisar que se vea bien). Se verifica además con `curl` que el
  deploy de Vercel sirve el `index.html` nuevo.
- No se crean datos de prueba en Supabase para esta funcionalidad (es solo lectura).

## Fuera de alcance

- Guardar la elección de fotos o los filtros.
- Polos y tote bags vendidos sueltos, tote bag de regalo, mantas.
- Datos del cliente, precios u observaciones en los PDFs.
- Logo completo con texto "PELUDOS FACTORY" (no existe archivo limpio).
