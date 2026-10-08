# Peludos Factory — Registro de Pedidos

App interna (con login desde 2026-08-18, ver Progreso) para reemplazar una
hoja de Google Sheets donde se registran pedidos personalizados de mascotas
(pijamas, mantas, polos, tote bags). La usan 2 personas: **Cesar** (dueño,
cesartamayo660@gmail.com) y **Mariana**. Cesar tiene iPhone (iOS 26.5.2
confirmado) — cualquier feature que dependa de comportamiento de
navegador/PWA hay que pensarla para Safari iOS primero, no asumir
Chrome/Android.

Desde 2026-08-18 existe un **canal adicional de registro**: un formulario
público (`pedido.html`) donde el cliente arma su propio pedido paso a paso
(datos → productos, con validación y una pantalla de revisión antes de
enviar) y termina con un botón de contacto (WhatsApp/Instagram) — proyecto
original completo en 4 fases (esquema/seguridad/login, `pedido.html`, cola
de revisión "Por Confirmar" en `index.html`, contacto WhatsApp/Instagram),
**más una ronda grande de correcciones y mejoras de UX en 2026-09**
(reemplazo del PDF por una ficha visual, arreglo de fondo de la numeración
de pedidos, y rediseño del flujo del formulario — ver "Formulario público
de auto-registro" abajo y Progreso para el detalle). Ver spec original en
`docs/superpowers/specs/2026-08-18-formulario-publico-design.md` y los 4
planes en `docs/superpowers/plans/2026-08-18-formulario-publico-*` — ojo,
varios de esos planes describen el PDF, que **ya no existe** (ver Progreso
2026-08-21 en adelante para la versión vigente). El formulario interno
(`index.html`) sigue siendo el canal principal, sin cambios de
comportamiento salvo el login y la vista nueva "Por Confirmar".

**Login de la app interna** (agregado 2026-08-18): `index.html` ahora
requiere iniciar sesión (Supabase Auth, email + contraseña) — 2 cuentas
fijas (Cesar y Mariana), creadas a mano desde el dashboard de Supabase
(Authentication → Users), sin registro público ni recuperación de
contraseña self-service. Se agregó porque RLS no puede distinguir
"`index.html` pidiendo datos" de "`pedido.html` pidiendo datos" sin un rol
`authenticated` real — la separación de archivos por sí sola no alcanza
para bloquear tablas sensibles (`recetas_materiales`, costos, `lotes`,
etc.) a nivel de base de datos. Sesión persistida vía `localStorage` (no
pide login cada vez que se abre la PWA). `pedido.html` sigue siendo 100%
anónimo para el cliente público — el login es solo para la app interna.

## Stack

- **Frontend interno**: un solo archivo [`index.html`](index.html) — HTML + CSS + JavaScript vanilla (sin frameworks, sin build step). Requiere login (ver sección de arriba). **Usa jsPDF 2.5.1** (cdnjs, desde 2026-09-12) solo para los PDFs de producción — ver "PDFs de producción" más abajo. No confundir con `pedido.html`, que ya no usa jsPDF.
- **Formulario público**: [`pedido.html`](pedido.html) — archivo 100% independiente, sin login, para que el cliente arme su propio pedido. No importa ni referencia nada de `index.html`/dashboard/costos. **Desde 2026-10-07 es la versión nueva** (reescrita desde cero, ver "Formulario público — versión vigente" más abajo). La versión anterior quedó como respaldo funcional en [`pedido-anterior.html`](pedido-anterior.html) (`noindex`); `pedido-v2.html` es solo una redirección a `pedido.html` (fue el enlace de prueba). No usa jsPDF.
- **Service worker**: [`sw.js`](sw.js) (raíz del repo) — recibe y muestra las notificaciones push. Ver sección "Notificaciones push" abajo.
- **PWA**: [`manifest.json`](manifest.json) + [`logo-icon.png`](logo-icon.png) (ícono/favicon/apple-touch-icon). La app es instalable ("Agregar a pantalla de inicio" en iOS = su único mecanismo de "instalación", no hay App Store).
- **Base de datos**: Supabase (Postgres) vía `@supabase/supabase-js@2` desde CDN (`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2`).
- **Backend serverless**: 1 Supabase Edge Function (`send-push`) para las notificaciones push — código de referencia en [`supabase-functions/send-push/index.ts`](supabase-functions/send-push/index.ts), pero el deploy real vive en el dashboard de Supabase, **no se despliega vía git/Vercel**. Si se edita ese archivo en el repo hay que volver a pegarlo manualmente en el dashboard (Edge Functions → send-push → Code).
- **Repositorio**: GitHub — https://github.com/ctamayo3/registro-pedidos-pf
- **Deploy**: Vercel — https://registro-pedidos-pf.vercel.app/ (auto-deploy en cada push a `main`). Solo cubre el frontend estático; la Edge Function y los triggers/cron de Supabase son independientes del deploy de Vercel.
- Generado originalmente con Antigravity, ahora mantenido directo con Claude Code.

## Credenciales Supabase (ya están en el HTML, es un frontend público)

```
SUPABASE_URL = 'https://zafgoegngcqsswzzxcen.supabase.co'
SUPABASE_KEY = 'sb_publishable_xmTh0DSBcGFF_0ZBb2ePcQ_Ktv8gKUB'
```

**RLS activado en todas las tablas desde 2026-08-18** (antes estaba desactivado
por completo — ver Progreso). Política general: `anon` solo puede `INSERT` en
`pedidos`/`items_pedido` (lo que necesita `pedido.html`) y `SELECT` en
`catalogo_productos`/`patrones` (precios y patrones visibles en el formulario
público); todo lo demás — incluido `SELECT` en `pedidos`/`items_pedido` — está
bloqueado para `anon`. El rol `authenticated` (Cesar/Mariana logueados en
`index.html`, ver login arriba) tiene acceso completo a todas las tablas,
igual que la app tenía antes de activar RLS. Bucket de Storage:
`fotos-pedidos` (`INSERT` público para subir fotos, **listado bloqueado**
para `anon` desde 2026-08-18 — antes cualquiera podía listar el bucket
completo con la key pública; `authenticated` mantiene acceso total) — se usa
tanto para fotos de pedidos como para imágenes de patrones (prefijo
`patrones/`).

**VAPID keys (notificaciones push)** — la pública ya está en `index.html`
(`VAPID_PUBLIC_KEY`, es segura de exponer). La **privada NO está en el
repo** — vive únicamente como secreto `VAPID_PRIVATE_KEY` en la Edge
Function `send-push` del dashboard de Supabase. Si algún día hay que
regenerarlas: `npx web-push generate-vapid-keys`, actualizar la constante
`VAPID_PUBLIC_KEY` en `index.html` y en `supabase-functions/send-push/index.ts`,
y actualizar el secreto en el dashboard — las suscripciones viejas
(`push_subscriptions`) quedarían inválidas y cada celular tendría que volver
a tocar "Activar notificaciones".

**Contraseña de "Reiniciar caja"**: `1243` (hardcodeada en `reiniciarCaja()`
en el JS). Es un freno para toques accidentales, **no seguridad real** — el
código es público como el resto del frontend.

## Esquema de base de datos

- **`lotes`**: `id` (uuid), `numero` (int — ver nota de numeración abajo),
  `fecha_inicio`, `nota`, `activo` (bool). Puede haber **varios lotes
  "vigentes" en la práctica** (lotes paralelos, ver Lógica de negocio) pero
  solo uno tiene `activo = true` a la vez — eso es lo que decide qué lote
  maneja el Dashboard/Kanban por defecto, no impide seguir editando los demás.
- **`pedidos`**: `id`, `numero_pedido` (int, se reinicia por lote — asignado
  siempre por el trigger `preparar_pedido_web`, de forma atómica, para
  CUALQUIER origen desde 2026-09 — ver Gotchas y Progreso, ya no es un
  cálculo del cliente),
  `lote_id` (FK), `canal` ('ig'/'wpp'/'otro'), `cliente_nombre`,
  `cliente_contacto`, `estado` (check: **'Por confirmar'** (nuevo,
  2026-08-18, ver Progreso), 'Pendiente','Diseño enviado','En
  producción','Listo','Entregado'), `precio_total`, `monto_pagado`,
  `saldo_pendiente` (columna GENERADA = precio_total - monto_pagado, no
  escribir directo), `estado_pago` (check: 'Pendiente'/'Pagado'), `urgente`
  (bool), `fecha_pedido`, `fecha_entrega` (nullable — los pedidos del
  formulario público no la traen), `observaciones_generales`, `created_at`,
  `origen` (text, default `'interno'`, check `'interno'`/`'web'` — nuevo
  2026-08-18), `codigo_pedido` (text, único, nullable — nuevo 2026-08-18,
  formato `PF-YYMM-NNN`, solo se llena vía trigger para `origen='web'`, ver
  sección del formulario público). **Al llegar a `estado = 'Entregado'` se
  asume pago
  completo automático** (ver Lógica de negocio) — no es solo un valor más
  del enum, dispara un side-effect.
- **`items_pedido`**: `id`, `pedido_id` (FK, ON DELETE CASCADE), `tipo_producto`,
  `variante`, `talla`, `color`, `patron`, `tipo_mascota` ('perro'/'gato'),
  `corte` ('clasico'/'princesa', solo pijama manga corta — ver abajo),
  `nombre_mascota`, `año_nacimiento_mascota`, `raza_o_frase`, `fotos` (jsonb
  array de URLs), `precio_unitario`, `observaciones`, `costo_estimado`
  (numeric, calculado al guardar vía `recetas_materiales`, null si no hay
  receta para ese producto), `orden` (integer, nullable — agregado
  2026-08-18, ver Progreso). **`color` guarda el código corto de la
  pantonera** (ej. `"A04"`), no el hex ni el nombre — ver "Selector de color
  (pantonera)" abajo. Pedidos viejos pueden tener texto libre ahí (ej.
  "azul oscuro"); eso se maneja con gracia, no se fuerza a migrar.
  **`orden`** guarda la posición del producto dentro del formulario al
  guardar (`saveOrder`, 1, 2, 3...) — se usa para numerar y ordenar las
  tarjetas del tablero (ver "Tablero de Lote Activo" abajo). Pedidos viejos
  (de antes de este campo) tienen `orden = null` y caen al final del orden
  al renderizar; no se migró data vieja retroactivamente.
  **`tipo_short`** (text, nullable, check `'varon'`/`'mujer'` — agregado 2026-10-07): solo para
  pijama "Manga corta + short". `NULL` = no aplica o no definido (pedidos de short anteriores al
  campo, no se migraron). Ver "Short de varón/mujer" en Lógica de negocio.
- **`catalogo_productos`**: `id`, `tipo_producto`, `variante`, `precio`,
  `activo`. Catálogo real (no inventar variantes/precios sin confirmar con el
  usuario):
  - Pijama: "Manga corta + short" (S/95), "Manga corta + pantalón" (S/109),
    "Manga larga + pantalón" (S/119) — **retirada el 2026-10-07** (ya no se vende): quedó con
    `activo = false`, la fila no se borró y los pedidos antiguos la conservan.
  - Manta: "Felpa estándar 160x100cm" (S/60), "Felpa con carnero 160x130cm" (S/90)
    — **por decisión del usuario (2026-09), Manta está oculta del selector
    de tipo de producto en `pedido.html`** (no se venden por el momento); el
    filtro es puramente en el JS del formulario (`.filter(t => t !== 'manta')`
    sobre `typeOptions`), la tabla/fila no se tocó. **`index.html` sigue
    ofreciendo Manta con normalidad** para registro manual si un cliente
    insiste por chat — es "por el momento", no un retiro definitivo.
  - Polo: "Polo de algodón" (S/60) — **sin receta de costos todavía**
  - Tote bag: "Tote bag" (S/45)
- **`patrones`**: `id`, `nombre`, `imagen_url`, `tipo_mascota`
  ('perro'/'gato'/'ambos'), `activo`. Se administran desde la app (sección
  "Patrones"), no hace falta tocar Supabase a mano. Las 14 imágenes actuales
  (6 gato + 8 perro, **no existe "Perro 8"**, el nombre salta de 7 a 9 y así
  es la data real) ya fueron limpiadas: fondo transparente, sin la medallita
  numerada que traían de origen — ver Progreso 2026-08-18. Si se sube un
  patrón nuevo, probablemente venga "crudo" (con fondo) de nuevo — no asumir
  que el proceso de limpieza es automático al subir. **OJO — `nombre` no es
  un nombre descriptivo, es literalmente un número en texto** ("1", "2",
  "3"... hasta "6" en gato y hasta "9" en perro, saltando el 8) — el mismo
  número existe en ambas especies como filas distintas. Cualquier código que
  busque un patrón por `nombre` **debe filtrar también por `tipo_mascota`**,
  si no puede devolver el patrón de la especie equivocada (bug real
  encontrado y corregido en 2026-09 en `index.html`, ver Gotchas).
- **`recetas_materiales`**: `id`, `tipo_producto`, `variante`, `talla_desde`,
  `talla_hasta` (null = aplica a todas las tallas), `insumo`, `cantidad`,
  `unidad` ('metros'/'unidad'), `costo_unitario`. Ver lógica de cálculo abajo.
- **`costos_referencia`**: **YA NO SE USA** — la sección "Costos" que la
  administraba fue eliminada de la app (2026-08-18, a pedido del usuario). La
  tabla puede seguir existiendo en Supabase con datos viejos, pero ningún
  código del frontend la lee ni la escribe. Si el usuario menciona "Costos"
  de nuevo, probablemente se refiera a `gastos_lote` (ver nota de las 3
  tablas de costo, abajo) — confirmar antes de asumir que quiere esa tabla
  vieja de vuelta.
- **`gastos_lote`**: `id`, `lote_id` (FK, ON DELETE CASCADE), `insumo`,
  `monto`, `fecha`, `nota`. Registro de gastos REALES (ej. compras en
  Gamarra), siempre contra el lote activo — sección "Gastos" del menú. Se
  compara contra el costo estimado (suma de `items_pedido.costo_estimado`
  de TODO el lote, sin filtrar por estado) para mostrar la diferencia real
  vs. estimado. **También alimenta el autocompletado de insumo** (ya no usa
  `costos_referencia`, ver abajo) y **dispara una notificación push** al
  insertarse (trigger `trg_notificar_gasto`, ver Notificaciones push).
- **`push_subscriptions`** (nueva, 2026-08-18): `id` (uuid), `endpoint`
  (text, unique), `p256dh` (text), `auth` (text), `created_at`. Una fila por
  celular suscrito a notificaciones (vía `activarNotificaciones()` en el
  sidebar). Sin distinción de "quién es" — una notificación le llega a
  **todos** los celulares suscritos siempre (decisión explícita del
  usuario, no hay lógica de "excluir al que disparó la acción").
- **`caja_ajustes`** (nueva, 2026-08-18): `id` (uuid), `monto` (numeric),
  `fecha` (date), `nota` (text), `created_at`. Se usa solo desde
  "Reiniciar caja" en el Dashboard: cada click inserta una fila con el
  monto que se retiró, y `Deberías tener en banco` se calcula como
  `Cobrado global - Gastado global - SUM(caja_ajustes.monto)`. No borra ni
  toca `pedidos` ni `gastos_lote`, es puramente un ajuste aditivo/histórico.

## Lógica de negocio importante (no obvia leyendo el código)

- **Lote activo vs. lotes paralelos**: solo un lote tiene `activo = true`,
  y eso decide qué lote maneja el Dashboard (`getLoteActivo()`) y el
  tablero grande de "Lote Activo". **Pero los demás lotes NO están
  bloqueados** — se pueden seguir editando/agregando pedidos vía "Lotes
  anteriores" (acordeón, con botón "Activar" para volver a ponerlos como el
  activo) o eligiéndolos directo en el selector "Lote" del formulario de
  pedido (que siempre lista todos, no solo el activo). Esto se aclaró
  explícitamente porque el usuario ya trabaja con 2+ lotes en paralelo.
