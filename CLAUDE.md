# Peludos Factory — Registro de Pedidos

App interna (sin login) para reemplazar una hoja de Google Sheets donde se
registran pedidos personalizados de mascotas (pijamas, mantas, polos, tote
bags). La usan 2 personas (dueños del negocio).

## Stack

- **Frontend**: un solo archivo [`index.html`](index.html) — HTML + CSS + JavaScript vanilla (sin frameworks, sin build step).
- **Base de datos**: Supabase (Postgres) vía `@supabase/supabase-js@2` desde CDN (`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2`).
- **Repositorio**: GitHub — https://github.com/ctamayo3/registro-pedidos-pf
- **Deploy**: Vercel — https://registro-pedidos-pf.vercel.app/ (auto-deploy en cada push a `main`)
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

## Esquema de base de datos

- **`lotes`**: `id` (uuid), `numero` (int — ver nota de numeración abajo),
  `fecha_inicio`, `nota`, `activo` (bool, solo un lote activo a la vez).
- **`pedidos`**: `id`, `numero_pedido` (int, se reinicia por lote — ver abajo),
  `lote_id` (FK), `canal` ('ig'/'wpp'/'otro'), `cliente_nombre`,
  `cliente_contacto`, `estado` (check: 'Pendiente','Diseño enviado','En
  producción','Listo','Entregado'), `precio_total`, `monto_pagado`,
  `saldo_pendiente` (columna GENERADA = precio_total - monto_pagado, no
  escribir directo), `estado_pago` (check: 'Pendiente'/'Pagado'), `urgente`
  (bool), `fecha_pedido`, `fecha_entrega`, `observaciones_generales`,
  `created_at`.
- **`items_pedido`**: `id`, `pedido_id` (FK, ON DELETE CASCADE), `tipo_producto`,
  `variante`, `talla`, `color`, `patron`, `tipo_mascota` ('perro'/'gato'),
  `corte` ('clasico'/'princesa', solo pijama manga corta — ver abajo),
  `nombre_mascota`, `año_nacimiento_mascota`, `raza_o_frase`, `fotos` (jsonb
  array de URLs), `precio_unitario`, `observaciones`, `costo_estimado`
  (numeric, calculado al guardar vía `recetas_materiales`, null si no hay
  receta para ese producto).
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
  "Patrones"), no hace falta tocar Supabase a mano.
- **`recetas_materiales`**: `id`, `tipo_producto`, `variante`, `talla_desde`,
  `talla_hasta` (null = aplica a todas las tallas), `insumo`, `cantidad`,
  `unidad` ('metros'/'unidad'), `costo_unitario`. Ver lógica de cálculo abajo.
- **`costos_referencia`**: `id`, `insumo`, `costo`. Hoja de referencia libre
  (sección "Costos" del menú) — el usuario agrega/edita/borra insumos a su
  gusto. **No está conectada** a `recetas_materiales` ni al cálculo
  automático de costos/utilidad; es solo para su propia consulta.
- **`gastos_lote`**: `id`, `lote_id` (FK, ON DELETE CASCADE), `insumo`,
  `monto`, `fecha`, `nota`. Registro de gastos REALES (ej. compras en
  Gamarra), siempre contra el lote activo — sección "Gastos" del menú. Esta sí
  se compara contra el costo estimado (suma de `items_pedido.costo_estimado`
  de TODO el lote, sin filtrar por estado) para mostrar la diferencia
  real vs. estimado.

## Lógica de negocio importante (no obvia leyendo el código)

- **Lote activo**: solo un lote tiene `activo = true`. Dashboard, formulario de
  pedido nuevo y tablero Kanban siempre usan `getLoteActivo()` — nunca asumir
  que el primero de la lista es el activo.
- **Numeración de lotes y pedidos**: NO se usa el `serial` de Postgres (nunca
  reutiliza números). Se calcula en el cliente como `MAX(numero) actual + 1`
  (`obtenerSiguienteNumeroLote`, `obtenerSiguienteNumeroPedido`). Así, si se
  borran todos los lotes, el siguiente vuelve a ser #1. `numero_pedido` se
  reinicia por lote (no es único globalmente — por eso el historial de Buscar
  muestra también la columna Lote).
- **Campos dinámicos del formulario** (`CAMPOS_POR_TIPO`): qué campos se
  muestran/ocultan según `tipo_producto` (talla, color, patrón, datos de
  mascota). Pijama y manta usan patrón (galería visual filtrada por
  perro/gato); polo y tote_bag piden datos de mascota en texto.
