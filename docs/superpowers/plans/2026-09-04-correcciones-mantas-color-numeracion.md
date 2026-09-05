# Correcciones: mantas, color y numeración de pedidos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ocultar Manta del formulario público, renombrar la familia de color "Gris" a "Negro/Grises" en
ambos formularios, y corregir de raíz el bug de numeración de pedidos (dos sistemas de numeración
distintos escribiendo en la misma columna `numero_pedido`), agregando además un formato de
visualización `N-L#` que combina el número de pedido con el número de lote.

**Architecture:** Cambios en 3 capas independientes: (1) un filtro de una línea en `pedido.html` para el
selector de tipo de producto; (2) un rename de string en la constante `PANTONERA`, duplicada en
`pedido.html` e `index.html`; (3) una función de Postgres (`preparar_pedido_web`, ya existente) que pasa
a calcular `numero_pedido` de forma atómica para TODOS los pedidos (no solo los web), más los cambios en
`index.html` para dejar de calcular ese número en el navegador y para mostrar el nuevo formato `N-L#`.

**Tech Stack:** HTML/CSS/JS vanilla (sin build), SQL (PL/pgSQL) en Supabase.

## Global Constraints

- No se toca `catalogo_productos` ni su columna `activo` para ocultar Manta — es un filtro en el
  `<select>` de `pedido.html` únicamente. `index.html` mantiene Manta disponible sin ningún cambio.
- Los 10 códigos de color (`G01`...`G10`) y sus valores hex de la familia renombrada NO cambian, solo el
  nombre visible de la familia.
- Ningún `numero_pedido` ya guardado en pedidos existentes se modifica — el arreglo de numeración solo
  afecta pedidos creados de aquí en adelante. No hay migración de datos.
- El nuevo formato `N-L#` es puramente de visualización en `index.html` — no reemplaza ni migra
  `numero_pedido` ni `lotes.numero` en la base de datos. `pedido.html` no lo usa (el cliente nunca ve
  `numero_pedido`).
- El SQL de la Tarea 3 se le entrega al usuario para correr en el SQL Editor de Supabase — no hay acceso
  DDL directo, solo se aplican los cambios de `index.html`/`pedido.html` directamente.
- Todo texto insertado vía `innerHTML` que venga de datos debe pasar por `escapeHtml()`
  (`index.html:4521`), igual que el resto del archivo — no aplica cambios nuevos de este tipo en este
  plan (los campos tocados aquí, `numero_pedido` y `numero de lote`, son siempre números, no texto
  libre).

---

### Task 1: Ocultar Manta en el selector de tipo de producto de `pedido.html`

**Files:**
- Modify: `pedido.html:324-325`

**Interfaces:**
- No expone ninguna función nueva — es un cambio inline en la construcción de `typeOptions`, variable
  local ya usada por el resto de `renderProductItem` (o la función donde vive este bloque).

- [ ] **Step 1: Filtrar "manta" de las opciones de tipo de producto**

En `pedido.html`, cambiar:

```js
            const typeOptions = [...new Set(catalog.map(c => c.tipo_producto))]
                .map(t => `<option value="${t}">${t === 'pijama' ? 'Pijamas' : t}</option>`).join('');
```

por:

```js
            const typeOptions = [...new Set(catalog.map(c => c.tipo_producto))]
                .filter(t => t !== 'manta')
                .map(t => `<option value="${t}">${t === 'pijama' ? 'Pijamas' : t}</option>`).join('');
```

- [ ] **Step 2: Verificar manualmente en el navegador**

Levantar un servidor estático local (`npx --yes serve -l 8811 .` desde la raíz del repo) y abrir
`http://localhost:8811/pedido.html`. Agregar un producto ("Agregar otro producto" si hace falta) y abrir
el `<select>` de "Tipo de producto": debe listar únicamente Pijamas, polo y tote_bag — sin ninguna
opción de manta. Confirmar que elegir cada uno de los tipos restantes sigue poblando el "Modelo"
correctamente (sin errores en consola).

