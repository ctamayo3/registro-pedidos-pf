# Peludos Factory — Registro de Pedidos

App interna (sin login) para reemplazar una hoja de Google Sheets donde se
registran pedidos personalizados de mascotas (pijamas, mantas, polos, tote
bags). La usan 2 personas: **Cesar** (dueño, cesartamayo660@gmail.com) y
**Mariana**. Cesar tiene iPhone (iOS 26.5.2 confirmado) — cualquier feature
que dependa de comportamiento de navegador/PWA hay que pensarla para Safari
iOS primero, no asumir Chrome/Android.

## Stack

- **Frontend**: un solo archivo [`index.html`](index.html) — HTML + CSS + JavaScript vanilla (sin frameworks, sin build step).
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

RLS desactivado en todas las tablas (app interna sin login). Bucket de Storage:
`fotos-pedidos` (público, con políticas de insert/select/update públicas) — se
usa tanto para fotos de pedidos como para imágenes de patrones (prefijo
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
  `cliente_contacto`, `estado` (check: 'Pendiente','Diseño enviado','En
  producción','Listo','Entregado'), `precio_total`, `monto_pagado`,
  `saldo_pendiente` (columna GENERADA = precio_total - monto_pagado, no
  escribir directo), `estado_pago` (check: 'Pendiente'/'Pagado'), `urgente`
  (bool), `fecha_pedido`, `fecha_entrega`, `observaciones_generales`,
  `created_at`. **Al llegar a `estado = 'Entregado'` se asume pago
  completo automático** (ver Lógica de negocio) — no es solo un valor más
  del enum, dispara un side-effect.
- **`items_pedido`**: `id`, `pedido_id` (FK, ON DELETE CASCADE), `tipo_producto`,
  `variante`, `talla`, `color`, `patron`, `tipo_mascota` ('perro'/'gato'),
  `corte` ('clasico'/'princesa', solo pijama manga corta — ver abajo),
  `nombre_mascota`, `año_nacimiento_mascota`, `raza_o_frase`, `fotos` (jsonb
  array de URLs), `precio_unitario`, `observaciones`, `costo_estimado`
  (numeric, calculado al guardar vía `recetas_materiales`, null si no hay
  receta para ese producto). **`color` guarda el código corto de la
  pantonera** (ej. `"A04"`), no el hex ni el nombre — ver "Selector de color
  (pantonera)" abajo. Pedidos viejos pueden tener texto libre ahí (ej.
  "azul oscuro"); eso se maneja con gracia, no se fuerza a migrar.
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
  aparte debajo (sin cambios ahí). Las tarjetas (`renderOrderCard`) muestran
  foto grande (72px, al costado izquierdo, con placeholder si no hay foto),
  tipo + variante exacta del catálogo, talla como badge chico, y saldo/pagado.
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
  dentro de un `.nav-scroll-wrap` (principal: Dashboard/Lote Activo/Buscar —
  secundaria: Patrones/Gastos — **"Costos" ya no existe**, ver Esquema),
  separados por un `.nav-divider`. Debajo del nav, dentro de
  `.sidebar-bottom` (pegado al fondo vía `margin-top: auto`), están el botón
  "Activar notificaciones" (`#btn-notificaciones`, cambia de texto/color
  cuando ya está activado) y el CTA "Nuevo Pedido" — en ese orden. El logo
  de arriba del sidebar es la imagen real de la marca (`logo-icon.png`), ya
  no el ícono genérico de pata (`fa-paw`).

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
