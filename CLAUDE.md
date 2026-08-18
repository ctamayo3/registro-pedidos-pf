# Peludos Factory — Registro de Pedidos

App interna (con login desde 2026-08-18, ver Progreso) para reemplazar una
hoja de Google Sheets donde se registran pedidos personalizados de mascotas
(pijamas, mantas, polos, tote bags). La usan 2 personas: **Cesar** (dueño,
cesartamayo660@gmail.com) y **Mariana**. Cesar tiene iPhone (iOS 26.5.2
confirmado) — cualquier feature que dependa de comportamiento de
navegador/PWA hay que pensarla para Safari iOS primero, no asumir
Chrome/Android.

Desde 2026-08-18 existe un **canal adicional de registro**: un formulario
público (`pedido.html`) donde el cliente arma su propio pedido, recibe un
PDF de resumen y un botón de contacto (WhatsApp/Instagram) — proyecto
completo, sus 4 fases implementadas (esquema/seguridad/login, `pedido.html`,
cola de revisión "Por Confirmar" en `index.html`, PDF + WhatsApp/Instagram).
Ver spec completo en
`docs/superpowers/specs/2026-08-18-formulario-publico-design.md` y los 4
planes en `docs/superpowers/plans/2026-08-18-formulario-publico-*`. El
formulario interno (`index.html`) sigue siendo el canal principal, sin
cambios de comportamiento salvo el login y la vista nueva "Por Confirmar".

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

- **Frontend interno**: un solo archivo [`index.html`](index.html) — HTML + CSS + JavaScript vanilla (sin frameworks, sin build step). Requiere login (ver sección de arriba).
- **Formulario público**: [`pedido.html`](pedido.html) (nuevo, 2026-08-18) — archivo 100% independiente, sin login, para que el cliente arme su propio pedido. No importa ni referencia nada de `index.html`/dashboard/costos. Usa `jspdf@2.5.1` desde CDN para el PDF de resumen — ver "Formulario público de auto-registro" más abajo.
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
- **`pedidos`**: `id`, `numero_pedido` (int, se reinicia por lote — ver abajo),
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
- **`catalogo_productos`**: `id`, `tipo_producto`, `variante`, `precio`,
  `activo`. Catálogo real (no inventar variantes/precios sin confirmar con el
  usuario):
  - Pijama: "Manga corta + short" (S/95), "Manga corta + pantalón" (S/109),
    "Manga larga + pantalón" (S/119)
  - Manta: "Felpa estándar 160x100cm" (S/60), "Felpa con carnero 160x130cm" (S/90)
  - Polo: "Polo de algodón" (S/60) — **sin receta de costos todavía**
  - Tote bag: "Tote bag" (S/45)
- **`patrones`**: `id`, `nombre`, `imagen_url`, `tipo_mascota`
  ('perro'/'gato'/'ambos'), `activo`. Se administran desde la app (sección
  "Patrones"), no hace falta tocar Supabase a mano. Las 14 imágenes actuales
  (6 gato + 8 perro, **no existe "Perro 8"**, el nombre salta de 7 a 9 y así
  es la data real) ya fueron limpiadas: fondo transparente, sin la medallita
  numerada que traían de origen — ver Progreso 2026-08-18. Si se sube un
  patrón nuevo, probablemente venga "crudo" (con fondo) de nuevo — no asumir
  que el proceso de limpieza es automático al subir.
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
- **Numeración de lotes y pedidos**: NO se usa el `serial` de Postgres (nunca
  reutiliza números). Se calcula en el cliente como `MAX(numero) actual + 1`
  (`obtenerSiguienteNumeroLote`, `obtenerSiguienteNumeroPedido`). Así, si se
  borran todos los lotes, el siguiente vuelve a ser #1. `numero_pedido` se
  reinicia por lote (no es único globalmente — por eso el historial de Buscar
  muestra también la columna Lote). Es una condición de carrera conocida y
  aceptada (2 personas creando al mismo tiempo podrían chocar) — no se
  arregló, es de bajo riesgo con solo 2 usuarios.
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
  (miniatura real + nombre, buscada en el array `patterns` ya cargado) — 
  cada chip solo aparece si el campo tiene valor — y un footer con
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

## Formulario público de auto-registro — `pedido.html` (agregado 2026-08-18)

Canal adicional de registro, completo (4 fases). Detalles ya cubiertos en otras secciones — RLS y
`SECURITY DEFINER` en "Esquema"/"Gotchas", cola de revisión en "Lógica de negocio" — esta sección
es sobre `pedido.html` en sí:

- **Contenido del formulario**: Canal (WhatsApp/Instagram/TikTok — TikTok se guarda como `otro`, no
  hay valor propio en la base de datos), Nombre (su label cambia a "Usuario de Instagram" si el
  canal es `ig`), Contacto, y productos repetibles con Tipo/Variante/Talla (lista fija para Pijama:
  `12, 14, S, M, L, XL` — otros tipos usan texto libre)/Corte (galería visual con foto real de cada
  corte — `corte-clasico.png`/`corte-princesa.png` en la raíz del repo, mismo patrón que la galería
  de patrones, agregado 2026-08-18 — ver Progreso)/Color (pantonera visual:
  familia → cuadrícula de 10 tonos reales clickeables, sin botón de copiar hex — eso es solo del
  formulario interno)/Patrón (galería, igual que el interno)/Fotos (clic o pegar Ctrl+V, mensaje fijo
  de "3 gratis, S/5 extra" puramente informativo, no se calcula solo)/Observaciones del producto.
  **No** pide: lote, estado, urgente, adelanto/monto pagado, observaciones generales, fecha de
  entrega (reemplazada por el mensaje fijo de plazo).
