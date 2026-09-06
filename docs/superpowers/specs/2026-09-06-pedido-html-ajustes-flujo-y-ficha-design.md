# Ajustes al flujo de pedido.html: campos que se pintan, "Tus datos" colapsable y miniatura de patrón

**Fecha**: 2026-09-06
**Estado**: Aprobado, pendiente de plan de implementación

## Contexto

Tras usar en producción el Grupo 2 ("Tarjetas colapsables y mini-preview en vivo",
`2026-09-06-pedido-html-tarjetas-colapsables-design.md`), el usuario encontró un problema real de
diseño y pidió 2 mejoras adicionales:

1. **El mini-preview en vivo (idea 8 del Grupo 2) no cumple su función**: vive fijo justo debajo del
   encabezado "Producto N", así que mientras el cliente baja llenando Talla/Color/Patrón/Fotos, el
   mini-preview queda fuera de la pantalla — nunca lo ve actualizarse. Esta spec **reemplaza** esa parte
   del Grupo 2 (no la mantiene en paralelo).
2. Extender el mismo patrón de tarjetas colapsables a la tarjeta "Tus datos", para que el formulario se
   sienta paso a paso desde el inicio, no solo entre productos.
3. Bug encontrado al usar el Grupo 1 en producción: la ficha de resumen (revisión antes de enviar, y la
   de éxito) muestra el patrón elegido como texto plano — como en Supabase los patrones se llaman "1",
   "2", "3"... (no hay nombres descriptivos), el cliente ve un chip que solo dice un número, sin ninguna
   forma de reconocer qué patrón es.

## Cambio 1: Reemplazar el mini-preview por campos que se marcan en verde al completarse

Se elimina el contenedor `${id}_resumen_preview` y las llamadas a `actualizarResumenProducto` desde los
handlers de campo (`onTipoProductoChange`, `updatePrice`, `selectTalla`, `selectColorFamilia`,
`selectColorTono`, `selectPattern`, `renderImagePreviews`). `renderResumenProducto` **se mantiene** — el
resumen colapsado de una tarjeta completa (foto + tipo/modelo + chips + precio) sigue funcionando igual,
solo deja de mostrarse también mientras la tarjeta está abierta.

En su lugar, cada campo obligatorio se marca visualmente apenas queda completo:

- Un check verde (✓, el mismo `--success` que ya usa el ícono de la pantalla de éxito) junto a la
  etiqueta del campo.
- Un borde verde a la izquierda de esa sección de la tarjeta.

Aplica exactamente a los mismos campos que ya son obligatorios (Tipo, Modelo, y luego Talla/Color/
Patrón/Fotos según el tipo de producto — la misma lista de `CAMPOS_REQUERIDOS_POR_TIPO` del Grupo 1).
Como la marca vive en el campo mismo (no en un resumen aparte), sigue siendo visible sin importar cuánto
haya bajado el cliente en la tarjeta — resuelve el problema de raíz del punto 1 de arriba.

## Cambio 2: "Tus datos" colapsable, con botón "Continuar" explícito

Al cargar el formulario, solo se muestra la tarjeta "Tus datos" (canal, nombre, contacto) con un botón
**"Continuar"** — el resto (tarjetas de producto, botón de agregar otro, total, banner de plazo, botón
de enviar) **no existe todavía en la pantalla**, no es solo estar oculto.

Al tocar "Continuar":
- Si nombre o contacto están vacíos, se muestra el mismo error de siempre, sin avanzar.
- Si están completos, "Tus datos" se colapsa a una línea resumen (mismo patrón visual que una tarjeta de
  producto colapsada — texto tipo "María — WhatsApp — 987654321"), y recién ahí aparece el resto del
  formulario, con el Producto 1 ya desplegado.

Se eligió un botón explícito (no auto-avanzar al completar los campos) para mantener el mismo lenguaje
de interacción que ya usa "Agregar otro producto" — el cliente decide cuándo avanzar, nunca es
automático ni brusco.

Tocar la tarjeta "Tus datos" ya colapsada la vuelve a abrir para editar — el resto del formulario
(productos ya armados) **no se oculta** al reabrirla, coherente con que reabrir un producto tampoco
afecta a los demás.

## Cambio 3: Miniatura del patrón en la ficha de resumen

`renderFichaResumen` (usada tanto en la pantalla de revisión como en la de éxito) hoy solo muestra
`item.patron` como texto. Se agrega la miniatura real del patrón al chip, buscándola en el array
`patterns` ya cargado — **filtrando también por especie de mascota** (`tipo_mascota` del producto), para
no repetir el mismo cruce perro/gato que ya se corrigió en `index.html` (los nombres de patrón, siendo
solo números, se repiten igual en ambas especies).

Esto requiere agregar `tipo_mascota` a los objetos que arman ambas fichas (`construirResumenPreview` y
el `itemsResumen` de `confirmarYEnviarPedido`) — hoy ese dato se guarda correctamente en la base de
datos pero no viaja hasta la ficha. Si el patrón elegido es "Sin patrón" (opción agregada en el Grupo 1),
el chip muestra ese texto tal cual, sin miniatura — no hay imagen que buscar.

## Fuera de alcance

- No se renombran los patrones en Supabase (siguen siendo "1", "2", "3"...) — esta spec solo agrega la
  miniatura visual, no un nombre descriptivo.
- No se agrega ningún mecanismo de auto-avance — "Continuar" y "Agregar otro producto" siguen siendo
  siempre acciones explícitas del cliente.
- No se toca `index.html` ni ninguna tabla/columna de Supabase.
- No se vuelve a intentar el mini-preview en vivo de ninguna forma — se reemplaza por completo por el
  Cambio 1.

## Verificación manual antes de dar por terminado

- Cargar `pedido.html`: debe verse únicamente la tarjeta "Tus datos" con el botón "Continuar" — sin
  ninguna tarjeta de producto, botón de agregar, total ni botón de enviar visibles todavía.
- Tocar "Continuar" sin llenar nombre/contacto: debe fallar con el error de siempre, sin colapsar nada.
- Completar nombre y contacto, tocar "Continuar": "Tus datos" se colapsa a una línea resumen, y aparece
  el resto del formulario con el Producto 1 ya desplegado.
- Tocar la tarjeta "Tus datos" colapsada: debe reabrirse con los valores intactos, sin afectar los
  productos ya armados.
- Llenar un producto Pijama paso a paso (tipo, modelo, talla, color, patrón, foto): cada campo debe
  ponerse verde (check + borde) apenas se completa, y debe seguir viéndose verde aunque el cliente haya
  bajado varias secciones más abajo en la tarjeta.
- Pasar por la pantalla de revisión con un producto que tenga un patrón real elegido (no "Sin patrón"):
  el chip de patrón debe mostrar la miniatura real de esa imagen, no solo el número. Probar también con
  "Sin patrón" elegido: el chip debe decir "Sin patrón" sin miniatura, sin error.
- Confirmar que un patrón de perro y uno de gato con el mismo número (ej. ambos "2") muestran cada uno
  su miniatura correcta, no la del otro.
