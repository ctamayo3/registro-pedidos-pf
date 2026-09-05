# Correcciones: ocultar mantas, renombrar color y arreglar numeración de pedidos

**Fecha**: 2026-09-04
**Estado**: Aprobado, pendiente de plan de implementación

## Contexto

Tres correcciones pedidas por el usuario tras revisar el sistema en uso real, sin relación entre sí más
allá de ser ajustes chicos/medianos pedidos en la misma sesión:

1. Por el momento no van a vender mantas — hay que ocultar esa opción del formulario público para que
   los clientes no puedan pedirla, sin quitarle la posibilidad a Cesar/Mariana de registrar una
   manualmente si un cliente insiste por chat.
2. Clientes han escrito pidiendo "color negro" sin darse cuenta de que existe dentro de la familia
   "Gris" de la pantonera — con renombrar la familia alcanza, sin tocar los códigos de color reales.
3. **Bug real de numeración de pedidos**, encontrado y confirmado con evidencia directa en producción
   durante esta sesión (ver investigación abajo).

## Investigación del bug de numeración (ya completada, con evidencia)

Dos pedidos del mismo lote (`d23218e2-6596-4c4c-a1b0-99775c1ac0fe`) quedaron con el mismo
`numero_pedido = 39`:

| id | numero_pedido | origen | created_at |
|---|---|---|---|
| `fc6c86e3-...` | 39 | interno | 2026-09-04 09:04:36 |
| `d27df46f-...` | 39 | web | 2026-09-04 16:31:01 |

**No es una condición de carrera** (se crearon con 7 horas de diferencia) — es un choque estructural
garantizado entre dos sistemas de numeración distintos que escriben en la misma columna:

- **Pedidos manuales** (`index.html`, `obtenerSiguienteNumeroPedido()`): calculan
  `MAX(numero_pedido) WHERE lote_id = X` + 1 en el navegador, antes de insertar.
- **Pedidos web** (`pedido.html`): nunca envían `numero_pedido` en el insert. La columna tiene
  `DEFAULT nextval('pedidos_numero_pedido_seq')` — una secuencia de Postgres **global**, que sube para
  siempre sin enterarse de en qué lote cae el pedido. Confirmado con
  `information_schema.columns` y con el código completo de `preparar_pedido_web()` (el trigger
  `BEFORE INSERT` que sí corre para pedidos web, pero que solo pone `lote_id`, `codigo_pedido`,
  `estado`, `monto_pagado`, `estado_pago` — nunca toca `numero_pedido`).

Como el contador manual se reinicia bajo en cada lote y el contador web sube sin parar en todo el
historial, es cuestión de tiempo que ambos coincidan en el mismo número dentro de un mismo lote — no
hace falta que se creen al mismo tiempo.

## Cambio 1: Ocultar Manta en `pedido.html`

- Quitar el `<option>` de "manta" (o el texto equivalente) del `<select>` de "Tipo de producto" en
  `pedido.html`.
- **`index.html` no cambia** — Manta sigue disponible ahí para registro manual.
- No se toca `catalogo_productos` ni sus columnas `activo` — es un cambio puramente de qué opciones
  ofrece el `<select>` del formulario público, no de qué existe en el catálogo.
- Si ya existen pedidos con `tipo_producto = 'manta'` (de antes de este cambio), siguen viéndose y
  editándose normal en `index.html` — este cambio no afecta datos existentes.

## Cambio 2: Renombrar la familia de color "Gris" → "Negro/Grises"

- En la constante `PANTONERA` (duplicada en `pedido.html` e `index.html`), cambiar
  `G: { nombre: "Gris", ... }` a `G: { nombre: "Negro/Grises", ... }` en ambos archivos.
- Los 10 códigos de color de esa familia (`G01`...`G10`) y sus valores hex **no cambian** — solo el
  nombre visible de la familia. Ningún pedido existente se ve afectado (el campo `color` guarda el
  código corto, ej. `"G01"`, no el nombre de la familia).

## Cambio 3: Arreglo de fondo de la numeración + formato de visualización "N-L#"

### Arreglo de fondo (SQL, a correr en el SQL Editor de Supabase)