- **`generarUUID()`**: `pedido.html` genera su propio `id` de pedido client-side antes de insertar
  (`crypto.randomUUID()` con respaldo manual si no está disponible — requiere contexto seguro,
  `https`, no funciona probando local con `file://`). Necesario porque `anon` no tiene `SELECT` en
  `pedidos`, así que no puede pedir la fila de vuelta después de insertar.
- **`obtener_codigo_pedido(uuid)`**: función `SECURITY DEFINER` en Supabase que es la única forma en
  que `pedido.html` puede leer el `codigo_pedido` generado por el trigger — recibe el id exacto,
  devuelve solo el código, nada más de la fila.
- **PDF de resumen**: se genera con `jsPDF` (CDN, `jspdf@2.5.1`) solo al tocar el botón "Descargar
  PDF del pedido" en la pantalla de éxito (no automático al cargar la pantalla — más seguro en
  Safari iOS, que es más estricto con descargas no disparadas por un clic directo). Contenido:
  franja de marca + "PELUDOS FACTORY", código de pedido grande, detalle de cada producto (tipo,
  variante, talla, corte, color con cuadradito real + código, patrón, precio), línea de total, y el
  mensaje de plazo de producción en un recuadro. **Sin fotos** (decisión explícita, mantiene el PDF
  liviano). Paleta específica del PDF (dada así por el usuario, distinta de las variables CSS de la
  app): acento `#E8721C`, fondo `#F5F0E8`, texto `#2C1810`.
- **Botón de contacto según el canal elegido**: `wpp` u `otro`/TikTok → botón WhatsApp
  (`wa.me/51928399285?text=...`, mensaje pre-armado con el código real). `ig` → botón "Copiar
  mensaje y abrir Instagram" (copia el mensaje al portapapeles + abre `ig.me/m/peludosfactory`) —
  **Instagram no permite precargar texto en el DM desde un link externo**, es una limitación real de
  la plataforma, no del código; por eso el flujo de Instagram es en 2 pasos (copiar y pegar) en vez
  de 1 solo como WhatsApp. Si el número de WhatsApp o el usuario de Instagram cambian algún día, están
  hardcodeados como `WHATSAPP_NUMERO`/`INSTAGRAM_USUARIO` al inicio del script de `pedido.html`.
  **Ajustado 2026-08-18**: ya NO hay un botón separado de "Descargar PDF" — se descarga solo
  (`descargarPDF()`) como parte de tocar el botón de WhatsApp/Instagram, no antes. Se quitó porque
  el botón separado disparaba la descarga y dejaba al cliente en un estado raro antes de poder
  seguir al chat (en iOS Safari `doc.save()` de jsPDF puede navegar la pestaña actual en vez de solo
  descargar). Ahora, como WhatsApp abre en pestaña nueva (`target="_blank"`) e Instagram también
  (`window.open(...)`), la pestaña original de `pedido.html` puede verse afectada por el PDF sin que
  importe, porque el cliente ya se va a la pestaña nueva.
- **Mensaje de pago destacado** (`.pago-destacado`, agregado 2026-08-18): caja con fondo degradado
  de acento (no el `.info-banner` suave que ya usaba el mensaje de plazo — a propósito, para que no
  se confundan visualmente) que dice *"Solo falta coordinar el adelanto del 50% por **WhatsApp**/
  **Instagram** para empezar tu pedido 💛"* — el canal mencionado cambia según lo que el cliente
  eligió al inicio, igual que el botón de contacto.
- **Fotos del cliente en el PDF** (agregado 2026-08-18, revierte la decisión original de "sin
  fotos" del spec — el usuario pidió incluirlas para evitar disputas de "yo subí otra foto"):
  `descargarPDF()` hace `fetch()` de cada URL de `fotos-pedidos` (Storage, públicas), las convierte
  a `dataURL` base64 (`fetchImagenComoDataUrl`) y las embebe con `doc.addImage()` debajo del detalle
  de cada producto. Cada foto se envuelve en su propio `try/catch` — si una falla (ej. sin
  conexión), el PDF se sigue generando igual sin esa foto, nunca rompe por completo.

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

## Progreso (resumen de lo construido, más reciente arriba)

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
  completada (proyecto terminado)**: PDF de resumen con `jsPDF` (descargable
  desde la pantalla de éxito, paleta de marca propia del PDF, sin fotos) y
  botón de contacto según el canal elegido (WhatsApp con mensaje pre-armado,
  o Instagram con copiar+abrir por la limitación de la plataforma) — ver
  "Formulario público de auto-registro" arriba para el detalle completo.
  Probado con pedidos reales de canal WhatsApp e Instagram. Plan en
  `docs/superpowers/plans/2026-08-18-formulario-publico-fase4-pdf-whatsapp.md`.
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