- **Caja del Dashboard es GLOBAL, no por lote**: "Cobrado", "Gastado real" y
  "Deberías tener en banco" (tarjeta hero) suman **TODOS los lotes que
  existan**, no solo el activo — porque el banco no distingue lotes. Ojo,
  esto es distinto de "Por cobrar" (el número grande de esa misma tarjeta),
  que sí sigue siendo solo del lote activo. No mezclar los dos criterios de
  scope al tocar esa tarjeta.
- **"Reiniciar caja"**: botón en la tarjeta hero, pide contraseña `1243`,
  luego pregunta cuánto se retira (sugiere el total actual como default,
  editable para retiros parciales) e inserta una fila en `caja_ajustes`.
  Ver tabla arriba.
- **Numeración de lotes**: sigue sin usar el `serial` de Postgres — se
  calcula en el cliente como `MAX(numero) actual + 1`
  (`obtenerSiguienteNumeroLote`). Así, si se borran todos los lotes, el
  siguiente vuelve a ser #1.
- **Numeración de pedidos — arreglada de raíz en 2026-09**: `numero_pedido`
  se sigue reiniciando por lote (no es único globalmente — por eso el
  historial de Buscar muestra también la columna Lote), pero **ya no se
  calcula en el navegador**. Hasta 2026-09 convivían dos sistemas de
  numeración distintos escribiendo en la misma columna: los pedidos
  manuales calculaban `MAX(numero_pedido) del lote + 1` en `index.html`
  (`obtenerSiguienteNumeroPedido`, ya eliminada), y los pedidos web dependían
  de un `DEFAULT nextval('pedidos_numero_pedido_seq')` — una secuencia
  global de Postgres que nunca se enteraba de en qué lote caía el pedido.
  Como el contador manual se reinicia bajo en cada lote y la secuencia web
  sube sin parar en todo el historial, tarde o temprano ambos coincidían en
  el mismo número dentro de un mismo lote — confirmado con un caso real en
  producción (dos pedidos con `numero_pedido = 39` en el mismo lote, creados
  con 7 horas de diferencia, no una condición de carrera). El arreglo:
  `preparar_pedido_web` (el trigger `BEFORE INSERT` en `pedidos`, ver
  Gotchas) ahora calcula `numero_pedido` para **cualquier** origen —
  bloqueando la fila del lote (`SELECT ... FOR UPDATE`) mientras calcula
  `MAX(numero_pedido) del lote + 1`, así dos inserts al mismo lote
  (simultáneos o no) nunca pueden calcular el mismo valor — y se le quitó el
  `DEFAULT` de secuencia a la columna (queda huérfana, no se borró). Los
  pedidos ya existentes con números repetidos **no se renumeraron
  retroactivamente**. Para que esto sea fácil de distinguir a simple vista,
  `index.html` ahora muestra el pedido combinado con su lote, formato
  `N-L#` (ej. `39-L5`, vía `formatNumeroPedido(numeroPedido, numeroLote)`)
  en Lote Activo, Lotes anteriores, Buscar Pedidos, el resumen del pedido y
  el título al editar — puramente visual, no cambia ni migra ningún dato.
  `pedido.html` no usa este formato (el cliente nunca ve `numero_pedido`,
  solo su `codigo_pedido`).
- **Campos dinámicos del formulario** (`CAMPOS_POR_TIPO`): qué campos se
  muestran/ocultan según `tipo_producto` (talla, color, patrón, datos de
  mascota). Pijama y manta usan patrón (galería visual filtrada por
  perro/gato) y color (selector de pantonera); polo y tote_bag piden datos
  de mascota en texto y NO muestran color.
- **Corte de polo (clásico/princesa)**: el campo se llama así mismo en la UI
  ("Corte del polo") pero **aplica a Pijama** manga corta, no al producto
  Polo — "polo" se usa aquí en el sentido coloquial peruano (la prenda de
  arriba), confirmado explícitamente con el usuario, no es un bug de copy.
  Solo aplica a pijama "Manga corta + short" y "Manga corta + pantalón"
  (`VARIANTES_CON_CORTE`). Mismo costo para ambos cortes (S/10 tallas S-L,
  S/13 talla XL) — el campo `corte` es puramente para desglosar la lista de
  compras, no afecta el cálculo de costos. Manga larga NO tiene corte.
  **Selector visual** (agregado 2026-08-18, en `index.html` Y `pedido.html`):
  ya no es un `<select>` de texto — es una galería de 2 opciones con la foto
  real de cada corte (`corte-clasico.png`/`corte-princesa.png` en la raíz del
  repo, fondo quitado con IA y compuesto sobre el mismo beige
  `--card-secondary` que usan los placeholders de foto), mismo patrón visual
  que la galería de Patrones (`renderCorteGallery`/`selectCorte`, guardan el
  valor en un `<input type="hidden">` con el mismo id `${id}_corte` de
  siempre — el resto del código que lee ese valor no cambió).
- **Short de varón/mujer** (`items_pedido.tipo_short`, agregado 2026-10-07): aplica **solo** a
  pijama "Manga corta + short" (`VARIANTE_CON_SHORT`, `aplicaTipoShort(tipo, variante)` — definidos en
  ambos archivos porque no comparten código). Mismo precio para ambos (S/95), no toca catálogo ni
  costos. No aplica al pantalón (confirmado con el usuario). En `pedido.html` es **obligatorio y sin
  valor preseleccionado** (chips Varón/Mujer; el problema original era que el cliente elegía short y
  no se sabía cuál confeccionar). En `index.html` es un select opcional que **nunca bloquea
  `saveOrder`**, para poder editar pedidos de short anteriores al campo. Se muestra como chip "Short
  varón"/"Short mujer" en Lote Activo, Por Confirmar, el resumen del pedido y la ficha del cliente; si
  aplica y está vacío, chip de alerta "Short: sin definir" (`renderChipTipoShort`; en Lote Activo no
  se alerta en pedidos `Entregado`). En el PDF "Pantalones y shorts" la pieza sale como "Short
  varón"/"Short mujer"/"Short" (`piezaConfeccion(item)`) y el resumen los cuenta por separado.
- **Variantes descontinuadas al editar** (2026-10-07): `updateVariants` en `index.html` arma el select
  solo con el catálogo activo; si la variante guardada de un producto ya no está ahí (manga larga),
  agrega una opción extra "`<variante>` (descontinuado)" seleccionada, sin precio de catálogo (se
  conserva el precio guardado). Sin esto, editar un pedido antiguo dejaba la variante vacía y
  `saveOrder` lo rechazaba por incompleto. Aplica a cualquier variante que se desactive en el futuro.
- **Selector de color (pantonera)**: constante `PANTONERA` en el JS — 12
  familias (`R` Rojos, `A` Azul, `V` Verde, `O` **Rosa** [ojo: la llave es
  "O" pero los códigos empiezan con "S", ej. `S04` — es así en los datos
  reales del usuario, no un error de tipeo], `L` Lila, `G` Gris, `C`
  Celeste, `M` Marrón, `Y` Amarillo, `J` Anaranjado, `T` Turquesa, `P`
  Pasteles) x 10 tonos cada una = 120 colores, cada uno con `codigo` (ej.
  "A04") y `hex`. En el formulario: select de Familia → habilita select de
  Tono → al elegir tono muestra un cuadradito con el color real + el hex en
  campo de solo lectura + botón de copiar (`copiarColorHex`, mismo patrón
  que `copiarContacto`). Solo se guarda el `codigo` corto en
  `items_pedido.color`; el hex se resuelve al vuelo con
  `buscarColorPorCodigo(codigo)` cada vez que hace falta mostrarlo
  (formulario al editar, resumen del pedido). Si el código guardado no
  existe en `PANTONERA` (pedidos viejos con texto libre), se deja tal cual
  sin forzar selección ni error — `buscarColorPorCodigo` devuelve `null` y
  el form simplemente no preselecciona nada.
- **Tablero de "Lote Activo" — sin columnas por estado**: ya NO es un
  Kanban de columnas Pendiente/Diseño/Producción/Listo (eso se rediseñó
  2026-08-17/18). Ahora es un solo grid de tarjetas, con una leyenda de
  colores arriba (`.estado-legend`) y cada tarjeta muestra un "semáforo" de
  5 cuadraditos (`renderEstadoStepper`, `ESTADOS_ORDEN`, `ESTADO_COLORS`:
  rojo=Pendiente, dorado=Diseño enviado, terracota=En producción,
  verde-claro=Listo, verde=Entregado) — los cuadraditos hasta la etapa
  actual quedan coloreados, el resto en gris. **Cada cuadradito es
  clickeable**: tocarlo manda el pedido directo a esa etapa
  (`cambiarEstado(pedidoId, estadoActual, estadoNuevo)`), saltando etapas
  intermedias si hace falta, sin diálogo de confirmación **excepto** al
  entrar o salir de "Entregado" (ver siguiente punto). Los pedidos activos
  se ordenan por urgente primero y luego por fecha de entrega más próxima
  (ya no hay orden por columnas). "Entregados" sigue siendo una sección
  aparte debajo (sin cambios ahí).