- **Corte de polo (clásico/princesa)**: solo aplica a pijama "Manga corta +
  short" y "Manga corta + pantalón" (`VARIANTES_CON_CORTE`). Mismo costo para
  ambos cortes (S/10 tallas S-L, S/13 talla XL) — el campo `corte` es puramente
  para desglosar la lista de compras, no afecta el cálculo de costos. Manga
  larga NO tiene corte.
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

## Gotcha crítico ya resuelto (no repetir el diagnóstico)

El CDN `@supabase/supabase-js@2` resuelve siempre a la última versión 2.x. En
algún momento esa librería empezó a declarar `var supabase` en el scope
global. Como el código propio también declaraba `const supabase = ...`, esto
causaba `SyntaxError: Identifier 'supabase' has already been declared` que
rompía TODO el script silenciosamente (sin mostrar el catch de error). Se
resolvió renombrando la variable del cliente a `sb` en TODO el archivo
(`const sb = window.supabase.createClient(...)`). Si alguna vez vuelve un
error similar de "ya declarado", sospechar primero de este tipo de colisión
con la librería del CDN, no de caché ni de Vercel.

## Convenciones de trabajo

- Antes de cambios de esquema (ALTER TABLE, tablas nuevas), dar el SQL al
  usuario para correr en el SQL Editor de Supabase — no tengo acceso DDL
  directo, solo REST con la key pública (sirve para INSERT/UPDATE/DELETE en
  tablas ya existentes).
- Después de cada cambio: commit + push a `main` (Vercel autodeploya), y
  verificar en el sitio real descargando el HTML servido o usando el Browser
  tool antes de dar por hecho que algo funciona.
- Si se crean datos de prueba (lotes/pedidos) para verificar algo, borrarlos
  al final y confirmar que no se tocó nada real del usuario.
- No inventar catálogo, precios, recetas de materiales ni reglas de negocio —
  preguntar antes si no está confirmado explícitamente por el usuario.

**OJO — no confundir estas tres tablas de "costo" que suenan parecido:**
`recetas_materiales` (estimado automático por producto), `costos_referencia`
(lista de precios suelta, sin conexión, solo consulta), `gastos_lote`
(registro real de gasto por lote, sí se compara contra el estimado). Si el
usuario pide algo de "costos" de nuevo, preguntar a cuál de las tres se
refiere antes de tocar código — ya pasó una vez que construí la que no era.

## Progreso (resumen de lo construido, más reciente arriba)

- **2026-07-14** — Nueva sección "Gastos": registro de gastos reales por
  lote (`gastos_lote`, siempre contra el lote activo), comparado contra el
  costo estimado por receta. Es la funcionalidad que el usuario realmente
  pedía cuando mencionó "Costos" — ver nota arriba.
- **2026-07-14** — Se agregó [`CLAUDE.md`](CLAUDE.md) (este archivo) para que
  cada sesión nueva arranque con el contexto completo del proyecto.
- **2026-07-14** — Nueva sección "Costos": hoja de referencia libre de
  insumos (`costos_referencia`), agregar/editar/borrar desde la app. Aparte
  del cálculo automático de `recetas_materiales`, solo para consulta propia.
- **2026-07-14** — Fix: la lista de compras mezclaba el desglose de
  talla/corte en insumos que no son polos (Confección, Impresión). Ahora el
  modal separa "Polos a comprar" (con desglose) de "Otros materiales" (simple).
- **2026-07-13** — Corte de polo (clásico/princesa) en pijama manga corta +
  botón "Ver lista de compras" en la tarjeta de materiales.
- **2026-07-13** — Numeración de lotes y pedidos recalculada como máximo+1 en
  vez de serial de Postgres (para que se reutilicen números tras borrar).
- **2026-07-13** — Cálculo automático de costos de materiales
  (`recetas_materiales`) y tarjeta "Materiales a comprar" con utilidad
  estimada en el Dashboard.
- **2026-07-13** — Fix: el tablero de "Ver Lote Activo" mostraba pedidos del
  lote anterior tras crear uno nuevo (usaba el select del formulario de
  pedidos en vez del lote activo real) + botón "Eliminar Lote".
- **2026-07-13** — Auditoría completa: catálogo real de productos, campos
  dinámicos por tipo, sección de Patrones con galería visual, lote activo,
  acordeón de lotes anteriores, rediseño visual cálido (crema/terracota),
  kanban accionable (avanzar estado, ver/editar, sin scroll horizontal,
  Entregado aparte), botón Guardar movido al final del formulario, eliminar
  pedido, historial completo en Buscar.
- **2026-07-13** — Diagnóstico y fix del bug de "Cargando..." infinito /
  `SyntaxError: Identifier 'supabase' has already been declared` (ver Gotcha
  crítico arriba). Migración completa a Supabase + GitHub + Vercel nuevos
  para descartar el problema del deploy viejo.
