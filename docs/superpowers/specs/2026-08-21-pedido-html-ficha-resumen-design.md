# Ficha visual de resumen en pedido.html (reemplaza el PDF)

**Fecha**: 2026-08-21
**Estado**: Aprobado, pendiente de plan de implementación

## Contexto

En la pantalla de éxito de `pedido.html` (`mostrarExito()`), hoy el único lugar donde el cliente ve el
detalle completo de lo que acaba de pedir es un PDF (`descargarPDF()`), que se dispara como efecto
secundario de tocar el botón de contacto (WhatsApp o Instagram). La pantalla de éxito en sí no muestra
ningún resumen — solo el ícono de check, el código de pedido, el mensaje de éxito, la caja de pago
destacado y el banner de plazo de producción.

Esto genera un problema real: el cliente toca "Escribir por WhatsApp", se descarga el PDF (en iOS Safari
va a la app Archivos, no es obvio dónde quedó) y se abre WhatsApp en pestaña nueva. Si vuelve a la pestaña
de `pedido.html`, no hay ningún resumen visible de lo que pidió — el PDF era la única fuente de verdad, y
es fácil perderlo de vista.

Se evaluó reemplazarlo por una imagen compartible directamente a WhatsApp/Instagram vía Web Share API,
pero se descartó por decisión explícita del usuario: el link `wa.me` no admite adjuntar archivos (solo
texto + número fijo), y Web Share API no permite fijar el chat destino — el cliente tendría que elegirlo
él mismo dentro de la app. Se prefirió mantener el botón de contacto exactamente como funciona hoy
(garantiza llegar al chat correcto) y resolver el problema de raíz: mostrar el resumen directamente en
pantalla, de forma persistente, en vez de depender de un archivo descargado.

## Objetivo

Reemplazar el PDF por una ficha visual HTML, siempre visible en la pantalla de éxito, con el mismo
lenguaje visual que ya usa el resto de la app (fotos reales + chips), y sugerirle al cliente tomar una
captura de pantalla si quiere guardar o compartir su resumen manualmente.

## Qué se elimina

- La función `descargarPDF()` completa.
- Sus helpers usados solo por el PDF: `fetchImagenComoDataUrl()`, `hexToRgb()`,
  `buscarColorPorCodigoPDF()` (este último se reemplaza por una versión genérica reutilizada por la
  ficha, ver siguiente sección — no se elimina la lógica de búsqueda en `PANTONERA`, solo deja de ser
  específica del PDF).
- El `<script src=".../jspdf.umd.min.js">` en el `<head>` — no se usa nada más de esa librería en el
  archivo.
- Las llamadas `onclick="descargarPDF()"` (botón de WhatsApp) y `await descargarPDF()` (dentro de
  `copiarMensajeYAbrirInstagram()`) — el resto de esas dos funciones queda igual, solo se les quita el
  disparo del PDF.

## Qué se agrega: `renderFichaResumen(resumen)`

Nueva función que arma el HTML de la ficha a partir de `ultimoResumenPedido` (ya tiene todo el dato
necesario en memoria — `items` con tipo_producto, variante, talla, corte, color, patron, fotos, precio,
más `codigo`, `canal`, `total`; no hace falta ninguna consulta nueva a Supabase).

Por cada producto en `resumen.items`, una tarjeta con el mismo lenguaje visual que ya usan las tarjetas
de producto del resto de la app (foto + chips), reutilizando clases/estilos ya existentes en
`pedido.html` donde aplique en vez de crear un sistema visual nuevo:

- **Foto(s)** del producto: `<img src="fotoUrl">` directo a la URL pública de Storage. A diferencia del
  PDF (que necesitaba `fetch()` + conversión a base64 porque `jsPDF.addImage()` lo requiere), acá basta
  el `src` directo — simplificación real, no solo estética. Si no hay foto, se omite (sin placeholder
  especial; a diferencia del index.html interno, el cliente sabe si subió o no fotos).