- **Tarjetas — una por producto, no por pedido** (rediseñado 2026-08-18,
  ver spec `docs/superpowers/specs/2026-08-18-lote-cards-redesign-design.md`):
  `renderOrderCard(p)` ya NO aplana los productos de un pedido en una sola
  tarjeta — llama a `renderProductCard(p, item, posicion, total)` una vez
  por cada fila de `items_pedido` (ordenadas por `orden`), así que un
  pedido con 2 pijamas genera 2 tarjetas separadas en el grid, numeradas
  "1/2"/"2/2". Estado, saldo/pagado, cliente y urgente son del PEDIDO
  completo y se repiten idénticos en todas las tarjetas hermanas — tocar el
  semáforo en cualquiera mueve el pedido completo y todas las hermanas se
  actualizan al re-renderizar. Pedidos de un solo producto se ven como una
  tarjeta normal, sin ningún indicador de agrupación. Cada tarjeta muestra:
  foto del producto (72px, la de ESE item, no la primera del pedido, con
  placeholder si no hay), nombre del cliente (tipografía Fraunces) + ícono
  de ojo rojo si ese producto tiene `observaciones` propias (NO refleja
  `observaciones_generales` del pedido, solo se ven abriendo el resumen),
  tipo + variante, chips de Talla/Corte/Color (cuadradito + código
  pantonera, o el texto tal cual si el código no está en `PANTONERA`)/Patrón
  (miniatura real + nombre, buscada en el array `patterns` ya cargado —
  `resolvePatronImagen(nombrePatron, tipoMascota)` **filtra también por
  especie desde 2026-09** — antes buscaba solo por `nombre`, y como los
  nombres de patrón son solo números repetidos entre perro/gato, ambas
  consultas que alimentan estas tarjetas y la de "Por Confirmar" mostraban a
  veces la miniatura de la especie equivocada; ahora las 3 consultas
  (`items_pedido`) traen también `tipo_mascota`, ver Gotchas) — cada chip
  solo aparece si el campo tiene valor — y un footer con
  saldo/pagado + ícono de canal. **Ya no hay botones "Ver"/"Editar" en la
  tarjeta** — toda la tarjeta es táctil (abre el resumen, que tiene su
  propio botón Editar adentro), igual que ya funcionaba con el resto de la
  tarjeta antes.
- **Amarre visual entre tarjetas hermanas**: cuando un pedido tiene 2+
  productos, cada tarjeta lleva una franja de color arriba
  (`.order-card-group-strip`) generada de forma determinística por
  `colorGrupoPedido(pedidoId)` — un hash simple del id del pedido sobre una
  paleta fija de 6 tonos fríos (`GRUPO_COLORES`, ver el JS), elegidos para
  no chocar con los colores semánticos del semáforo (que son todos
  cálidos). El mismo pedido siempre cae en el mismo color mientras no
  cambie su `id`. Junto a la franja va una pastilla "N/M" (posición/total).
- **Al llegar a "Entregado" se asume pago completo automático**: tanto
  `cambiarEstado` como el formulario de edición (al elegir "Entregado" en
  el select de Estado, `marcarPagadoSiEntregado`) sobreescriben
  `monto_pagado = precio_total` y `estado_pago = 'Pagado'`. Pide
  confirmación antes ("¿Confirmas que fue entregado y ya pagó...?"). **Si
  se saca un pedido de "Entregado" hacia otro estado, el monto pagado NO
  se revierte solo** — el diálogo de confirmación lo advierte, pero hay que
  corregirlo a mano en "Editar" si el pago real no era completo.
  Retroactivamente (2026-08-17) se corrigieron los pedidos que ya estaban
  "Entregado" con saldo pendiente, para que la regla aplique parejo.
- **Autocompletado de insumo en "Gastos del Lote"**: ya NO usa
  `costos_referencia` (deprecada, ver Esquema). Las sugerencias
  (`insumosSugeridos`) se arman con los insumos ya usados antes en
  `gastos_lote` (se recalculan al abrir la vista). Es un **dropdown propio
  en JS** (`filtrarSugerenciasInsumo`, `seleccionarSugerenciaInsumo`,
  `ocultarSugerenciasInsumo`), no un `<datalist>` nativo — **Safari de iOS
  no muestra las sugerencias de `<datalist>`** (limitación vieja y conocida
  de WebKit), y Cesar usa iPhone. Si algún día se agrega un autocompletado
  nuevo en cualquier parte de la app, replicar este patrón propio, no usar
  `<datalist>`.
- **Formulario de pedido — comportamiento no obvio**:
  - `formDirty` (variable global) rastrea si el usuario tocó algo de verdad
    (eventos `input`/`change` reales, nunca se activa al precargar el
    formulario vía JS en `crearNuevoPedido`/`editOrder`). Los botones
    "Cancelar" (arriba y abajo) llaman a `cancelarFormPedido()`, que solo
    pide confirmación si `formDirty` es `true`.
  - Quitar un producto (`removeProductItem`) pide confirmación — antes no
    pedía y se perdían fotos/datos sin aviso.
  - Al guardar (`saveOrder`), cada producto debe tener Tipo, Variante y
    Precio > 0, si no el toast dice específicamente cuál "Producto N" está
    incompleto.
  - Botón "Duplicar producto" (`duplicarProductoItem`) copia todos los
    campos de una tarjeta a una nueva, **menos las fotos** (cada mascota
    necesita las suyas).
  - Las tarjetas de producto se numeran solas (`renumerarProductos`, se
    llama tras agregar/quitar/duplicar) y muestran un ícono según el tipo
    elegido (`ICONO_TIPO_PRODUCTO` / `actualizarIconoTipoProducto`).
  - Hay un total flotante (`#floating-total`) mientras se llena el
    formulario, para no bajar hasta el final a cada rato. Se oculta solo
    cuando la barra de totales real ya está en pantalla (`IntersectionObserver`
    vía `setupObservadorTotalFlotante`/`actualizarVisibilidadTotalFlotante`)
    — **importante**: si se toca ese mecanismo, probar en un pedido con
    pocos productos, porque ya hubo un bug real donde el total flotante
    tapaba el botón "Guardar Pedido" en pedidos cortos.
  - Botón de copiar en el campo "Contacto" (`copiarContacto`) — solo ahí,
    no en "Nombre del Cliente" (decisión explícita del usuario).