- [ ] **Step 3: Commit**

```bash
git add pedido.html
git commit -m "$(cat <<'EOF'
Ocultar manta del selector de tipo de producto en pedido.html

Por el momento no se ofrecen mantas por el formulario publico. index.html
no cambia, sigue disponible ahi para registro manual si un cliente
insiste por chat.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Renombrar la familia de color "Gris" a "Negro/Grises"

**Files:**
- Modify: `pedido.html:215`
- Modify: `index.html:2495`

**Interfaces:**
- No cambia ninguna firma de función — `PANTONERA.G.nombre` es un string leído por el resto del código
  (selects de familia de color) sin cambios de estructura.

- [ ] **Step 1: Renombrar en `pedido.html`**

Cambiar:

```js
            G: { nombre: "Gris", colores: [
```

por:

```js
            G: { nombre: "Negro/Grises", colores: [
```

- [ ] **Step 2: Renombrar en `index.html`**

Mismo cambio, misma línea (`G: { nombre: "Gris", colores: [` → `G: { nombre: "Negro/Grises", colores: [`)
en `index.html:2495`.

- [ ] **Step 3: Verificar manualmente en el navegador**

Con el servidor estático local corriendo, abrir `pedido.html`, ir al selector de Color de un producto que
lo tenga (Pijama o Manta — aunque Manta ya no aparezca en el tipo, no hace falta probarlo ahí, con Pijama
alcanza), y confirmar que el combo de "Familia" ahora dice "Negro/Grises" en vez de "Gris", y que al
elegirla siguen apareciendo los 10 tonos de siempre. Repetir la misma verificación abriendo `index.html`
(requiere login) en el formulario de crear/editar pedido.

- [ ] **Step 4: Commit**

```bash
git add pedido.html index.html
git commit -m "$(cat <<'EOF'
Renombrar familia de color Gris a Negro/Grises

Clientes escribian pidiendo color negro sin darse cuenta de que esta
dentro de la familia de grises. Los codigos y valores hex no cambian,
solo el nombre visible de la familia, en los dos formularios.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Arreglo de fondo de la numeración de pedidos (SQL, Supabase)

**Files:**
- Ninguno en el repo — este SQL se le entrega al usuario para correr en el SQL Editor de Supabase (no
  hay acceso DDL directo). `supabase-functions/send-push/index.ts` no se toca, es una Edge Function
  distinta.

**Interfaces:**
- Produces: `preparar_pedido_web()` (función ya existente, `BEFORE INSERT` en `pedidos`) ahora también
  asigna `NEW.numero_pedido` para CUALQUIER pedido (no solo `origen = 'web'`), de forma atómica. La
  Tarea 4 (cambio en `index.html`) depende de que este paso ya esté aplicado en Supabase antes de
  quitar el cálculo del lado del cliente — si se hace en el orden contrario, un insert manual sin este
  arreglo aplicado insertaría con `numero_pedido = NULL` y fallaría por el `NOT NULL` de la columna.

- [ ] **Step 1: Confirmar con el usuario que ya corrió el SQL antes de continuar con la Tarea 4**

Pasarle este bloque completo para correr en el SQL Editor de Supabase, en una sola ejecución:

```sql
-- 1. preparar_pedido_web ahora calcula numero_pedido para TODOS los pedidos
-- (antes solo tocaba campos de pedidos origen='web' y nunca asignaba numero_pedido,
-- que dependia de un DEFAULT de secuencia global — la causa raiz del bug).
CREATE OR REPLACE FUNCTION public.preparar_pedido_web()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  lote_activo_id uuid;
BEGIN
  IF NEW.origen = 'web' THEN
    SELECT id INTO lote_activo_id FROM lotes WHERE activo = true LIMIT 1;
    IF lote_activo_id IS NULL THEN
      RAISE EXCEPTION 'NO_LOTE_ACTIVO';
    END IF;
    NEW.lote_id := lote_activo_id;
    NEW.codigo_pedido := 'PF-' || to_char(now(), 'YYMM') || '-' ||
      lpad(nextval('pedido_codigo_seq')::text, 3, '0');
    NEW.estado := 'Por confirmar';
    NEW.monto_pagado := 0;
    NEW.estado_pago := 'Pendiente';
  END IF;

  -- Bloquea la fila del lote hasta que termine esta transaccion, para que
  -- dos inserts al mismo lote (de cualquier origen, simultaneos o no) no
  -- puedan calcular el mismo numero_pedido.
  PERFORM 1 FROM lotes WHERE id = NEW.lote_id FOR UPDATE;

  SELECT COALESCE(MAX(numero_pedido), 0) + 1 INTO NEW.numero_pedido
  FROM pedidos
  WHERE lote_id = NEW.lote_id;

  RETURN NEW;
END;
$function$;

-- 2. Ya no hace falta el DEFAULT de secuencia global — el trigger de arriba
-- asigna numero_pedido siempre, para cualquier origen. La secuencia
-- pedidos_numero_pedido_seq queda huerfana (no se borra, solo se desconecta
-- de la columna).
ALTER TABLE pedidos ALTER COLUMN numero_pedido DROP DEFAULT;
```

Esperar confirmación explícita del usuario de que lo corrió sin errores antes de pasar a la Tarea 4 —
si `index.html` deja de mandar `numero_pedido` en el insert ANTES de que este SQL esté aplicado, los
pedidos manuales nuevos fallarían (la columna es `NOT NULL` y ya no tendrían ni el cálculo del cliente
ni el del trigger).

- [ ] **Step 2: Verificar con una prueba real mínima**

Pedirle al usuario (o hacerlo uno mismo si se tiene acceso autenticado) crear dos pedidos de prueba
seguidos en el mismo lote desde `index.html` (ambos manuales, el caso más fácil de reproducir sin
necesitar el formulario web) y confirmar en el SQL Editor:

```sql
SELECT id, numero_pedido, lote_id, origen, created_at
FROM pedidos
WHERE cliente_nombre ILIKE '%PRUEBA%'
ORDER BY created_at DESC
LIMIT 5;
```

Expected: los dos pedidos de prueba tienen `numero_pedido` consecutivos y distintos (nunca el mismo
valor), y ninguno salta a un número enorme heredado de la vieja secuencia global. Borrar los pedidos de
prueba después de confirmar.

---

### Task 4: `index.html` — dejar de calcular `numero_pedido` en el cliente

**Files:**
- Modify: `index.html:2908-2911` (eliminar la función completa)
- Modify: `index.html:4737-4740` (quitar la línea que la llama)

**Interfaces:**
- Consumes: el arreglo de Supabase de la Tarea 3 (`preparar_pedido_web` ahora asigna `numero_pedido`
  siempre) — **no aplicar esta tarea antes de confirmar que la Tarea 3 ya se corrió**.
- Produces: el flujo de guardado de pedido (`saveOrder` o como se llame la función que contiene este
  bloque) ya no incluye `numero_pedido` en el payload de insert — Supabase lo asigna solo.

- [ ] **Step 1: Eliminar `obtenerSiguienteNumeroPedido`**

En `index.html`, eliminar esta función completa (línea 2908 en adelante):

```js
        async function obtenerSiguienteNumeroPedido(loteId) {
            const { data, error } = await sb.from('pedidos').select('numero_pedido').eq('lote_id', loteId).order('numero_pedido', { ascending: false }).limit(1);
            if (error) throw error;
            return (data && data.length > 0) ? data[0].numero_pedido + 1 : 1;
        }
```

(`obtenerSiguienteNumeroLote`, la función justo arriba de esta, **no se toca** — sigue siendo necesaria
para numerar lotes nuevos, que es un problema distinto sin el bug de esta tarea.)

- [ ] **Step 2: Quitar la línea que la llama**

Cambiar:

```js
                if(!isUpdate) {
                    pedidoData.fecha_pedido = new Date().toISOString().split('T')[0];
                    pedidoData.numero_pedido = await obtenerSiguienteNumeroPedido(pedidoData.lote_id);
                }
```

por:

```js
                if(!isUpdate) {
                    pedidoData.fecha_pedido = new Date().toISOString().split('T')[0];
                }
```

- [ ] **Step 3: Verificar que no queda ninguna referencia**

```bash
grep -n "obtenerSiguienteNumeroPedido" index.html
```

Expected: sin resultados (0 coincidencias).

- [ ] **Step 4: Verificar manualmente creando un pedido real**

Con sesión iniciada en `index.html` (local o el sitio real, según lo que esté disponible), crear un
pedido manual de prueba. Expected: se guarda sin error, y al abrir su resumen tiene un `numero_pedido`
asignado (no vacío ni `null`) — confirma que el trigger de la Tarea 3 lo asignó correctamente sin que el
cliente lo mandara. Borrar el pedido de prueba después.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
Dejar de calcular numero_pedido en el cliente

obtenerSiguienteNumeroPedido calculaba MAX+1 por lote en el navegador,
en paralelo a la secuencia global que usaban los pedidos web — dos
sistemas de numeracion distintos escribiendo en la misma columna, causa
raiz de pedidos con el mismo numero dentro del mismo lote. Ahora
preparar_pedido_web (Supabase) asigna numero_pedido para cualquier
origen, de forma atomica.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Formato de visualización "N-L#" en `index.html`

**Files:**
- Modify: `index.html:2611-2614` (agregar helper `formatNumeroPedido` junto a `formatCorte`)
- Modify: `index.html:3798-3812` (firmas de `renderOrderCard`/`renderProductCard` + línea del badge)
- Modify: `index.html:3663-3676` (call sites en `loadLoteView`, pasar `loteActivo.numero`)
- Modify: `index.html:3770-3772` (call site en `toggleLoteAccordion`, pasar el `numero` del lote)
- Modify: `index.html:3971-3974` (`renderSearchResults`, ya tiene `p.lotes.numero` disponible)
- Modify: `index.html:4135-4139` y `4152` (`editOrder`, agregar el join y usar el helper)
- Modify: `index.html:4045-4070` (`verResumenPedido`, agregar el join y usar el helper)

**Interfaces:**
- Produces: `formatNumeroPedido(numeroPedido, numeroLote)` → `string | null`. Devuelve `"39-L5"` si hay
  `numeroLote`, `"39"` si no lo hay (pedidos huérfanos sin lote, caso raro), o `null` si no hay
  `numeroPedido` — quien lo llama decide el fallback visual (`'?'`, `'-'`, `''`, como ya hacía cada sitio
  antes de este cambio).
- Consumes: nada nuevo — usa los mismos `numero_pedido` y `lotes.numero` que ya existen.

- [ ] **Step 1: Agregar el helper `formatNumeroPedido`**

En `index.html`, inmediatamente después de `formatCorte` (`index.html:2611-2614`), agregar:

```js
        function formatNumeroPedido(numeroPedido, numeroLote) {
            if (!numeroPedido) return null;
            return numeroLote ? `${numeroPedido}-L${numeroLote}` : `${numeroPedido}`;
        }
```

- [ ] **Step 2: Pasar el número de lote a `renderOrderCard`/`renderProductCard`**

En `index.html`, cambiar las firmas (`index.html:3798` y `3812`):

```js
        function renderOrderCard(p) {
```

por:

```js
        function renderOrderCard(p, loteNumero) {
```

Dentro de `renderOrderCard`, sus dos `return renderProductCard(...)` (uno para pedidos sin items, otro
en el `.map`) deben pasar `loteNumero` también:

```js
                return renderProductCard(p, null, 1, 1, loteNumero);
```

```js
            return items.map((item, idx) => renderProductCard(p, item, idx + 1, items.length, loteNumero)).join('');
```

Y la firma de `renderProductCard`:

```js
        function renderProductCard(p, item, posicion, total) {
```

por:

```js
        function renderProductCard(p, item, posicion, total, loteNumero) {
```

Dentro de `renderProductCard`, cambiar la línea del badge de número (`index.html:3858`):

```js
                    <span class="order-num-badge">#${p.numero_pedido || '?'}</span>
```

por:

```js
                    <span class="order-num-badge">#${formatNumeroPedido(p.numero_pedido, loteNumero) || '?'}</span>
```

- [ ] **Step 3: Pasar `loteActivo.numero` desde `loadLoteView`**

En `index.html`, dentro de la función que contiene `currentLoteId = getLoteActivo().id;` (`index.html:3639`),
cambiar las dos líneas que llaman a `renderOrderCard` (`index.html:3673` y `3676`):

```js
            document.getElementById('items-activos').innerHTML = activos.length > 0
                ? activos.map(p => renderOrderCard(p)).join('')
                : '<p style="color: var(--text-muted);">No hay pedidos activos en este lote.</p>';

            document.getElementById('items-entregado').innerHTML = entregados.map(p => renderOrderCard(p)).join('');
```

por:

```js
            const loteNumeroActual = getLoteActivo().numero;

            document.getElementById('items-activos').innerHTML = activos.length > 0
                ? activos.map(p => renderOrderCard(p, loteNumeroActual)).join('')
                : '<p style="color: var(--text-muted);">No hay pedidos activos en este lote.</p>';

            document.getElementById('items-entregado').innerHTML = entregados.map(p => renderOrderCard(p, loteNumeroActual)).join('');
```

- [ ] **Step 4: Pasar el número de lote desde `toggleLoteAccordion`**

En `index.html`, dentro de `toggleLoteAccordion(loteId)` (`index.html:3742`), cambiar:

```js
            body.innerHTML = pedidos.length === 0
                ? '<p style="color: var(--text-muted);">Sin pedidos en este lote.</p>'
                : `<div class="kanban-items-grid">${pedidos.map(p => renderOrderCard(p)).join('')}</div>`;
```

por:

```js
            const loteInfo = activeLotes.find(l => l.id === loteId);
            const loteNumeroAccordion = loteInfo ? loteInfo.numero : null;

            body.innerHTML = pedidos.length === 0
                ? '<p style="color: var(--text-muted);">Sin pedidos en este lote.</p>'
                : `<div class="kanban-items-grid">${pedidos.map(p => renderOrderCard(p, loteNumeroAccordion)).join('')}</div>`;
```

- [ ] **Step 5: Usar el helper en `renderSearchResults`**

En `index.html`, dentro de `renderSearchResults` (`index.html:3974`), cambiar:

```js
                    <td>#${p.numero_pedido || '-'}</td>
```

por:

```js
                    <td>#${formatNumeroPedido(p.numero_pedido, p.lotes ? p.lotes.numero : null) || '-'}</td>
```

(La consulta de `loadSearchHistorial`/`handleSearch` ya trae `lotes(numero)` en el `select`, no hace
falta tocar la query.)

- [ ] **Step 6: Usar el helper en `editOrder`**

En `index.html`, dentro de `editOrder(id)` (`index.html:4135-4139`), cambiar:

```js
            const { data: pedido, error: errorPedido } = await sb
                .from('pedidos')
                .select('*')
                .eq('id', id)
                .single();
```

por:

```js
            const { data: pedido, error: errorPedido } = await sb
                .from('pedidos')
                .select('*, lotes(numero)')
                .eq('id', id)
                .single();
```

Y la línea del título (`index.html:4152`):

```js
            document.getElementById('form-title').innerText = `Editando Pedido #${pedido.numero_pedido || ''}`;
```

por:

```js
            document.getElementById('form-title').innerText = `Editando Pedido #${formatNumeroPedido(pedido.numero_pedido, pedido.lotes ? pedido.lotes.numero : null) || ''}`;
```

- [ ] **Step 7: Usar el helper en `verResumenPedido`**

En `index.html`, dentro de `verResumenPedido(id)` (`index.html:4045-4048`), cambiar:

```js
                const { data: pedido, error } = await sb.from('pedidos').select('*').eq('id', id).single();
```

por:

```js
                const { data: pedido, error } = await sb.from('pedidos').select('*, lotes(numero)').eq('id', id).single();
```

Y el título del modal (`index.html:4070`):

```js
                        <h2>#${pedido.numero_pedido || '?'} — ${escapeHtml(pedido.cliente_nombre)}</h2>
```

por:

```js
                        <h2>#${formatNumeroPedido(pedido.numero_pedido, pedido.lotes ? pedido.lotes.numero : null) || '?'} — ${escapeHtml(pedido.cliente_nombre)}</h2>
```

- [ ] **Step 8: Verificar manualmente contra Supabase real**

Con sesión iniciada en `index.html` (requiere datos reales, no hay forma de simular esto con mocks —
depende de `lotes.numero` real): abrir el tablero de "Lote Activo" y confirmar que las tarjetas ahora
muestran `#N-L#` en vez de solo `#N`. Abrir "Lotes anteriores" y expandir un acordeón: mismo formato ahí.
Ir a "Buscar Pedidos" y confirmar el mismo formato en la columna de número. Abrir el resumen de un
pedido cualquiera (click en una tarjeta o una fila de Buscar): el título del modal debe mostrar
`#N-L# — Nombre del cliente`. Editar ese mismo pedido: el título del formulario debe decir
`Editando Pedido #N-L#`.

- [ ] **Step 9: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
Mostrar numero_pedido combinado con el lote (formato N-L#)

Agrega formatNumeroPedido() y lo usa en Lote Activo, Lotes anteriores,
Buscar Pedidos, el resumen del pedido y el titulo al editar. Puramente
visual, no migra ni reemplaza numero_pedido ni lotes.numero.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Verificación end-to-end real y publicación

**Files:**
- No se modifica código en esta tarea — solo verificación y push.

- [ ] **Step 1: Confirmar que las Tareas 1-5 quedaron aplicadas en orden (3 antes que 4)**

```bash
git log --oneline -6
```

Expected: ver los 5 commits de este plan (Tareas 1, 2, 4, 5 — la Tarea 3 no genera commit en el repo, es
SQL corrido directo en Supabase) y confirmar con el usuario que el SQL de la Tarea 3 ya está aplicado.

- [ ] **Step 2: Prueba real combinando manual + web en el mismo lote**

Crear un pedido de prueba manual en `index.html` (lote activo actual) y, justo después, un pedido de
prueba real desde `pedido.html` apuntando al mismo entorno (local contra Supabase real, o directo en
producción). Confirmar en Supabase que ambos quedaron con `numero_pedido` distintos y consecutivos
dentro de ese lote:

```sql
SELECT id, numero_pedido, origen, created_at
FROM pedidos
WHERE lote_id = (SELECT id FROM lotes WHERE activo = true LIMIT 1)
ORDER BY numero_pedido DESC
LIMIT 5;
```

Borrar ambos pedidos de prueba después de confirmar (el manual directo, el web desde "Por Confirmar" en
`index.html`).

- [ ] **Step 3: Push a producción**

```bash
git push origin main
```

- [ ] **Step 4: Verificar en el sitio real**

Esperar el deploy de Vercel (~1 minuto) y repetir una verificación rápida contra
`https://registro-pedidos-pf.vercel.app/`: confirmar que Manta no aparece en `pedido.html`, que la
familia de color dice "Negro/Grises" en ambos formularios, y que el formato `N-L#` se ve en el Lote
Activo y en Buscar Pedidos con datos reales (sin crear pedidos de prueba adicionales si el Paso 2 ya
dejó evidencia suficiente). Además, confirmar en `index.html` (formulario de crear/editar pedido) que
Manta **sigue** apareciendo en el `<select>` de tipo de producto — este archivo no se tocó en la Tarea
1 a propósito, pero vale la pena confirmarlo una vez con el sitio real antes de cerrar el plan.