Se modifica `preparar_pedido_web()` para que, sin importar el origen del pedido (`web` o `interno`),
calcule `numero_pedido` de la misma forma seguro para ambos: `MAX(numero_pedido) de ese lote_id` + 1,
protegido con un `SELECT ... FOR UPDATE` sobre la fila del lote para que dos inserts al mismo lote
—aunque sean simultáneos— no puedan calcular el mismo valor. Se quita el `DEFAULT` de secuencia global
de la columna `numero_pedido` (ya no se necesita, y es la causa raíz del choque).

En `index.html`, se elimina la función `obtenerSiguienteNumeroPedido()` y la línea que la llama al
guardar un pedido nuevo (`pedidoData.numero_pedido = await obtenerSiguienteNumeroPedido(...)`) — el
número ya no se calcula nunca en el navegador, lo asigna el trigger siempre, para los dos canales por
igual.

**Los pedidos ya existentes NO se tocan** — ningún `numero_pedido` ya guardado cambia. Este arreglo solo
afecta a los pedidos que se creen de aquí en adelante. El choque ya ocurrido entre los dos pedidos con
`numero_pedido = 39` queda tal cual en el historial (no se renumera retroactivamente).

### Formato de visualización "N-L#"

En todos los lugares de `index.html` donde hoy se muestra `numero_pedido` solo (ej. `#39`), pasa a
mostrarse `39-L{numero del lote}` — usando el campo `lotes.numero` (ya existente, ver `CLAUDE.md`) del
lote al que pertenece ese pedido. Confirmado por grep que estos son los únicos 4 lugares donde
`index.html` muestra `numero_pedido` (el Dashboard no lo muestra en ningún lado — su sección de Alertas
solo muestra cliente, estado, fecha de entrega y saldo, sin número de pedido):

- Tablero de "Lote Activo" (`order-num-badge`, `index.html:3858`)
- Buscar Pedidos (columna de número, `index.html:3974`)
- Modal de resumen del pedido (`verResumenPedido`, título del modal, `index.html:4070`)
- Título del formulario al editar (`form-title`, `index.html:4152`)

Esto es puramente de visualización — no reemplaza ni migra ningún dato, `numero_pedido` y `lotes.numero`
ya existen tal cual; solo se combinan al mostrarse. No aplica a `pedido.html` (el cliente nunca ve
`numero_pedido`, solo su `codigo_pedido` tipo `PF-YYMM-NNN`, que no cambia).

## Fuera de alcance

- No se renumeran pedidos existentes ni se corrige retroactivamente el choque ya ocurrido entre los dos
  pedidos con `numero_pedido = 39` — quedan en el historial tal cual, distinguibles ahora por el lote
  que se les agregue en la visualización.
- No se toca `codigo_pedido` (`PF-YYMM-NNN`) ni la secuencia `pedido_codigo_seq` que lo genera — esa ya
  es atómica y correcta, no tiene el bug.
- No se elimina la tabla ni las variantes de manta de `catalogo_productos` — solo se oculta la opción en
  el formulario público. `index.html` la mantiene disponible.
- No se cambian los 10 códigos ni valores hex de la familia de color renombrada, solo su nombre visible.

## Verificación manual antes de dar por terminado

- `pedido.html`: confirmar que "Manta" ya no aparece en el selector de tipo de producto, y que el resto
  de tipos (Pijama, Polo, Tote bag) siguen funcionando igual.
- `index.html`: confirmar que Manta sigue disponible al crear/editar un pedido manual.
- Selector de color en ambos formularios: confirmar que la familia ahora dice "Negro/Grises" y que los
  10 tonos y sus códigos (`G01`...`G10`) siguen siendo los mismos de antes.
- Crear dos pedidos de prueba en el mismo lote — uno manual y uno simulando el flujo web (o ambos
  manuales, para simular el peor caso) — y confirmar que **nunca** se repite `numero_pedido` dentro de
  ese lote. Confirmar también que el número asignado sigue siendo consecutivo dentro del lote (no salta
  a un valor gigante heredado de la secuencia global vieja).
- Confirmar que el nuevo formato `N-L#` se ve correcto en Dashboard, Lote Activo, Buscar y el resumen del
  pedido, con datos reales (no solo los de prueba).
- Borrar los pedidos de prueba creados para esta verificación al terminar.