- **Cálculo de costos** (`calcularCostoProducto`, `tallaEnRango`): busca en
  `recetas_materiales` las filas de ese tipo+variante cuyo rango de talla
  incluya la talla del producto (usando el orden XS < S < M < L < XL < XXL).
  Si no hay ninguna receta para ese tipo+variante → costo `null` ("pendiente de
  definir"), nunca S/0 silencioso.
- **Materiales a comprar / Lista de compras** (Dashboard): agrupa por insumo
  los `items_pedido` de pedidos NO entregados del lote activo. El desglose por
  talla+corte (botón "Ver lista de compras") solo aplica al insumo "Polo
  base" — los demás insumos (tela, confección, impresión, etc.) muestran solo
  el total simple.
- **Numeración de fotos/patrones en Storage**: se suben con prefijo
  `${pedidoId}/` para fotos de pedido, `patrones/` para imágenes de patrones,
  dentro del mismo bucket `fotos-pedidos`.
- **Estructura del Dashboard**: la tarjeta "hero" (saldo por cobrar) ocupa
  todo el ancho (`grid-column: 1 / -1`). En escritorio es un layout flex de
  **3 columnas lado a lado** separadas por `.hero-divider-vertical`:
  `.hero-main` (Por cobrar, número grande), la caja de estado de cuenta
  (`.hero-caja`: Cobrado/Gastado real/Deberías tener en banco + botón
  Reiniciar caja) y el ícono grande a la derecha — esto se rediseñó
  2026-08-17 porque antes la caja se apilaba debajo de "Por cobrar" y hacía
  la tarjeta demasiado alta en pantallas anchas. En móvil se apila normal
  (columna), oculta el divisor vertical. Debajo, "Alertas" y "Materiales a
  Comprar" viven dentro de `.dashboard-lower-grid` (grid de 2 columnas que
  colapsa a 1 en pantallas angostas), no apiladas. La tarjeta de Materiales
  NO repite el desglose insumo por insumo (eso vive solo en el modal "Ver
  lista", vía `verListaCompras()` / `ultimaListaMateriales`) — la tarjeta
  del dashboard muestra únicamente los 3 totales.
- **Estructura del sidebar**: el nav está dividido en dos `<ul class="nav-links">`
  dentro de un `.nav-scroll-wrap` (principal: Dashboard/Lote Activo/Buscar/**Por
  Confirmar** (nuevo, 2026-08-18) — secundaria: Patrones/Gastos — **"Costos" ya
  no existe**, ver Esquema), separados por un `.nav-divider`. Debajo del nav,
  dentro de `.sidebar-bottom` (pegado al fondo vía `margin-top: auto`), están
  "Cerrar sesión" (nuevo, ver Login), "Activar notificaciones"
  (`#btn-notificaciones`, cambia de texto/color cuando ya está activado) y el
  CTA "Nuevo Pedido" — en ese orden. El logo de arriba del sidebar es la
  imagen real de la marca (`logo-icon.png`), ya no el ícono genérico de pata
  (`fa-paw`).
- **Cola de revisión "Por Confirmar"** (agregado 2026-08-18, Fase 3 del
  formulario público): vista nueva (`#revision-view`, `loadRevisionView()`)
  que lista **todos** los pedidos con `estado='Por confirmar'` de **todos los
  lotes** (no solo el activo — un pedido pudo quedar en un lote que ya no es
  el activo). Cada tarjeta (`renderRevisionCard`) reutiliza el mismo lenguaje
  visual del rediseño de "Lote Activo" (foto + chips de talla/color/patrón
  por producto, ícono de canal en círculo) con 3 acciones: **Editar**
  (reutiliza `editOrder()` tal cual), **Confirmar** (`confirmarPedidoWeb`,
  pasa `estado` a `'Pendiente'` — recién ahí el pedido entra a todos los
  cálculos) y **Rechazar** (`rechazarPedidoWeb`, `DELETE` directo,
  irreversible, con confirmación). El select de Estado del formulario interno
  (`#estado`) ahora incluye `"Por confirmar"` como primera opción — necesario
  para que `editOrder()` no lo cambie de estado sin querer al abrir/guardar
  una edición (antes de esto, un valor sin coincidencia en el `<select>`
  quedaría mal representado). `loadDashboard()` y `loadLoteView()` excluyen
  `Por confirmar` de todos sus cálculos/conteos/grid — el Dashboard muestra
  una card de alerta dorada ("N pedidos nuevos por revisar") que lleva
  directo a esta vista cuando hay algo pendiente. **"Buscar Pedidos" NO
  excluye estos pedidos** (decisión explícita — es una herramienta de
  búsqueda histórica, no un cálculo).

## PDFs de producción — confección y estampado (agregado 2026-09-12)

Cesar trabaja con 2 personas externas: un **confeccionista** (arma pantalones/shorts de las pijamas,
ya recibe los cortes y tiene los elásticos) y un **estampador** (estampa la parte de arriba — el polo —
de las pijamas con la cara de la mascota). Tarjeta **"Producción"** en el Dashboard (dentro de
`.dashboard-lower-grid`, después de Materiales) con 2 botones que abren `#produccionModal`
(`abrirModalProduccion('confeccion'|'estampado')`). Spec en
`docs/superpowers/specs/2026-09-12-pdfs-produccion-design.md`, plan en
`docs/superpowers/plans/2026-09-12-pdfs-produccion.md`.

- **Regla clave: ningún PDF dice para quién es** (decisión explícita del usuario). "Confección" /
  "Estampado" son solo etiquetas internas de la app; el PDF dice "Pantalones y shorts" / "Polos" y los
  archivos se llaman `Lote{n}-pantalones-{YYYY-MM-DD}.pdf` / `Lote{n}-polos-{YYYY-MM-DD}.pdf`.
- **Solo pijamas** (las 3 variantes). Polo y Tote bag vendidos sueltos NO entran (se manejan por otro
  lado, confirmado con el usuario), tampoco la tote bag de regalo.
- **Filtros del modal**: lote (default el activo) + checkboxes de estado (default Pendiente, Diseño
  enviado, En producción; `Por confirmar` nunca se ofrece). No se guarda nada, ni filtros ni fotos.
- **Pantalones y shorts**: resumen de totales por pieza + talla + color, y detalle por pijama (número
  `N-L#`, pieza, talla, color con cuadradito, miniatura de patrón filtrada por especie). "Manga corta +
  short" → Short; las otras 2 variantes → Pantalón. **Cada fila del detalle va pintada con el color
  real del pantalón** (ajuste pedido por el usuario tras probarlo — el confeccionista reconoce la tela
  por color y el cuadradito era muy chico): texto blanco en fondos oscuros (`textoContrastePDF`,
  luminancia < 150), borde fino para tonos casi blancos, patrón sobre cuadradito blanco, fila blanca si
  el código no está en `PANTONERA`. **El resumen de arriba mantiene el cuadradito chico** (decisión
  explícita: "solo en el detalle").
- **Polos**: por pijama, número, talla, corte (o "Manga larga") y **las fotos que Cesar elige en el
  modal** (una o varias por pijama, default la primera; se elige cada vez). Sin color/patrón/cliente.
- **Flujo en 2 pasos — no "simplificar" a 1 botón**: "Generar PDF" → recién ahí aparecen "Descargar" y
  "Compartir". Safari iOS solo permite `navigator.share` (y descargas) dentro de un toque reciente; si
  el mismo toque espera varios segundos a que se procesen fotos, iOS bloquea el menú de compartir.
  Cambiar lote/estados/fotos descarta el PDF generado (`invalidarPDFProduccion`). "Compartir" solo se
  muestra si `navigator.canShare({files})` (en Chrome de escritorio no aparece, es normal).
- **Imágenes**: `prepararImagenPDF` descarga, reduce a máx. 800px y re-codifica a JPEG con fondo
  blanco (patrones/logo son PNG transparentes) para que el PDF quede liviano para WhatsApp; si una
  imagen falla devuelve `null` y se dibuja un recuadro "foto no disponible" — nunca aborta el PDF.
- **Probar local**: `construirPDFConfeccion`/`construirPDFEstampado` no tocan DOM ni Supabase — se
  pueden llamar desde consola en `index.html` abierto como `file://` (aunque muestre el login) con datos
  de ejemplo, y ver el resultado renderizándolo con pdf.js. En `file://` el logo no carga (esperado).

## Notificaciones push (agregado 2026-08-18)

Sistema completo de Web Push, funciona en iPhone (iOS 16.4+, confirmado
16.4+ y probado en 26.5.2) **solo si la app está agregada a la pantalla de
inicio** (no desde Safari normal) — si se toca algo del manifest/ícono, hay
que recordarle al usuario borrar y volver a agregar el acceso directo.

- **Cliente**: botón "Activar notificaciones" en el sidebar
  (`activarNotificaciones()`) pide permiso, registra `sw.js`, se suscribe
  con `VAPID_PUBLIC_KEY` y guarda la suscripción (upsert por `endpoint`) en
  `push_subscriptions`. `actualizarBotonNotificaciones()` chequea el estado
  al cargar la app para no mostrar "Activar" si ya está activado.
- **`sw.js`**: escucha `push` (muestra la notificación con el logo) y
  `notificationclick` (enfoca la app o la abre).
- **Envío**: Edge Function `send-push` (Supabase, ver Stack) — recibe un
  payload y le pega a **todos** los `push_subscriptions` vía `web-push`
  (librería de Deno). Si un endpoint devuelve 404/410 (suscripción vencida),
  la borra sola de la tabla.
- **4 disparadores configurados**, todos vía SQL corrido a mano en el SQL
  Editor de Supabase (no están en el repo como migraciones, solo en el
  historial de esta conversación — si hay que tocarlos, revisar directo en
  Supabase: Database → Triggers / Extensions → pg_cron → `cron.job`):
  1. **Gasto registrado**: trigger `trg_notificar_gasto` (función
     `notificar_gasto_registrado`) en `gastos_lote` AFTER INSERT.
  2. **Pedido nuevo registrado**: trigger `trg_notificar_pedido` (función
     `notificar_pedido_registrado`) en `pedidos` AFTER INSERT (no dispara
     en UPDATE/edición, solo en creación).
  3. **Entregas próximas**: cron `entregas-proximas-diario`, todos los días
     8:00am hora Perú (`0 13 * * *` UTC), función
     `chequear_entregas_proximas()` — solo notifica si hay pedidos no
     entregados con `fecha_entrega` en los próximos 2 días (si no hay
     ninguno, no manda nada).
  4. **Recordatorio semanal de producción**: cron
     `recordatorio-produccion-jueves`, todos los jueves 9:00am hora Perú
     (`0 14 * * 4` UTC) — mensaje fijo, siempre se manda sin condición.
- Requiere las extensiones `pg_net` y `pg_cron` habilitadas en Supabase (ya
  están).
- Le llega a **todos** los celulares suscritos siempre, no hay lógica de
  "avisar a todos menos a quien hizo la acción" (decisión explícita del
  usuario — más simple que armar identificación por dispositivo).

## Formulario público — versión vigente (`pedido.html`, desde 2026-10-07)

Reescrito desde cero y aprobado por el usuario tras probarlo en su iPhone. Diseño completo en
`docs/superpowers/specs/2026-10-07-formulario-publico-v2-design.md`. Escribe exactamente las mismas
tablas/columnas que la versión anterior (lo de RLS, `generarUUID`, `obtener_codigo_pedido`, el trigger
de precios y la cola "Por Confirmar" sigue igual — ver la sección de la versión anterior y Gotchas).

- **Arquitectura**: un objeto de estado `S` (`vista`, `cliente`, `productos`, `borrador`, `editIdx`,
  `abierta`, `envio`…) y funciones que repintan (`pintar()` la vista completa, `pintarSecciones()`
  solo el acordeón). Vistas: `datos` → `tipo` → `armar` → `pedido` → `exito` (`VISTAS`). Todo clic pasa
  por un único listener con `data-action` → `ACCIONES`. No hay ids por producto como antes
  (`prod_1_talla`…): si se prueba desde consola, se manipula `S` y se llama a `ir()`/`pintar()`.
- **Tarjetas de producto = filas activas del catálogo** (`catalog`, ordenado por `ORDEN_TIPOS` y
  precio; Manta fuera). Cada tarjeta fija `tipo`+`variante`+`precio` (`nuevoBorrador(item)`), por eso
  no hay paso "Modelo". Si se agrega una variante nueva al catálogo aparece sola como tarjeta (con la
  ilustración de short por defecto si no está en `VARIANTE_UI`).
- **Secciones del armado**: `SECCIONES` (cuándo aplica, cuándo está lista, su resumen) +
  `CUERPOS` (su HTML) + `ORDEN_SECCIONES`. Para agregar un campo nuevo a un producto se agrega ahí
  y en el `insert` de `enviarPedido()`. Al elegir, `avanzar()` abre la siguiente sección pendiente.
- **Nada preseleccionado** (canal, short, talla, corte, color, patrón). Si el usuario pide un valor
  por defecto en algo, confirmar: fue una decisión de diseño para evitar pedidos con datos no elegidos.
- **Fotos**: guía como recomendación (no requisito); aviso de "3 incluidas / S/5 desde la cuarta"
  solo al llegar a 3; se reducen a máx. 2400 px JPEG 0.9 antes de subir (`prepararFoto`).
- **Envío** (`enviarPedido()`): fotos primero (3 intentos c/u) → pedido → todos los items en un solo
  `insert`. `S.envio` conserva el id entre reintentos. Si falla, `S.errorEnvio` se muestra en "Tu pedido".
- **Borrador**: `localStorage['pf_pedido_borrador_v1']`, 24 h, sin fotos (`guardarBorrador`/
  `leerBorrador`/`restaurarBorrador`). Al cambiar la forma de los datos guardados, subir la versión
  de la clave para no restaurar borradores incompatibles.
- **`?demo` en la URL**: recorre todo sin escribir nada (etiqueta "Vista previa"). Usarlo para
  mostrarle cambios de diseño al usuario o para probar sin ensuciar datos.
- **Ilustraciones**: SVG propios en el lenguaje plano del logo (`ilus('short'|'pantalon'|'polo'|
  'tote_bag')`), con las siluetas duplicadas como `clipPath` en `<svg id="ilus-defs">` — si se cambia
  una silueta hay que cambiarla en los dos lugares. El usuario no tiene fotos de producto.
- **Regalo**: "Incluye tote bag de regalo" en pijama y polo (`TIPOS_CON_REGALO`).
- **WhatsApp/Instagram**: `WHATSAPP_NUMERO`/`INSTAGRAM_USUARIO` al inicio del script; mismo mensaje y
  misma limitación de Instagram (copiar + abrir) que la versión anterior.

## Formulario público — versión ANTERIOR (`pedido-anterior.html`, respaldo; era `pedido.html` hasta 2026-10-07)

**Lo que sigue describe el formulario anterior**, que se conserva funcionando como respaldo por si
hay que volver atrás (bastaría con intercambiar los nombres de archivo). Sirve también como
referencia del porqué de varias reglas (validación por tipo, "Sin patrón", ficha de resumen) que la
versión nueva mantiene con otra implementación.

Canal adicional de registro. Detalles ya cubiertos en otras secciones — RLS y `SECURITY DEFINER` en
"Esquema"/"Gotchas", cola de revisión en "Lógica de negocio" — esta sección es sobre `pedido.html`
en sí. **El flujo cambió bastante en 2026-09** respecto al diseño original de 2026-08-18 (ese
diseño tenía PDF, sin pantalla de revisión, sin tarjetas colapsables) — lo que sigue es el estado
vigente; los planes de agosto en `docs/superpowers/plans/2026-08-18-formulario-publico-*` quedaron
desactualizados en esos puntos.

- **Flujo por pasos, no todo en una pantalla larga** (rediseñado 2026-09): al cargar, solo se ve la
  tarjeta "Tus datos" (Canal, Nombre, Contacto) con un botón **"Continuar"** — el resto del
  formulario (productos, total, botón de enviar) no existe todavía en el DOM. Al tocar "Continuar"
  con nombre y contacto completos, "Tus datos" se colapsa a una línea resumen (mismo patrón visual
  que un producto colapsado, ver siguiente punto) y recién ahí aparece el Producto 1. Se eligió un
  botón explícito en vez de auto-avanzar al completar los campos, para mantener el mismo lenguaje de
  interacción que "Agregar otro producto" (el cliente decide cuándo avanzar, nunca es automático).
  Tocar "Tus datos" ya colapsada la reabre sin afectar los productos ya armados.
- **Tarjetas de producto colapsables** (`colapsarProducto`/`expandirProducto`, 2026-09): al tocar
  "Agregar otro producto" (`agregarOtroProducto()`), primero se valida el producto actualmente
  abierto (`validarProducto`, ver siguiente punto) — si está incompleto, no se agrega nada nuevo, se
  muestra el mismo error de validación apuntando a esa tarjeta. Si está completo, esa tarjeta se
  colapsa a un resumen chico (foto + tipo/modelo + chips de talla/color/patrón + precio, vía
  `renderResumenProducto`) y aparece la tarjeta nueva ya desplegada. Colapsar es puramente CSS
  (`display:none` sobre `.product-item-fields`, nunca se destruyen los campos) — reabrir una tarjeta
  colapsada (tocándola) siempre muestra los valores intactos. Si la validación final (al tocar
  "Registrar pedido") apunta a un producto que está colapsado, se expande automáticamente antes de
  hacer scroll y resaltarlo — no hace falta adivinar que hay que tocarlo primero.
- **Validación por tipo de producto + campos que se pintan en verde** (`validarProducto`,
  `CAMPOS_REQUERIDOS_POR_TIPO`, 2026-09): ya no basta con Tipo+Modelo. Reglas confirmadas por el
  usuario — Pijama exige Talla, Color, Patrón (o "Sin patrón" elegido explícitamente, ver siguiente
  punto) y al menos 1 foto; Polo exige Talla, Nombre de la mascota y al menos 1 foto; Tote bag exige
  Nombre de la mascota y al menos 1 foto (sin talla, no aplica). El mensaje de error dice el número
  de producto, su tipo y el campo exacto que falta, hace scroll suave hasta esa tarjeta y le agrega
  un borde rojo temporal (`.error-highlight`, se quita solo a los ~2s). Mientras se llena un
  producto, cada campo obligatorio se marca con un check verde junto a la etiqueta y un borde verde a
  la izquierda de esa sección (`.form-group-completo`, mismo `--success` que ya usa el ícono de
  éxito) apenas queda completo — **se intentó primero un mini-preview en vivo fijo debajo del
  encabezado y se descartó**: quedaba fuera de vista mientras el cliente bajaba llenando el resto de
  la tarjeta, así que nunca lo veía actualizarse; el marcado por campo resuelve eso de raíz porque
  vive exactamente donde el cliente está mirando.
- **Opción "Sin patrón"** (galería de patrones, 2026-09): tarjeta extra al inicio de la galería (ícono
  de prohibido sobre el mismo fondo que los placeholders de foto), para que el cliente que
  genuinamente no quiere ningún patrón pueda decirlo explícitamente — guarda el texto literal `"Sin
  patrón"` en el campo (no vacío), distinguible de "todavía no eligió nada" para la validación.
- **Pantalla de revisión antes de enviar** (`revisarPedido()`/`volverAEditar()`/
  `confirmarYEnviarPedido()`, 2026-09): al tocar "Registrar pedido" ya NO se guarda directo — se
  valida todo (puntos de arriba) y, si pasa, se muestra la ficha de resumen (`renderFichaResumen`,
  ver siguiente punto) como vista previa, con botones **"Editar"** (vuelve al formulario, nada se
  pierde) y **"Confirmar y enviar"** (recién ahí se sube todo a Supabase). Las fotos en esta vista
  previa se muestran con `URL.createObjectURL(file)` — vista local del navegador, **no se suben a
  Storage todavía** — para no dejar archivos huérfanos si el cliente cambia de foto tras tocar
  "Editar" o simplemente cierra la pestaña sin confirmar. Si cierra en esta pantalla, no queda ningún
  rastro en Supabase (ni pedido ni fotos).
- **Ficha de resumen** (`renderFichaResumen`, reemplaza al PDF desde 2026-09 — ver Progreso
  2026-08-21): tarjeta HTML con una fila por producto (foto real vía `<img>` directo a la URL
  pública, sin conversión a base64 — a diferencia del PDF viejo, esto no necesita `fetch()`), chips
  de Talla/Corte/Color (cuadradito real vía `buscarColorPorCodigo`)/Patrón, y el total. **El chip de
  Patrón incluye la miniatura real de la imagen** (agregado 2026-09, buscada en `patterns` filtrando
  por `nombre` **y** `tipo_mascota` — ver Esquema/Gotchas sobre por qué el filtro de especie es
  obligatorio; si el patrón es "Sin patrón" se muestra ese texto sin miniatura). Se usa en 2 momentos:
  como vista previa antes de confirmar (fotos locales, sin `codigo`) y en la pantalla de éxito final
  (fotos ya subidas a Storage, con el `codigo_pedido` real). Debajo de la ficha, en la pantalla de
  éxito, un texto sugiere tomar una captura de pantalla si el cliente quiere guardar su resumen — no
  hay ningún mecanismo de compartir/descargar la imagen (se evaluó y se descartó explícitamente: ni
  `wa.me` permite adjuntar archivos, ni la Web Share API permite fijar a qué chat va, así que
  combinar "imagen adjunta" + "chat correcto en 1 toque" no es posible con las herramientas
  disponibles — se prefirió mantener el botón de contacto tal cual, confiable, y resolver el problema
  real con la ficha visible en pantalla en vez de depender de un archivo).
- **Contenido del formulario**: Canal (WhatsApp/Instagram/TikTok — TikTok se guarda como `otro`, no
  hay valor propio en la base de datos), Nombre (su label cambia a "Usuario de Instagram" si el
  canal es `ig`), Contacto, y productos repetibles con Tipo (**Manta oculta**, ver Esquema; labels
  con mayúscula vía `TIPO_PRODUCTO_LABELS`, ej. "Tote bag" no "tote_bag")/Variante/Talla (lista fija
  para Pijama: `12, 14, S, M, L, XL` — otros tipos usan texto libre)/Corte (galería visual con foto
  real de cada corte — `corte-clasico.png`/`corte-princesa.png`)/Color (pantonera visual: familia →
  cuadrícula de 10 tonos reales clickeables, familia "Gris" renombrada a **"Negro/Grises"** en 2026-09
  porque clientes escribían pidiendo "negro" sin darse cuenta de que estaba ahí — los códigos y hex no
  cambiaron, solo el nombre de la familia, en ambos formularios)/Patrón (galería, igual que el
  interno, más la opción "Sin patrón")/Fotos (clic o pegar Ctrl+V, mensaje fijo de "3 gratis, S/5
  extra" puramente informativo, no se calcula solo)/Observaciones del producto. **No** pide: lote,
  estado, urgente, adelanto/monto pagado, observaciones generales, fecha de entrega (reemplazada por
  el mensaje fijo de plazo).
- **`generarUUID()`**: `pedido.html` genera su propio `id` de pedido client-side antes de insertar
  (`crypto.randomUUID()` con respaldo manual si no está disponible — requiere contexto seguro,
  `https`, no funciona probando local con `file://`). Necesario porque `anon` no tiene `SELECT` en
  `pedidos`, así que no puede pedir la fila de vuelta después de insertar.
- **`obtener_codigo_pedido(uuid)`**: función `SECURITY DEFINER` en Supabase que es la única forma en
  que `pedido.html` puede leer el `codigo_pedido` generado por el trigger — recibe el id exacto,
  devuelve solo el código, nada más de la fila.
- **Botón de contacto según el canal elegido**: `wpp` u `otro`/TikTok → botón WhatsApp
  (`wa.me/51928399285?text=...`, mensaje pre-armado con el código real). `ig` → botón "Copiar mensaje
  y abrir Instagram" (`copiarMensajeYAbrirInstagram()`: copia el mensaje al portapapeles, luego abre
  `ig.me/m/peludosfactory`) — **Instagram no permite precargar texto en el DM desde un link
  externo**, es una limitación real de la plataforma, no del código; por eso el flujo de Instagram es
  en 2 pasos en vez de 1 solo como WhatsApp (ya no dispara ninguna descarga de PDF, ver Progreso
  2026-08-21). Si el número de WhatsApp o el usuario de Instagram cambian algún día, están
  hardcodeados como `WHATSAPP_NUMERO`/`INSTAGRAM_USUARIO` al inicio del script de `pedido.html`.
- **Mensaje de pago destacado** (`.pago-destacado`, agregado 2026-08-18): caja con fondo degradado
  de acento (no el `.info-banner` suave que ya usaba el mensaje de plazo — a propósito, para que no
  se confundan visualmente) que dice *"Solo falta coordinar el adelanto del 50% por **WhatsApp**/
  **Instagram** para empezar tu pedido 💛"* — el canal mencionado (`canalTexto` en `mostrarExito()`)
  cambia según lo que el cliente eligió al inicio, igual que el botón de contacto. **Ojo**: esto es
  el adelanto del formulario web (50%, variable). Si el usuario menciona un adelanto fijo distinto
  (ej. S/25, S/30), probablemente hable de un canal aparte (ej. un catálogo impreso para una feria)
  con su propia política — no asumir que hay que cambiar este mensaje sin confirmar primero.
- **Label del nombre** (ajustado 2026-08-18): decía "Nombre completo", ahora solo "Nombre"
  (`#cliente_nombre_label`, tanto el texto inicial en el HTML como el que pone `onCanalChange()`
  cuando el canal NO es Instagram — cuando sí es Instagram sigue diciendo "Usuario de Instagram").

## Diseño visual (para no reinventar esto de nuevo cada vez)

Ya se iteró varias veces sobre el diseño visual — si el usuario pide
"mejorar el diseño" de nuevo, revisar esto primero antes de proponer algo
desde cero:

- **Paleta**: cálida, crema `#FDFAF0` de fondo, acento terracota
  (`--accent: #E8703A`, `--accent-dark: #C4522A`, en gradiente 135deg para
  botones/hero), dorado `--gold` como acento secundario. Variables en `:root`
  al inicio del `<style>`. El semáforo de estados del Kanban usa una
  variable nueva `--estado-listo` (#7FAE8C, verde intermedio) además de
  `--danger`/`--gold`/`--accent`/`--success` ya existentes.
- **Tipografía**: mezcla intencional de dos fuentes — `Fraunces` (serif
  cálida) para el logo, títulos de pantalla (`.header h1`), cifras grandes
  (`.stat-value` / `.hero-value`) y encabezados de modales; `Poppins` para
  todo lo demás (body, botones, labels, tablas) por legibilidad. No mezclar
  esto de nuevo sin necesidad — ya se probó cambiar toda la app a una sola
  fuente y no se veía tan bien.
- **Sombras**: sistema de 3 niveles en variables (`--shadow-sm`, `--shadow`,
  `--shadow-lifted`), todas multicapa con tinte cálido (nunca gris plano).
  Las tarjetas de producto del formulario (`.product-item`) también llevan
  `--shadow-sm` ahora (antes eran un bloque de color plano).
- **Iconos**: círculos con degradado sutil (`.icon-blue`, `.icon-gold`,
  `.icon-terracotta`, `.icon-green`), no color plano. Ese mismo lenguaje se
  reutiliza en los encabezados de sección del formulario de pedido
  (`.section-icon`, círculos chicos de 26px) y en el ícono del sidebar.
- **Logo real de la marca**: `logo-icon.png` — recortado del logo completo
  que compartió el usuario (`PELUDOS FACTORY`), quedándose solo con la
  marca de las orejitas/carita de perro (la "O" de PELUDOS), sobre fondo
  crema `#FDFAF0` igual al `--bg` de la app, en un canvas cuadrado con
  padding. Se usa en el sidebar (`.logo-icon`, `border-radius: 10px`,
  `object-fit: contain`), favicon, `apple-touch-icon` y `manifest.json`. Si
  se necesita el logo completo (con el texto "PELUDOS FACTORY") para algo,
  no existe una versión limpia todavía — habría que pedirle el archivo
  original de nuevo o recortar otra parte del mismo logo-pf.png.
- **Patrones**: las imágenes de patrón (`patrones.imagen_url`) son PNG con
  fondo transparente, sin ningún marco ni esquina redondeada horneada en el
  archivo — el `border-radius: 10px` de `.pattern-option img` (CSS) es lo
  que las hace ver como cuadraditos redondeados, para que combinen con
  cualquier fondo donde se muestren. Si se sube un patrón nuevo "crudo"
  (con fondo, con medallita numerada u otro artefacto de la fuente de
  donde salió), replicar el proceso: color-key del fondo a transparente +
  recorte al contenido real, nunca redistorsionar el diseño.
- **Responsive móvil**: inputs/selects/textarea forzados a `font-size: 16px`
  en el media query móvil (evita el zoom automático de iOS al enfocar un
  campo — NO bajar de 16px ahí). Las tablas (`.list-table`) usan
  `min-width: 640px` en móvil para que el scroll horizontal quede contenido
  dentro de `.list-view` (`overflow-x: auto`) en vez de aplastar columnas
  ilegibles o desbordar la página completa. El nav lateral se vuelve una fila
  horizontal scrolleable en móvil (`.nav-scroll-wrap`), no se aplasta — ojo
  con `.nav-links li`, tiene `width: 100%` en escritorio que hay que
  neutralizar (`width: auto`) en el media query móvil o los links se
  superponen unos sobre otros (bug real que ya pasó).
- Referencia de estructura del dashboard (hero ancho completo + ícono a la
  derecha, alertas/materiales lado a lado, nav agrupado con CTA fijo abajo):
  el usuario compartió una captura de otra app como inspiración de
  estructura/orden (no de colores) — ya está aplicada, no hace falta
  volver a pedirla.

## Gotchas críticos ya resueltos (no repetir el diagnóstico)

- **`SyntaxError: Identifier 'supabase' has already been declared`**: el
  CDN `@supabase/supabase-js@2` resuelve siempre a la última versión 2.x. En
  algún momento esa librería empezó a declarar `var supabase` en el scope
  global. Como el código propio también declaraba `const supabase = ...`, esto
  causaba ese error que rompía TODO el script silenciosamente (sin mostrar
  el catch de error). Se resolvió renombrando la variable del cliente a
  `sb` en TODO el archivo (`const sb = window.supabase.createClient(...)`).
  Si alguna vez vuelve un error similar de "ya declarado", sospechar
  primero de este tipo de colisión con la librería del CDN, no de caché ni
  de Vercel.
- **`<datalist>` no funciona en Safari iOS**: nunca usarlo para
  autocompletados nuevos (ver nota de Gastos del Lote arriba) — construir
  un dropdown propio en JS/CSS filtrando un array en memoria.
- **Notificaciones push en iOS**: solo funcionan si la PWA fue agregada a
  la pantalla de inicio **después** de que existiera el `manifest.json` con
  íconos correctos. Un acceso directo viejo (de antes del manifest) puede
  no soportar push aunque el resto de la app funcione — hay que borrarlo y
  volver a agregarlo desde Safari.
- **Triggers de Postgres que necesitan leer/escribir tablas que `anon` no
  puede ver por RLS** (ej. `preparar_pedido_web` leyendo `lotes`): sin
  `SECURITY DEFINER SET search_path = public` en la función, el trigger
  corre con los permisos de quien disparó el insert (`anon`, sin sesión) y
  las consultas internas devuelven vacío **en silencio**, sin error — no es
  que falte el dato, es que el trigger no puede verlo. Encontrado al probar
  `pedido.html` de verdad (sin login); no se detectó antes porque la prueba
  de la Fase 1 se hizo logueado como `authenticated`, que sí ve todo. Si
  algún trigger nuevo necesita leer una tabla restringida, agregar
  `SECURITY DEFINER SET search_path = public` desde el principio.
- **`anon` sin `SELECT` en una tabla + `.insert(...).select()` desde el
  cliente**: Supabase/PostgREST no puede devolver la fila insertada
  (`return=representation`) si el rol que insertó no tiene política de
  `SELECT` sobre esa tabla — rebota como `"new row violates row-level
  security policy"` aunque el `INSERT` en sí sea válido. Pasa en
  `pedido.html` (`anon` no puede leer `pedidos`, por diseño). Solución
  usada: el cliente genera su propio `id` (`crypto.randomUUID()`, con
  respaldo manual porque `randomUUID` requiere contexto seguro — no
  funciona probando con `file://` local, sí en producción con `https`) y
  nunca pide `.select()` de vuelta; para datos que sí hace falta leer
  después de insertar (ej. `codigo_pedido` para mostrarlo en pantalla), se
  usa una función `SECURITY DEFINER` chica y específica
  (`obtener_codigo_pedido(uuid)`) que devuelve solo ese campo para ese id
  exacto, nunca la fila completa ni una lista.

- **Dos sistemas de numeración escribiendo en la misma columna (`numero_pedido`)**: hasta 2026-09,
  los pedidos manuales calculaban su número en `index.html` (`MAX` del lote + 1) mientras los pedidos
  web dependían de un `DEFAULT` de secuencia global en la columna — dos fuentes de verdad distintas
  que tarde o temprano coincidían en el mismo número dentro de un mismo lote, sin que hiciera falta
  ninguna condición de carrera (pasó con 7 horas de diferencia entre los dos inserts). Si se toca de
  nuevo la numeración de pedidos, la única fuente de verdad debe ser el trigger
  `preparar_pedido_web` (con el `SELECT ... FOR UPDATE` sobre `lotes` para que sea atómico) — nunca
  volver a calcular `numero_pedido` en el cliente ni depender de un `DEFAULT` de columna. Ver "Lógica
  de negocio" para el detalle completo del arreglo.
- **Buscar un patrón solo por `nombre` sin filtrar por `tipo_mascota`**: como `patrones.nombre` es
  literalmente un número repetido igual en perro y gato (ver Esquema), cualquier `find`/`filter` que
  compare solo por nombre puede devolver el patrón de la especie equivocada — pasó en `index.html`
  (`resolvePatronImagen`, corregido en 2026-09 agregando el parámetro de especie y trayendo
  `tipo_mascota` en las 3 consultas que alimentan esas tarjetas). Si se agrega en el futuro cualquier
  otro lugar que resuelva la imagen de un patrón a partir de su nombre guardado, replicar el mismo
  filtro por especie desde el principio.

- **Columna nueva nombrada en `select`/`insert` → el SQL va ANTES del deploy**: PostgREST rechaza
  con error `42703` cualquier `select` o `insert` que nombre una columna inexistente. Si se publica
  código que usa una columna nueva antes de que el usuario corra el `ALTER TABLE`, se caen las vistas
  que la consultan y —peor— el formulario público deja de registrar pedidos. Orden correcto: SQL →
  verificar → push. Se puede verificar sin login con
  `curl ".../rest/v1/items_pedido?select=<columna>&limit=1" -H "apikey: <key pública>"`: devuelve
  `[]` si existe (RLS filtra las filas) y el error `42703` si no. La raíz `/rest/v1/` (esquema
  OpenAPI) ya **no** sirve para esto con la key pública ("Secret API key required").

## Convenciones de trabajo

- Antes de cambios de esquema (ALTER TABLE, tablas nuevas), dar el SQL al
  usuario para correr en el SQL Editor de Supabase — no tengo acceso DDL
  directo, solo REST con la key pública (sirve para INSERT/UPDATE/DELETE en
  tablas ya existentes).
- La Edge Function `send-push` y los triggers/cron de notificaciones
  **tampoco** se pueden tocar por REST — requieren que el usuario los
  actualice a mano en el dashboard de Supabase (Edge Functions → Code /
  Secrets, o SQL Editor para triggers y `cron.schedule`). Si se necesita
  cambiar el código de la función, dar el archivo completo para copiar y
  pegar, igual que con el SQL de esquema.
- Después de cada cambio de frontend: commit + push a `main` (Vercel
  autodeploya), y verificar en el sitio real descargando el HTML servido
  (`curl`) o usando el Browser tool antes de dar por hecho que algo
  funciona. El Browser tool a veces bloquea `vercel.app` por política de la
  sesión (pasó en esta sesión, sin causa clara) — si pasa, verificar con
  `curl` + pruebas locales contra `file://` (con datos reales de Supabase,
  que sí responde normal) en vez de insistir con el navegador.
- Si se crean datos de prueba (lotes/pedidos/gastos) para verificar algo,
  **siempre borrarlos al final y confirmar** que no se tocó nada real del
  usuario (consultar de nuevo después de borrar para verificar que quedó
  limpio, no asumir que el DELETE funcionó).
- No inventar catálogo, precios, recetas de materiales ni reglas de negocio —
  preguntar antes si no está confirmado explícitamente por el usuario.
- El usuario suele dictar los mensajes (hay ruido de transcripción, frases
  repetidas, "me entiendes" frecuente) — leer con calma para extraer la
  intención real antes de responder o implementar; si algo queda ambiguo,
  preguntar en vez de asumir.
- Cuando una tarea es grande (ej. notificaciones push, limpieza de
  imágenes), este proyecto respondió bien a ir **paso por paso con
  checkpoints explícitos** en vez de hacer todo de una — especialmente
  cuando hay pasos que solo el usuario puede hacer (dashboard de Supabase).

**OJO — no confundir estas tablas de "costo" que suenan parecido:**
`recetas_materiales` (estimado automático por producto, sigue activa),
`costos_referencia` (lista de precios suelta — **eliminada de la UI**,
tabla probablemente huérfana en la DB), `gastos_lote` (registro real de
gasto por lote, sí se compara contra el estimado, y alimenta tanto el
autocompletado de insumos como las notificaciones de gasto). Si el usuario
pide algo de "costos" de nuevo, probablemente hable de `gastos_lote` —
confirmar antes de tocar código si no está claro.

## Panel interno — avance del sub-proyecto 3 (leer ANTES que la lista de pendientes de abajo)

**Forma de trabajo acordada**: cada mejora se construye primero en [`panel-prueba.html`](panel-prueba.html)
(copia exacta de `index.html` + lo nuevo; publicada en `/panel-prueba.html`, comparte sesión y datos
reales con el panel porque es el mismo origen; muestra sola la etiqueta "Versión de prueba" cuando
la ruta contiene `panel-prueba`, así que el archivo es idéntico al de producción). Cesar la prueba ahí
y, con su visto bueno, se promueve con `cp panel-prueba.html index.html`. **Editar siempre
`panel-prueba.html`, nunca `index.html` directo**, o la siguiente promoción pisa el cambio.
Dato nuevo: Cesar y Mariana usan el panel **más en computadora** que en celular.

- **HECHO y en producción (`index.html`)** — Resumen del pedido mejorado (`verResumenPedido`): color y
  contacto como botones de tocar-para-copiar (`copiarDesdeBoton`, lee `data-copy`; el color copia el
  **hex**, que es lo que pegan en el programa de diseño), chips de talla/short/corte, patrón con
  miniatura y especie ("Gato 3"), fechas legibles (`fechaLegible`), nombres legibles
  (`nombreProducto(tipo, variante)` — ojo: `TIPO_PRODUCTO_LABELS` dice "Pijamas" en plural porque es
  para el select; para mostrar un producto usar `nombreProducto`), las 5 etapas como botones
  (`cambiarEstadoDesdeResumen`, envuelve a `cambiarEstado` sin tocarla), botones Eliminar/Cerrar/Editar
  siempre visibles al pie (`.summary-actions-fijas`, sticky) y ventana ancha en 2 columnas en
  computadora (pedido explícito: no tener que bajar para llegar a los botones).
- **HECHO y en producción (2026-10-08)** —
  (1) **Lote Activo más seguro**: aviso "Deshacer" de 8 s tras cambiar de etapa (`ofrecerDeshacer`/
  `deshacerCambioEstado`, `#undo-toast`; `cambiarEstado` solo ganó una lectura previa del pedido y la
  llamada al aviso — al deshacer un paso a "Entregado" también se devuelven `monto_pagado` y
  `estado_pago` a como estaban); la leyenda es ahora una fila de filtros (`#estado-filtros`,
  `filtrarLotePorEstado`/`aplicarFiltroEstadoLote`, oculta tarjetas por `data-estado`, solo lote
  activo); "Eliminar Lote" pasó al menú "⋮" de la cabecera (`#lote-menu`); semáforo de 26 px en celular.
  (2) **Buscar y Gastos como tarjetas en celular**: solo CSS sobre la misma tabla
  (`.tabla-tarjetas` + `.tabla-buscar`/`.tabla-gastos`, celdas con clases `b-*`/`g-*`); fechas cortas
  con `fechaCorta` ("8 oct"). En computadora siguen siendo tablas.
  **Fechas "de hoy"**: usar siempre `hoyISO(masDias)` (fecha local). Antes se usaba
  `new Date().toISOString()` (UTC) y desde las 7 pm hora Perú salía el día siguiente en gastos, fecha
  de pedido, inicio de lote, ajuste de caja y entrega sugerida — corregido en todos el 2026-10-08.
- **HECHO y en producción (2026-10-07)** — (a) **Bloque "Hoy"**
  (`renderBloqueHoy`, `#hoy-section`, arriba del Dashboard, que ahora se titula "Inicio"): grupos Por
  confirmar (todos los lotes) / Atrasados / Se entregan hoy / mañana / pasado mañana / Listos sin
  cobrar / Urgentes, del lote activo; cada pedido sale una sola vez y al tocarlo abre el resumen.
  **Reemplaza** la sección "Alertas y Entregas Próximas" y la tarjeta dorada de "por revisar" (se
  quitaron). (b) **Barra inferior en celular** (`.bottom-nav`: Inicio · Lote · ➕ · Confirmar con
  contador · Más; hoja `#mas-overlay` con Buscar, Gastos, Patrones, Notificaciones, Cerrar sesión);
  el sidebar se oculta en celular, la barra se esconde en el formulario de pedido
  (`body.en-formulario-pedido`) y sin sesión (`body.sin-sesion`); contador
  `actualizarContadorPorConfirmar` (clase `.nav-badge-revision`, también en el menú lateral). Se agregó
  `viewport-fit=cover` para `env(safe-area-inset-bottom)` — **falta que Cesar confirme en su iPhone**
  (app en pantalla de inicio) que la barra no queda bajo la rayita de inicio ni el título bajo la hora.
- **Falta**: solo, si Cesar lo pide, acortar el formulario interno de pedido. `panel-prueba.html` e
  `index.html` están iguales; falta también su confirmación en iPhone de la barra inferior.

## Panel interno — mejoras PENDIENTES (sub-proyecto 3, aprobado el 2026-10-07)

Tercera y última parte del proyecto de 2026-10 (ver Progreso). El usuario aprobó **las 4 mejoras**
de abajo, con la condición de **no mover la lógica** ("todo está funcionando bien"). Todavía no hay
spec ni plan: toca hacer preguntas, diseñar y construir. Todo es en `index.html`.

**Lo que encontró la auditoría (vista en tamaño celular, que es como lo usa Cesar):**

1. **Navegación en celular**: la cabecera (logo + fila de íconos deslizable + 3 botones apilados a
   la derecha: cerrar sesión, notificaciones, "+") ocupa casi un cuarto de la pantalla. Los íconos no
   tienen nombre, hay que deslizar para ver Patrones y Gastos (se ve la barra de scroll), y "Por
   Confirmar" no muestra contador. → **Aprobado: barra de navegación inferior fija** con las
   secciones principales, contador de Por Confirmar y "Nuevo pedido" al centro; lo secundario
   (Patrones, Gastos, notificaciones, cerrar sesión) en un "Más". Ojo con `env(safe-area-inset-bottom)`
   y con que es PWA en iOS. El sidebar de escritorio puede quedarse como está.
2. **Dashboard**: muestra cifras pero no qué hacer hoy; las alertas muestran fechas crudas
   (`2026-10-08`) que se parten en dos líneas. → **Aprobado: bloque "Hoy"** arriba (qué hay por
   confirmar, qué se entrega hoy/mañana, qué está listo sin pagar) con fechas legibles ("mañana").
3. **Lote Activo**: los cuadraditos del semáforo miden ~19 px (lo recomendable para el dedo es ~44)
   y cambian el estado al instante sin deshacer; "Eliminar Lote" es un botón rojo grande junto a
   "Nuevo Lote" y "Actualizar"; la leyenda de colores solo informa. → **Aprobado: "Lote Activo más
   seguro"**: aviso con "Deshacer" al cambiar de estado, leyenda convertida en filtros por estado, y
   "Eliminar Lote" fuera de la vista principal (menú). Respetar la regla de "Entregado" = pago
   completo y sus confirmaciones.
4. **Buscar Pedidos y Gastos**: tablas con scroll horizontal en celular. → **Aprobado: tarjetas en
   celular** (la tabla puede quedarse en escritorio).
5. Detalles vistos de paso (no aprobados explícitamente, proponerlos): el tipo de producto sale
   crudo en tarjetas y resumen ("pijama — Manga corta + short", "tote_bag"); el resumen del pedido no
   muestra el corte; el formulario interno de pedido mide ~3500 px con un solo producto.

**Orden sugerido** (de menor a mayor riesgo, cada una desplegable por separado): barra inferior →
bloque "Hoy" → Buscar/Gastos en tarjetas → Lote Activo.

**Cómo ver el panel sin iniciar sesión** (no se pueden escribir contraseñas; el usuario prueba con
su sesión real en el iPhone): abrir `https://registro-pedidos-pf.vercel.app/` (o el `index.html`
local) en el Browser pane y, desde `javascript_tool`, reemplazar `sb.from` por datos de ejemplo y
llamar a `mostrarApp()`. `sb` es `const`, pero sus métodos sí se pueden reasignar:

```js
const T = { lotes: [...], pedidos: [...], items_pedido: [...], gastos_lote: [...], caja_ajustes: [],
            recetas_materiales: [], patrones: [...], catalogo_productos: [...], push_subscriptions: [] };
function Q(tabla) {            // constructor de consultas falso: encadenable y "thenable"
  const st = { f: [], single: false };
  const run = () => {
    let filas = (T[tabla] || []).map(r => ({ ...r }));
    for (const [op, k, v] of st.f) filas = filas.filter(r => op === 'eq' ? r[k] === v : op === 'neq' ? r[k] !== v : v.includes(r[k]));
    if (tabla === 'pedidos') filas.forEach(r => { r.items_pedido = T.items_pedido.filter(i => i.pedido_id === r.id); r.lotes = T.lotes.find(l => l.id === r.lote_id); });
    return { data: st.single ? (filas[0] || null) : filas, error: null };
  };
  const p = new Proxy({}, { get(_, m) {
    if (m === 'then') return (ok, ko) => Promise.resolve(run()).then(ok, ko);
    if (m === 'eq' || m === 'neq' || m === 'in') return (k, v) => { st.f.push([m, k, v]); return p; };
    if (m === 'single' || m === 'maybeSingle') return () => { st.single = true; return p; };
    if (m === 'insert' || m === 'update') return payload => { (window.__escrituras ||= []).push({ tabla, m, payload }); return p; };
    return () => p;                                   // select, order, limit, delete...
  } });
  return p;
}
sb.from = Q; await mostrarApp();                      // luego navigateTo('lote-view'), etc.
```

Catálogo y patrones reales se pueden traer antes con la key pública (`anon` sí los lee). Vistas:
`dashboard`, `lote-view`, `search`, `revision-view`, `patrones-view`, `gastos-view`, `order-form`.
**El Browser pane suele ser angosto (~340-420 px)**: sirve tal cual como vista de celular; pedir
1280 px lo encoge hasta ser ilegible, así que la vista de escritorio se revisa por código o pidiéndole
una captura al usuario. Nada de esto escribe en Supabase.

## Progreso (resumen de lo construido, más reciente arriba)

- **2026-10-07** — Auditoría completa de `pedido.html` y del panel (`index.html`) + arranque de un
  proyecto en 3 sub-proyectos, en este orden: **(1)** correcciones de lógica, **(2)** rediseño visual
  del formulario público, **(3)** mejoras del panel. Decisiones del usuario ya tomadas para (2) y (3):
  formulario con **libertad visual total** (puede cambiar la identidad), **ilustraciones** en vez de
  fotos de producto (no tiene fotos), construirlo en una copia (`pedido-v2.html`) y mostrar 2-3
  propuestas visuales antes de escribir código; panel: las 4 mejoras aprobadas — barra de navegación
  inferior en celular (con contador de Por Confirmar y "Nuevo pedido" al centro), bloque "Hoy" en el
  Dashboard con fechas legibles, Lote Activo más seguro (deshacer al cambiar estado, leyenda como
  filtros, "Eliminar Lote" fuera de la vista principal) y Buscar/Gastos como tarjetas en móvil.
  Hallazgos de la auditoría de `pedido.html` que el rediseño debe resolver: foto que falla al subir
  se omite en silencio, fotos sin comprimir ni progreso, corte "Clásico" preseleccionado, pedido
  huérfano si el envío falla a medias, sin borrador (Grupo 3), selects de texto sin imagen, ~3
  pantallas de scroll por pijama sin total a la vista, campo que se desplaza al marcarse en verde,
  `tipo_producto` crudo en la ficha, "pega (Ctrl+V)" en móvil, G09 y G10 con el mismo hex.
  **Sub-proyecto (1) — COMPLETO y en producción**: short de varón/mujer + retiro de manga larga +
  tolerancia de variantes descontinuadas (ver Lógica de negocio). Spec en
  `docs/superpowers/specs/2026-10-07-short-varon-mujer-quitar-manga-larga-design.md`, plan en
  `docs/superpowers/plans/2026-10-07-short-varon-mujer-quitar-manga-larga.md`, SQL en
  `supabase-sql/2026-10-07-tipo-short-y-manga-larga.sql` (**ambos pasos ya corridos** por el usuario;
  verificado: columna `tipo_short` existe y manga larga quedó `activo = false`). Probado en local con
  Supabase simulado y en producción con un pedido real de prueba (`PF-2610-057`, rechazado después
  por el usuario). De paso se corrigió en `pedido.html` que un polo elegido después de una pijama se
  guardaba con `corte` (el corte no se ocultaba al cambiar de tipo). Ojo: la primera vez el usuario
  corrió el `ALTER` en **otro proyecto de Supabase** (error `relation "items_pedido" does not
  exist`) — tiene más de un proyecto; al darle SQL, recordarle que la URL del dashboard debe contener
  `zafgoegngcqsswzzxcen`. **Siguen pendientes los sub-proyectos (2) y (3).**
  **Sub-proyecto (2) — formulario público nuevo, COMPLETO y en producción como `pedido.html`**
  (se construyó como `pedido-v2.html`; lo que sigue lo nombra así). Primero se le mostraron 3 direcciones visuales
  en teléfonos de muestra (crema actual / azul noche / "sticker") y **las rechazó las tres**
  ("prefiero la versión actual", la oscura "no me gusta nada") — pese a haber elegido "libertad
  total", su gusto es la marca actual: **no proponer temas oscuros ni cambiar la identidad**; la
  mejora va en la experiencia. Lo que sí aprobó ("me gusta muchísimo más", "está bonito") fue un
  prototipo completo navegable con su marca, que ya es el formulario real: **`pedido-v2.html`
  (publicado en `/pedido-v2.html`, `noindex`) SÍ registra pedidos** — misma data que `pedido.html`.
  Con `?demo` en la URL no escribe nada (etiqueta "Vista previa"). Diseño y decisiones completas en
  `docs/superpowers/specs/2026-10-07-formulario-publico-v2-design.md`; lo no obvio:
  - 4 tarjetas de producto desde el inicio (una por fila activa del catálogo; las 2 pijamas
    separadas, sin paso "Modelo") — pedido explícito: 3 tarjetas "se veían vacías".
  - "Incluye tote bag de regalo" se anuncia en pijama **y polo** (`TIPOS_CON_REGALO`), confirmado.
  - Armado por secciones tipo acordeón que se cierran con su resumen y abren la siguiente; nada
    preseleccionado (tampoco el corte); barra inferior fija con precio y botón.
  - Guía de fotos como **recomendación** (clientes con fotos antiguas o de recuerdo), y el aviso de
    "hasta 3 fotos / S/5 desde la cuarta" aparece **recién en la tercera foto** (anunciarlo antes
    hacía que todos subieran tres).
  - Envío: primero todas las fotos (3 intentos, avance visible, reducidas a máx. 2400 px), luego el
    pedido, luego todos los productos en un solo `insert`; el id del pedido se conserva entre
    reintentos (`S.envio`) para no duplicar. Si falla una foto no se crea el pedido.
  - Borrador automático en `localStorage` (`pf_pedido_borrador_v1`, 24 h, sin fotos) — esto cierra
    el "Grupo 3" pendiente desde 2026-09.
  - Ilustraciones SVG planas en el lenguaje del logo (`ilus()`), con siluetas también como
    `clipPath` en `<svg id="ilus-defs">`.
  Probado en producción con Supabase simulado (falla de foto, falla al guardar + reintento, borrador)
  y con un pedido real de 2 productos (`PF-2610-058`, a nombre de "PRUEBA Claude v2 (borrar)" — se le
  pidió al usuario rechazarlo en Por Confirmar).
  **REEMPLAZO HECHO (2026-10-07)**: el usuario lo probó en su iPhone ("todo muy bien") y pidió el
  cambio. `pedido.html` es ahora la versión nueva; la anterior quedó en `pedido-anterior.html`
  (respaldo, `noindex`) y `pedido-v2.html` redirige a `pedido.html`. Verificado en producción. El
  enlace que comparte con clientes no cambió. **Sub-proyecto (2) cerrado.** Queda el **sub-proyecto
  (3), panel interno** (las 4 mejoras de arriba). Dato suelto sin confirmar: cómo es la pijama real
  (qué parte lleva color y patrón) — solo importa si pide más fidelidad en las ilustraciones.
- **2026-09-12** — PDFs de producción en el Dashboard de `index.html`: "Pantalones y shorts" (para el
  confeccionista) y "Polos" con fotos elegidas (para el estampador), sin decir para quién es cada uno,
  con Descargar + Compartir (menú de iOS → WhatsApp). Ver sección "PDFs de producción" arriba. Probado
  local con datos de ejemplo e imágenes reales de Storage (incluye saltos de página, fotos rotas,
  colores fuera de pantonera, "Sin patrón", manga larga) y la UI del modal en escritorio/móvil;
  **pendiente la prueba real del usuario en iPhone** (logueado, compartir a WhatsApp). El **Grupo 3
  de `pedido.html` (borrador en `localStorage`) sigue pendiente** — se priorizó esto antes.
- **2026-09-06** — Ajustes a `pedido.html` tras usar en producción el Grupo 2 de abajo (feedback real
  del usuario, no bugs): (1) se **quitó el mini-preview en vivo** (quedaba fijo debajo del
  encabezado y el cliente nunca lo veía actualizarse al bajar en la tarjeta) y se reemplazó por
  campos que se marcan con check + borde verde apenas quedan completos (`.form-group-completo`,
  visible sin importar cuánto se haya bajado); (2) **"Tus datos" ahora es colapsable** detrás de un
  botón "Continuar" explícito, igual patrón que los productos; (3) **la ficha de resumen ahora
  muestra la miniatura real del patrón**, no solo su número — requirió agregar `tipo_mascota` a los
  datos de la ficha (no viajaba hasta ahí) y filtrar por especie al buscar la imagen, mismo criterio
  que el fix de `resolvePatronImagen` en `index.html`. Ver "Formulario público de auto-registro"
  arriba para el detalle vigente. Spec en
  `docs/superpowers/specs/2026-09-06-pedido-html-ajustes-flujo-y-ficha-design.md`, plan en
  `docs/superpowers/plans/2026-09-06-pedido-html-ajustes-flujo-y-ficha.md`. Probado end-to-end local
  y en producción con pedidos reales de prueba (borrados después).
- **2026-09-06** — Grupo 2 de mejoras de UX en `pedido.html` (ver auditoría de la entrada de abajo):
  tarjetas de producto colapsables (`colapsarProducto`/`expandirProducto`, colapsa al tocar "Agregar
  otro producto" con validación previa, reabre con los datos intactos) + un mini-preview en vivo
  dentro de la tarjeta abierta — **esta segunda parte se reemplazó casi de inmediato**, ver la entrada
  de arriba. Se corrigió de paso un bug real notado por el usuario al probar: el badge de número de
  pedido (`#N-L#`) se partía en dos líneas con nombres de cliente largos (faltaba `white-space:
  nowrap`), y el selector de tipo de producto no capitalizaba "Polo"/"Tote bag"
  (`TIPO_PRODUCTO_LABELS` reemplaza el ternario que solo capitalizaba "Pijama"). Spec en
  `docs/superpowers/specs/2026-09-06-pedido-html-tarjetas-colapsables-design.md`, plan en
  `docs/superpowers/plans/2026-09-06-pedido-html-tarjetas-colapsables.md`.
- **2026-09-05/06** — Grupo 1 de mejoras de UX en `pedido.html`: validación específica por producto
  (dice qué producto y qué campo falta, con scroll y borde rojo temporal — antes era un mensaje
  genérico), campos obligatorios reales por tipo de producto (antes solo se exigía Tipo+Modelo),
  opción "Sin patrón" en la galería, y una pantalla de revisión ("Revisa tu pedido") antes de guardar
  de verdad, con fotos en vista previa local (`URL.createObjectURL`, no se suben a Storage hasta
  confirmar). Ver "Formulario público de auto-registro" arriba. Spec en
  `docs/superpowers/specs/2026-09-06-pedido-html-validacion-revision-design.md`, plan en
  `docs/superpowers/plans/2026-09-06-pedido-html-validacion-revision.md`. Probado end-to-end local y
  en producción.
- **2026-09-04/05** — Auditoría de UX de `pedido.html` contra mejores prácticas actuales de
  formularios/configuradores de producto (investigada en internet, no solo criterio propio) —
  encontró varios problemas reales (validación genérica, sin campos obligatorios reales, sin revisión
  antes de enviar, formulario largo de una sola pantalla, patrones sin nombre descriptivo) y propuso
  10 ideas; el usuario aprobó 6 (validación específica, campos obligatorios, revisión antes de
  enviar, tarjetas colapsables, mini-preview en vivo, borrador en el navegador — este último, Grupo 3,
  **sigue pendiente**) que se agruparon en 3 specs/planes independientes por cómo se relacionan entre
  sí (ver las 3 entradas de arriba para los Grupos 1 y 2; el Grupo 3 — borrador guardado en
  `localStorage`, 24h de retención — no se llegó a implementar en esta sesión).
- **2026-09-04** — Corrección del bug de numeración de pedidos (ver "Lógica de negocio" y "Gotchas"
  arriba para el detalle completo del diagnóstico y el arreglo) + 2 correcciones chicas pedidas por el
  usuario en la misma sesión: Manta oculta en `pedido.html` (sigue en `index.html`), familia de color
  "Gris" renombrada a "Negro/Grises" en ambos formularios. Spec en
  `docs/superpowers/specs/2026-09-04-correcciones-mantas-color-numeracion-design.md`, plan en
  `docs/superpowers/plans/2026-09-04-correcciones-mantas-color-numeracion.md`. Verificado con pedidos
  de prueba reales insertados directo contra la API pública de Supabase (simulando el canal web) y
  borrados después.
- **2026-08-21** — Se reemplazó el PDF de resumen de `pedido.html` por una ficha visual en HTML
  (`renderFichaResumen`), siempre visible en la pantalla de éxito en vez de vivir solo dentro de un
  archivo descargado — el cliente ya no perdía de vista el detalle de su pedido al volver a la
  pestaña tras tocar el botón de contacto. Se eliminaron `descargarPDF()`, sus helpers de conversión
  a base64, y el `<script>` de jsPDF. El botón de WhatsApp/Instagram quedó igual (mismo mensaje,
  mismo número/usuario), solo sin el efecto secundario de descargar el PDF. Spec en
  `docs/superpowers/specs/2026-08-21-pedido-html-ficha-resumen-design.md`, plan en
  `docs/superpowers/plans/2026-08-21-pedido-html-ficha-resumen.md`. Probado end-to-end local y en
  producción con pedidos reales de prueba (WhatsApp e Instagram, borrados después).
- **2026-08-18 (tarde/noche)** — Ajustes al formulario público tras revisión del usuario en
  producción real (no eran bugs de código, eran pedidos de cambio explícitos): (1) label "Nombre
  completo" → "Nombre"; (2) se quitó el botón separado "Descargar PDF del pedido" — el PDF ahora se
  descarga solo al tocar el botón de WhatsApp/Instagram, porque el botón separado dejaba al cliente
  en un estado raro en iOS Safari antes de poder continuar; (3) nuevo mensaje destacado
  `.pago-destacado` en la pantalla de éxito, dinámico según el canal ("por WhatsApp" o "por
  Instagram"); (4) el PDF ahora incluye las fotos que subió el cliente por producto (se había
  decidido explícitamente "sin fotos" en el spec original, el usuario pidió revertirlo). Detalle
  completo en "Formulario público de auto-registro" arriba. Probado end-to-end con una foto de
  prueba real subida y embebida en el PDF sin errores. **El usuario avisó que probablemente pida
  más correcciones sobre esta misma parte (PDF/WhatsApp/Instagram) en la próxima sesión** — no
  asumir que quedó 100% cerrado, confirmar con él primero.
- **2026-08-18** — Selector visual de corte (clásico/princesa) en `index.html`
  y `pedido.html`: reemplaza el `<select>` de texto por una galería de 2
  fotos reales (`corte-clasico.png`/`corte-princesa.png`, nuevas en la raíz
  del repo). El usuario mandó 2 fotos de mockups de polos blancos sobre
  fondo con degradado gris/negro — se les quitó el fondo con un modelo de IA
  (`@imgly/background-removal-node`, un color-key simple no servía porque el
  degradado compartía tonos con la prenda blanca), se recortó al contenido
  real, y se compuso cada una sobre el mismo beige `--card-secondary` que ya
  usa la app para placeholders de foto — mismo criterio de "fondo transparente
  + recorte sin distorsionar" que los patrones, pero con fondo sólido en vez
  de transparente porque la prenda es blanca (invisible sobre el crema de la
  app si fuera transparente). Guarda en el mismo `${id}_corte` de siempre, sin
  tocar `saveOrder`/`editOrder`/cálculo de costos.
- **2026-08-18** — Formulario público de auto-registro — Fase 4 de 4
  completada (proyecto terminado)**: PDF de resumen con `jsPDF` (paleta de
  marca propia del PDF) y botón de contacto según el canal elegido (WhatsApp
  con mensaje pre-armado, o Instagram con copiar+abrir por la limitación de
  la plataforma) — ver "Formulario público de auto-registro" arriba para el
  detalle completo **tal como quedó después de los ajustes de la entrada de
  arriba** (el PDF original de esta Fase 4 no tenía fotos y sí tenía un botón
  propio de descarga; ambas cosas cambiaron después). Probado con pedidos
  reales de canal WhatsApp e Instagram. Plan en
  `docs/superpowers/plans/2026-08-18-formulario-publico-fase4-pdf-whatsapp.md`
  (el plan quedó desactualizado en esos 2 puntos, la fuente de verdad es el
  código y esta nota de Progreso).
- **2026-08-18** — Formulario público de auto-registro — Fase 3 de 4
  completada** (cola de revisión): vista nueva "Por Confirmar" en
  `index.html` (ver "Cola de revisión" en Lógica de negocio arriba) —
  excluye `Por confirmar` de Dashboard/Lote Activo, agrega card de alerta,
  tarjetas con foto/chips reutilizando el diseño de "Lote Activo", y
  editar/confirmar/rechazar. Probado end-to-end con un pedido de prueba real
  simulando el formulario público (confirmado que no contaba en ningún
  cálculo hasta confirmarlo, y que sí después). Plan en
  `docs/superpowers/plans/2026-08-18-formulario-publico-fase3-cola-revision.md`.
  **Pendiente** (Fase 4, última): PDF de resumen + botón de WhatsApp/Instagram
  en la pantalla de éxito de `pedido.html`.
- **2026-08-18** — Formulario público de auto-registro — Fase 2 de 4
  completada (`pedido.html`): archivo nuevo, 100% independiente de
  `index.html`, sin login. Reutiliza `PANTONERA`/`CAMPOS_POR_TIPO`/subida de
  fotos con paste-drag del formulario interno, pero adaptado: color como
  cuadrícula visual de 10 tonos reales por familia (sin botón de copiar hex,
  ese es solo del interno), talla de Pijama en lista fija (12/14/S/M/L/XL),
  precio visible de solo lectura, mensajes fijos de plazo de producción y de
  fotos incluidas (3 gratis, S/5 extra informativo). Al probar contra `anon`
  de verdad se encontraron y corrigieron 2 bugs reales de diseño de RLS que
  la Fase 1 no detectó (ver "Gotchas críticos" abajo): las funciones del
  trigger necesitaban `SECURITY DEFINER`, y el guardado no puede pedir
  `.select()` de vuelta — el cliente genera su propio `id` y el código de
  pedido se obtiene con una función nueva `obtener_codigo_pedido(uuid)`.
  Probado end-to-end con un pedido real (código `PF-2608-003` generado,
  borrado después). **Pendiente** (Fase 3): la cola de revisión en
  `index.html` — hasta que exista, los pedidos `Por confirmar` se mezclan
  sin filtrar con los pedidos reales en todas las vistas. Plan en
  `docs/superpowers/plans/2026-08-18-formulario-publico-fase2-pedido-html.md`.
- **2026-08-18** — Formulario público de auto-registro — Fase 1 de 4
  completada (esquema + seguridad): columnas `origen`/`codigo_pedido` en
  `pedidos`, nuevo estado `'Por confirmar'`, trigger de Postgres que genera
  el código `PF-YYMM-NNN` y recalcula precio contra `catalogo_productos`
  para pedidos `origen='web'` (ignora lo que mande el navegador), RLS
  activada en las 9 tablas, políticas de Storage corregidas (bloqueado el
  listado del bucket, que antes era público), y login real con Supabase
  Auth agregado a `index.html`. Verificado en vivo: columnas, trigger
  (precio/código correctos, pedido de prueba borrado), RLS (`anon` bloqueado
  en tablas sensibles, `catalogo_productos` sigue público, `authenticated`
  con acceso completo), Storage (listado bloqueado). Faltan las Fases 2-4:
  construir `pedido.html`, la cola de revisión en la app interna, y el
  PDF/WhatsApp — spec completo en
  `docs/superpowers/specs/2026-08-18-formulario-publico-design.md`, plan de
  esta fase en
  `docs/superpowers/plans/2026-08-18-formulario-publico-fase1-seguridad.md`.
- **2026-08-18** — Rediseño de las tarjetas de "Lote Activo": ahora es una
  tarjeta por producto (no por pedido) — ver "Tarjetas — una por producto"
  en Lógica de negocio arriba. Agrega chips de color/corte/patrón, ojito de
  observación por producto, franja+pastilla de agrupación entre productos
  del mismo pedido, y quita los botones Ver/Editar de la tarjeta (ya
  redundantes con el tap-to-open). Nueva columna `items_pedido.orden` para
  numerar de forma estable. Spec completo en
  `docs/superpowers/specs/2026-08-18-lote-cards-redesign-design.md`.
- **2026-08-18** — Limpieza de las 14 imágenes de patrones: fondo
  transparente (color-key del crema `#FDFAF0`/similar), recorte de la
  medallita numerada que traían de la fuente original, recorte al
  contenido real sin distorsionar. Subidas a Storage como `clean_<id>.png`
  y `patrones.imagen_url` actualizado en las 14 filas. El `border-radius`
  redondeado lo sigue poniendo el CSS de la app, no está horneado en el PNG.
- **2026-08-18** — Auditoría estética/funcional del formulario de "Nuevo
  Pedido" + correcciones: confirmación al cancelar con cambios sin guardar
  (`formDirty`) y al quitar un producto, validación real por producto
  (tipo/variante/precio), botón "Duplicar producto", numeración de
  tarjetas con ícono por tipo, total flotante que se oculta solo cerca del
  botón Guardar, botón de copiar en "Contacto", íconos en encabezados de
  sección, sombra en tarjetas de producto.
- **2026-08-18** — Selector visual de color (pantonera oficial de 120
  colores) reemplazando el campo de texto libre — ver Lógica de negocio.
- **2026-08-17/18** — Notificaciones push completas: gasto registrado,
  pedido nuevo, entregas próximas (diario) y recordatorio de producción
  (semanal, jueves) — ver sección dedicada arriba.
- **2026-08-17** — Caja del Dashboard vuelta global (todos los lotes) +
  botón "Reiniciar caja" con contraseña — ver Lógica de negocio y tabla
  `caja_ajustes`.
- **2026-08-17** — Rediseño del tablero de "Lote Activo": se quitaron las
  columnas por estado, ahora es un grid único con semáforo de 5 cuadraditos
  clickeable por tarjeta (`cambiarEstado`) — ver Lógica de negocio.
- **2026-08-17** — Regla: al marcar un pedido "Entregado" se asume pago
  completo automático (retroactivo a pedidos ya entregados con saldo).
- **2026-08-17** — Botón "Activar Lote" en "Lotes anteriores" para
  soportar lotes paralelos sin perder la noción de cuál es "el activo".
- **2026-08-17** — Se agregó el logo real de la marca (favicon, ícono de
  instalación PWA, sidebar) reemplazando el ícono genérico de pata.
- **2026-08-17** — Sección "Registro de Costos" (`costos_referencia`)
  eliminada de la app por decisión del usuario — no aportaba valor real.
  El autocompletado de insumos de Gastos se re-conectó a `gastos_lote`.
- **2026-08-05/06** — Rediseño de tarjetas de pedido (foto más grande,
  tipo+variante+talla visibles), fix del nav móvil superpuesto
  (`.nav-links li` sin `width: auto` en el media query), tarjetas del
  Dashboard más compactas en móvil.
- **2026-08-02** — Reestructuración del Dashboard inspirada en una captura
  de referencia que compartió el usuario (misma paleta, otra estructura):
  sidebar con nav agrupado (principal/secundaria) + separador + botón
  "Nuevo Pedido" fijo al fondo; tarjeta hero a ancho completo; "Alertas" y
  "Materiales a Comprar" lado a lado (`.dashboard-lower-grid`).
- **2026-08-02** — Rediseño visual v3: tipografía `Fraunces` + `Poppins`,
  sombras multicapa con tinte cálido, íconos con degradado.
- **2026-08-02** — Responsive móvil mejorado en toda la app (solo CSS).
- **2026-07-14** — Nueva sección "Gastos" (real vs. estimado por receta).
  Se agregó este archivo `CLAUDE.md`.
- **2026-07-13** — Corte de polo, numeración de lotes/pedidos como
  máximo+1, cálculo automático de costos de materiales, fix del tablero
  mostrando lote anterior, auditoría inicial completa (catálogo real,
  campos dinámicos, Patrones, lote activo, kanban accionable).
- **2026-07-13** — Diagnóstico y fix del bug de "Cargando..." infinito /
  colisión de `supabase` como identificador (ver Gotchas arriba).
  Migración completa a Supabase + GitHub + Vercel nuevos.