- **Tipo — variante** en texto (ej. "Pijama — Manga corta + short").
- **Chips condicionales** (solo si el campo tiene valor, mismo criterio que el resto de la app):
  - Talla
  - Corte ("Clásico"/"Princesa")
  - Color: cuadradito con el color real (resuelto vía `buscarColorPorCodigo(item.color)`, la función
    renombrada de `buscarColorPorCodigoPDF`) + código corto. Si el código no está en `PANTONERA`, se
    muestra el texto tal cual sin cuadradito — mismo criterio de "gracia" ya usado en el resto de la app.
  - Patrón: nombre del patrón (sin miniatura — `pedido.html` no tiene cargado el array completo de
    patrones con sus imágenes en memoria en este punto del flujo, y agregar esa consulta solo para la
    ficha final no se justifica; el nombre en texto ya es información suficiente en este contexto).
- **Precio** del producto, alineado a la derecha.

Debajo de todas las tarjetas: línea de **Total**, en el mismo estilo de acento que ya usa el resto de
`pedido.html` para totales.

## Orden final de la pantalla de éxito (`mostrarExito`)

1. Ícono de check + código de pedido + "¡Tu pedido fue registrado con éxito!" — igual que hoy.
2. **Ficha del resumen** (nueva) — una tarjeta por producto + total.
3. **Texto de sugerencia de captura de pantalla** (nuevo), inmediatamente debajo de la ficha — algo como
   "📸 Guarda esta pantalla — toma una captura si quieres tener tu resumen a la mano". Estilo de texto
   secundario, no un banner con fondo propio (no compite visualmente con la caja de pago destacado).
4. Caja de pago destacado (adelanto 50%) — sin cambios.
5. Banner de plazo de producción — sin cambios.
6. Botón "Escribir por WhatsApp" / "Copiar mensaje y abrir Instagram" — mismo comportamiento de hoy
   (texto pre-armado con el código, mismo número/usuario fijo), solo sin el disparo del PDF.

## Fuera de alcance

- No se toca el formulario de pedido en sí, ni la lógica de guardado (`saveOrder` en `pedido.html`) — la
  ficha solo lee `ultimoResumenPedido`, que ya se arma hoy sin cambios.
- No se agrega ningún mecanismo de compartir vía Web Share API — se descartó explícitamente en el
  brainstorming (ver Contexto). El único mecanismo de guardar/compartir la ficha es la captura de
  pantalla manual del cliente.
- No cambia el comportamiento del botón de WhatsApp/Instagram más allá de quitarle el disparo del PDF —
  mismo mensaje pre-armado, mismo número/usuario, mismo flujo de 1 paso (WhatsApp) o 3 pasos (Instagram:
  copiar mensaje + abrir Instagram, ya sin el paso de generar PDF de por medio).
- No se toca `index.html` (app interna) ni la cola de revisión "Por Confirmar" — este cambio es 100%
  dentro de `pedido.html`.
- No se elimina ni modifica ninguna tabla ni columna de Supabase — no hace falta SQL para este cambio.

## Verificación manual antes de dar por terminado

- Probar un pedido con 1 solo producto y un pedido con 2+ productos.
- Probar un producto con foto y uno sin foto.
- Probar un producto con color en `PANTONERA` (cuadradito visible) y, si hay forma de simularlo, un
  código de color que no exista (debe caer con gracia, sin cuadradito ni error).
- Probar los dos canales: WhatsApp (botón único) e Instagram (copiar mensaje + abrir Instagram) —
  confirmar que ya no se dispara ninguna descarga de PDF en ningún caso.
- Probar en viewport móvil real o emulado (iPhone/Safari) — la ficha con fotos no debe romper el layout
  ni obligar a scroll horizontal.
- Confirmar visualmente que, tras tocar el botón de contacto y volver a la pestaña de `pedido.html`, la
  ficha del resumen sigue estando visible igual que antes de tocarlo (el problema original que motivó
  este cambio).
