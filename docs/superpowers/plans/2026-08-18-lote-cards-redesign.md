# Rediseño de tarjetas de pedido (Lote Activo) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar `renderOrderCard` en [index.html](../../../index.html) para que muestre una tarjeta por
producto (no por pedido) en el tablero de "Lote Activo", agregando color, corte, patrón y un indicador de
observaciones sin agrandar el tamaño de la tarjeta actual.

**Architecture:** App de un solo archivo (`index.html`, vanilla JS + Supabase, sin build step). Todo el
trabajo son ediciones dentro de ese archivo: CSS nuevo, helpers JS nuevos, reescritura de una función de
render, dos queries de Supabase ampliadas, y un `ALTER TABLE` manual en Supabase.

**Tech Stack:** HTML/CSS/JS vanilla, `@supabase/supabase-js@2` (cliente `sb`), FontAwesome 6.4, fuentes
Fraunces/Poppins.

## Global Constraints

- Un solo archivo `index.html` — no crear archivos nuevos ni introducir un build step.
- No hay framework de tests automatizados en este proyecto. La verificación de cada tarea es manual, contra
  el Supabase real (`https://zafgoegngcqsswzzxcen.supabase.co`, key pública `sb_publishable_xmTh0DSBcGFF_0ZBb2ePcQ_Ktv8gKUB`)
  vía navegador (`file://` local o el sitio desplegado) o `curl` contra el REST de PostgREST.
- No tengo acceso DDL directo a Supabase — cualquier `ALTER TABLE` se le da al usuario para correr en el
  SQL Editor, nunca se ejecuta solo.
- Toda variable/color/tipografía nueva debe usar las variables CSS ya definidas en `:root` (ver
  `index.html:21-51`) — no colores planos sueltos salvo la paleta nueva de "color de grupo" (justificada en
  el spec por no chocar con los semánticos existentes).
- No se toca la lógica de negocio (cálculo de costos, pago automático al Entregar, numeración de
  lotes/pedidos, etc.) — spec completo en
  [docs/superpowers/specs/2026-08-18-lote-cards-redesign-design.md](../specs/2026-08-18-lote-cards-redesign-design.md).
- Antes del `git push` final a `main` (Vercel autodeploya), confirmar explícitamente con el usuario que
  quiere desplegar ahora — es una app de producción que usan 2 personas activamente.
- Si se crean pedidos/lotes de prueba para verificar algo, deben quedar identificados claramente (ej.
  cliente "ZZZ PRUEBA PLAN — BORRAR") y **borrarse al final**, confirmando después que ya no existen.

---

### Task 1: Columna `orden` en `items_pedido`

**Files:**
- Ninguno en el repo (cambio de esquema en Supabase, fuera de git)

**Interfaces:**
- Produces: columna `items_pedido.orden` (integer, nullable) — usada por Task 3 (se escribe al guardar) y
  Task 5/6 (se lee para numerar y ordenar las tarjetas).

- [ ] **Step 1: Dar el SQL al usuario**

Pegar este bloque en el chat y pedirle que lo corra en el SQL Editor de Supabase (Dashboard → SQL Editor):

```sql
ALTER TABLE items_pedido ADD COLUMN orden integer;
```

Esperar confirmación del usuario de que lo corrió antes de continuar.

- [ ] **Step 2: Verificar que la columna existe**

```bash
curl -s "https://zafgoegngcqsswzzxcen.supabase.co/rest/v1/items_pedido?select=orden&limit=1" \
  -H "apikey: sb_publishable_xmTh0DSBcGFF_0ZBb2ePcQ_Ktv8gKUB" \
  -H "Authorization: Bearer sb_publishable_xmTh0DSBcGFF_0ZBb2ePcQ_Ktv8gKUB"
```

Expected: una respuesta JSON tipo `[{"orden":null}]` (o `[]` si la tabla está vacía). Si en cambio devuelve
un error `{"code":"42703",...column "orden" does not exist...}`, la columna no se creó — avisar al usuario
y no continuar con el resto del plan hasta que exista.

- [ ] **Step 3: Commit**

No hay cambios de archivo que commitear en esta tarea (es un cambio solo en Supabase). Saltar al Task 2.

---

### Task 2: Helpers nuevos (color de grupo, corte, patrón)

**Files:**
- Modify: `index.html` (agregar funciones nuevas justo después de `renderColorResumen`, alrededor de la
  línea 2404 — busca el texto `// Campos visibles por tipo de producto` y agrega el bloque nuevo justo
  antes de esa línea)

**Interfaces:**
- Consumes: `PANTONERA` / `buscarColorPorCodigo(codigo)` (ya existen, `index.html:2242` y `index.html:2389`),
  `patterns` (array global ya cargado por `loadPatterns()`, `index.html:2211` y `index.html:2575`).
- Produces:
  - `colorGrupoPedido(pedidoId: string): string` — devuelve un hex de una paleta fija de 6 colores,
    determinístico según el id del pedido.
  - `formatCorte(corte: string|null): string` — `'clasico'` → `'Clásico'`, `'princesa'` → `'Princesa'`,
    falsy → `''`.
  - `resolvePatronImagen(nombrePatron: string|null): string|null` — busca en `patterns` por `nombre` y
    devuelve `imagen_url`, o `null` si no hay match.
  - Usados por Task 5 (`renderProductCard`).

- [ ] **Step 1: Agregar las funciones**

Ubicar este bloque existente en `index.html` (justo antes de `const CAMPOS_POR_TIPO`):

```javascript
        // Campos visibles por tipo de producto
        const CAMPOS_POR_TIPO = {
```

Insertar el siguiente bloque nuevo justo arriba de ese comentario:

```javascript
        // Paleta fija para "amarrar" visualmente tarjetas del mismo pedido cuando tiene 2+ productos.
        // Tonos frios a proposito, para no chocar con los colores semanticos del semaforo de estado
        // (--danger/--gold/--accent/--success/--estado-listo son todos calidos).
        const GRUPO_COLORES = ['#5B7FBD', '#8A6FB0', '#4FA6A6', '#C77DA0', '#6FA8DC', '#9B8AC4'];

        function colorGrupoPedido(pedidoId) {
            let hash = 0;
            for (let i = 0; i < pedidoId.length; i++) {
                hash = (hash * 31 + pedidoId.charCodeAt(i)) >>> 0;
            }
            return GRUPO_COLORES[hash % GRUPO_COLORES.length];
        }

        function formatCorte(corte) {
            if (!corte) return '';
            return corte === 'princesa' ? 'Princesa' : 'Clásico';
        }

        function resolvePatronImagen(nombrePatron) {
            if (!nombrePatron) return null;
            const encontrado = patterns.find(p => p.nombre === nombrePatron);
            return encontrado ? encontrado.imagen_url : null;
        }

```

- [ ] **Step 2: Verificar en el navegador (consola)**

Abrir `index.html` local en el Browser tool (`file:///C:/Users/User/OneDrive - Universidad ESAN/Escritorio/PROYECTOS APPWEB/MANEJO DE PEDIDOS/index.html`),
esperar a que cargue (para que `patterns` se llene desde Supabase), y correr en la consola vía
`javascript_tool`:

```javascript
[
  colorGrupoPedido('11111111-1111-1111-1111-111111111111'),
  colorGrupoPedido('22222222-2222-2222-2222-222222222222'),
  formatCorte('princesa'),
  formatCorte('clasico'),
  formatCorte(null),
  resolvePatronImagen('no-existe-este-patron'),
  patterns.length > 0 ? resolvePatronImagen(patterns[0].nombre) : 'sin patrones cargados'
]
```

Expected: un array con 2 hex distintos de `GRUPO_COLORES`, `'Princesa'`, `'Clásico'`, `''`, `null`, y (si hay
patrones) la `imagen_url` real del primer patrón (una URL de Supabase Storage, no `null`).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "Agregar helpers de color de grupo, corte y patron para tarjetas de pedido"
```

---

### Task 3: `saveOrder` guarda el campo `orden`

**Files:**
- Modify: `index.html:4360-4376` (dentro de `saveOrder`, el `itemsToInsert.push({...})`)

**Interfaces:**
- Consumes: `i` (índice del loop `for(let i=0; i<productDivs.length; i++)`, ya existe en `saveOrder`).
- Produces: cada fila insertada en `items_pedido` trae `orden = i + 1`. Usado por Task 5/6 para ordenar y
  numerar las tarjetas.

- [ ] **Step 1: Agregar el campo al objeto insertado**

Ubicar en `index.html` (dentro de `saveOrder`, ~línea 4360):

```javascript
                    itemsToInsert.push({
                        pedido_id: savedPedidoId,
                        tipo_producto: itemTipoProducto,
                        variante: itemVariante,
                        talla: itemTalla,
                        color: document.getElementById(`${prodId}_color`).value,
                        patron: document.getElementById(`${prodId}_patron`).value,
                        tipo_mascota: tipoMascotaEl ? tipoMascotaEl.value : null,
                        corte: (aplicaCorte && corteEl) ? corteEl.value : null,
                        nombre_mascota: document.getElementById(`${prodId}_mascota`).value,
                        año_nacimiento_mascota: document.getElementById(`${prodId}_ano`).value,
                        raza_o_frase: document.getElementById(`${prodId}_raza`).value,
                        precio_unitario: document.getElementById(`${prodId}_precio`).value,
                        observaciones: document.getElementById(`${prodId}_obs`).value,
                        fotos: allPhotos,
                        costo_estimado: calcularCostoProducto(itemTipoProducto, itemVariante, itemTalla)
                    });
```

Reemplazar por (única diferencia: la línea `orden: i + 1,` agregada):

```javascript
                    itemsToInsert.push({
                        pedido_id: savedPedidoId,
                        tipo_producto: itemTipoProducto,
                        variante: itemVariante,
                        talla: itemTalla,
                        color: document.getElementById(`${prodId}_color`).value,
                        patron: document.getElementById(`${prodId}_patron`).value,
                        tipo_mascota: tipoMascotaEl ? tipoMascotaEl.value : null,
                        corte: (aplicaCorte && corteEl) ? corteEl.value : null,
                        nombre_mascota: document.getElementById(`${prodId}_mascota`).value,
                        año_nacimiento_mascota: document.getElementById(`${prodId}_ano`).value,
                        raza_o_frase: document.getElementById(`${prodId}_raza`).value,
                        precio_unitario: document.getElementById(`${prodId}_precio`).value,
                        observaciones: document.getElementById(`${prodId}_obs`).value,
                        fotos: allPhotos,
                        costo_estimado: calcularCostoProducto(itemTipoProducto, itemVariante, itemTalla),
                        orden: i + 1
                    });
```

- [ ] **Step 2: Crear un pedido de prueba real a través del formulario**

Con el Browser tool, abrir `index.html` local, ir a "Nuevo Pedido" y crear un pedido con estos datos
exactos (los vamos a reutilizar en las Tasks 5, 6 y 7 — no lo borres todavía):

- Cliente: `ZZZ PRUEBA PLAN — BORRAR`
- Canal: cualquiera
- Lote: el lote activo
- Producto 1: Pijama, variante "Manga corta + short", talla M, corte Clásico, cualquier color de la
  pantonera, cualquier patrón de perro o gato disponible, precio 95, en Observaciones escribir
  `obs de prueba item 1`
- Producto 2: Pijama, variante "Manga larga + pantalón", talla S, cualquier color distinto al del
  producto 1, sin patrón (dejarlo vacío si el formulario lo permite, o elegir uno igual si es obligatorio),
  precio 119, sin observaciones

Guardar el pedido.

- [ ] **Step 3: Verificar que `orden` se guardó como 1 y 2**

```bash
curl -s "https://zafgoegngcqsswzzxcen.supabase.co/rest/v1/items_pedido?select=orden,tipo_producto,variante&order=orden.asc" \
  -H "apikey: sb_publishable_xmTh0DSBcGFF_0ZBb2ePcQ_Ktv8gKUB" \
  -H "Authorization: Bearer sb_publishable_xmTh0DSBcGFF_0ZBb2ePcQ_Ktv8gKUB" \
  | python3 -m json.tool
```

Buscar en la salida las 2 filas del pedido recién creado (por `variante` "Manga corta + short" y
"Manga larga + pantalón") y confirmar que sus valores de `orden` son `1` y `2` respectivamente.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Guardar columna orden al insertar productos de un pedido"
```

---

### Task 4: CSS nuevo para la tarjeta rediseñada

**Files:**
- Modify: `index.html:782-891` (bloque de estilos `.order-card` y relacionados)
- Modify: `index.html:1564-1573` (media query móvil, dentro del bloque de estilos del kanban)

**Interfaces:**
- Produces: clases CSS nuevas (`order-card-group-strip`, `order-card-fraction`, `order-client-eye`,
  `order-num-badge`, `order-chip`, `order-chip-corte`, `order-chip-color`, `order-chip-patron`,
  `order-footer-row`, `order-saldo`, `order-canal-icon`) consumidas por Task 5.

- [ ] **Step 1: Reemplazar el bloque de estilos de la tarjeta**

Ubicar en `index.html` este bloque completo (empieza en `.order-card {`, ~línea 782, termina en
`.card-action-btn:hover { background: var(--border-strong); }`, ~línea 891):

```css
        .order-card {
            background-color: var(--card-bg);
            padding: 1rem;
            border-radius: var(--border-radius-sm);
            margin-bottom: 0.75rem;
            cursor: pointer;
            border-left: 4px solid transparent;
            box-shadow: var(--shadow-sm);
            transition: var(--transition);
        }

        .order-card:hover {
            transform: translateY(-3px);
            box-shadow: var(--shadow-lifted);
        }

        .order-card.urgente {
            border-left-color: var(--danger);
        }

        .order-card-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.5rem;
            font-size: 0.85rem;
        }

        .order-client {
            font-weight: 600;
        }

        .order-details {
            font-size: 0.78rem;
            color: var(--text-muted);
            line-height: 1.35;
        }

        .order-info-row {
            display: flex;
            gap: 10px;
            align-items: center;
        }

        .order-photo-wrap {
            width: 72px;
            height: 72px;
            border-radius: var(--border-radius-sm);
            overflow: hidden;
            flex-shrink: 0;
            background: var(--card-secondary);
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-faint);
            font-size: 1.4rem;
        }

        .order-photo-wrap img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .order-info-text {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .order-meta-row {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }

        .order-talla-badge {
            background: var(--card-secondary);
            color: var(--text-dark);
            font-size: 0.7rem;
            font-weight: 700;
            padding: 2px 9px;
            border-radius: var(--border-radius-pill);
            flex-shrink: 0;
        }

        .order-card-actions {
            display: flex;
            gap: 6px;
            margin-top: 10px;
        }

        .card-action-btn {
            flex: 1;
            background: var(--card-secondary);
            border: none;
            color: var(--text-dark);
            padding: 6px 8px;
            border-radius: var(--border-radius-sm);
            font-size: 0.72rem;
            font-weight: 600;
            cursor: pointer;
            transition: var(--transition);
        }

        .card-action-btn:hover {
            background: var(--border-strong);
        }
```

Reemplazarlo completo por:

```css
        .order-card {
            background-color: var(--card-bg);
            padding: 1rem;
            border-radius: var(--border-radius-sm);
            margin-bottom: 0.75rem;
            cursor: pointer;
            border-left: 4px solid transparent;
            box-shadow: var(--shadow-sm);
            transition: var(--transition);
            position: relative;
            overflow: hidden;
        }

        .order-card:hover {
            transform: translateY(-3px);
            box-shadow: var(--shadow-lifted);
        }

        .order-card.urgente {
            border-left-color: var(--danger);
        }

        /* Franja + pastilla: solo quando el pedido tiene 2+ productos (ver colorGrupoPedido) */
        .order-card-group-strip {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
        }

        .order-card-fraction {
            position: absolute;
            top: 10px;
            right: 12px;
            background: var(--accent-gradient);
            color: #fff;
            font-size: 0.62rem;
            font-weight: 700;
            padding: 3px 9px;
            border-radius: var(--border-radius-pill);
            box-shadow: 0 2px 5px rgba(196, 82, 42, 0.35);
        }

        .order-card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.5rem;
            font-size: 0.85rem;
        }

        .order-client {
            font-family: var(--font-display);
            font-weight: 600;
            font-size: 0.92rem;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .order-client-eye {
            color: #fff;
            background: var(--danger);
            width: 16px;
            height: 16px;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 0.58rem;
            flex-shrink: 0;
        }

        .order-num-badge {
            font-weight: 700;
            color: var(--accent-dark);
            font-size: 0.72rem;
            background: var(--card-secondary);
            padding: 2px 8px;
            border-radius: var(--border-radius-pill);
        }

        .order-details {
            font-size: 0.78rem;
            color: var(--text-muted);
            line-height: 1.35;
        }

        .order-info-row {
            display: flex;
            gap: 10px;
            align-items: center;
        }

        .order-photo-wrap {
            width: 72px;
            height: 72px;
            border-radius: var(--border-radius-sm);
            overflow: hidden;
            flex-shrink: 0;
            background: var(--card-secondary);
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-faint);
            font-size: 1.4rem;
        }

        .order-photo-wrap img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .order-info-text {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .order-meta-row {
            display: flex;
            align-items: center;
            gap: 5px;
            flex-wrap: wrap;
        }

        .order-chip {
            background: var(--card-secondary);
            color: var(--text-dark);
            font-size: 0.66rem;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 8px;
            flex-shrink: 0;
            display: inline-flex;
            align-items: center;
            gap: 5px;
        }

        .order-chip-corte {
            background: var(--gold-soft);
            color: var(--accent-dark);
        }

        .order-chip-color .swatch {
            width: 12px;
            height: 12px;
            border-radius: 4px;
            box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.08);
            flex-shrink: 0;
        }

        .order-chip-patron {
            padding: 2px 8px 2px 2px;
        }

        .order-chip-patron img {
            width: 18px;
            height: 18px;
            border-radius: 5px;
            object-fit: cover;
            flex-shrink: 0;
        }

        .order-footer-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 0.6rem;
            padding-top: 0.55rem;
            border-top: 1px solid var(--border);
        }

        .order-saldo {
            font-size: 0.72rem;
            font-weight: 700;
            color: var(--danger);
        }

        .order-saldo.pagado {
            color: var(--success);
        }

        .order-canal-icon {
            width: 22px;
            height: 22px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--card-secondary);
            color: var(--text-muted);
            font-size: 0.72rem;
            flex-shrink: 0;
        }
```

- [ ] **Step 2: Actualizar el media query móvil**

Ubicar en `index.html` (~línea 1563):

```css
            /* Tarjetas del kanban: mas compactas y botones un poco mas grandes para el dedo */
            .order-card {
                padding: 0.75rem;
            }
            .order-card-header {
                margin-bottom: 0.4rem;
            }
            .card-action-btn {
                padding: 9px 8px;
                font-size: 0.78rem;
            }
```

Reemplazar por (se quita la regla de `.card-action-btn`, que ya no existe):

```css
            /* Tarjetas del kanban: mas compactas en pantalla chica */
            .order-card {
                padding: 0.75rem;
            }
            .order-card-header {
                margin-bottom: 0.4rem;
            }
```

- [ ] **Step 3: Verificar visualmente que no rompió nada todavía**

Abrir `index.html` local en el Browser tool, ir a "Lote Activo". Las tarjetas existentes se verán igual
que antes (las clases nuevas todavía no se usan en el HTML — eso es Task 5), solo confirmar que no hay
errores de consola ni de layout roto por el CSS nuevo.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Agregar estilos nuevos para tarjetas de pedido rediseñadas"
```

---

### Task 5: Reescribir `renderOrderCard` — una tarjeta por producto

**Files:**
- Modify: `index.html:3383-3431` (función `renderOrderCard` completa)

**Interfaces:**
- Consumes: `colorGrupoPedido`, `formatCorte`, `resolvePatronImagen` (Task 2), `buscarColorPorCodigo`
  (ya existente), clases CSS de Task 4, `renderEstadoStepper` (ya existente, sin cambios).
- Produces: `renderOrderCard(p)` sigue teniendo la misma firma (recibe un pedido `p` con `p.items_pedido`)
  y sigue devolviendo un string HTML — los llamadores existentes (`activos.map(p => renderOrderCard(p))`,
  etc. en `index.html:3261-3265` y `3360`) no necesitan cambiar. La diferencia es que el string ahora puede
  contener 2+ `<div class="order-card">` en vez de 1.
- Nueva función interna `renderProductCard(p, item, posicion, total)` — no se usa fuera de esta tarea.

- [ ] **Step 1: Reemplazar la función**

Ubicar en `index.html` el bloque completo de `renderOrderCard` (~línea 3383 a 3431):

```javascript
        function renderOrderCard(p) {
            // Foto (la primera que haya), detalle tipo+variante por item (sin repetir), y tallas distintas
            let photoUrl = '';
            const detalles = [];
            const tallas = [];
            if(p.items_pedido && p.items_pedido.length > 0) {
                p.items_pedido.forEach(item => {
                    if(item.tipo_producto) {
                        const label = item.tipo_producto + (item.variante ? ' — ' + item.variante : '');
                        if(!detalles.includes(label)) detalles.push(label);
                    }
                    if(item.talla && !tallas.includes(item.talla)) tallas.push(item.talla);
                    if(item.fotos && item.fotos.length > 0 && !photoUrl) {
                        photoUrl = item.fotos[0];
                    }
                });
            }

            const photoHtml = photoUrl
                ? `<img src="${photoUrl}" alt="">`
                : `<i class="fa-solid fa-image"></i>`;

            return `
            <div class="order-card ${p.urgente ? 'urgente' : ''}" onclick="verResumenPedido('${p.id}')">
                ${renderEstadoStepper(p.id, p.estado)}
                <div class="order-card-header">
                    <span class="order-client">${escapeHtml(p.cliente_nombre)}</span>
                    <span style="font-weight: bold; color: var(--accent-dark)">#${p.numero_pedido || '?'}</span>
                </div>
                <div class="order-info-row">
                    <div class="order-photo-wrap">${photoHtml}</div>
                    <div class="order-info-text">
                        <div class="order-details">
                            <i class="fa-brands fa-${p.canal === 'wpp' ? 'whatsapp' : 'instagram'}"></i>
                            ${detalles.length > 0 ? escapeHtml(detalles.join(', ')) : 'Sin productos'}
                        </div>
                        <div class="order-meta-row">
                            ${tallas.length > 0 ? `<span class="order-talla-badge">${escapeHtml(tallas.join(' / '))}</span>` : ''}
                            ${p.saldo_pendiente > 0 ? `<span style="font-size: 0.78rem; color: var(--danger)">Saldo: S/${p.saldo_pendiente}</span>` : `<span style="font-size: 0.78rem; color: var(--success)">Pagado</span>`}
                        </div>
                    </div>
                </div>
                <div class="order-card-actions">
                    <button class="card-action-btn" onclick="event.stopPropagation(); verResumenPedido('${p.id}')"><i class="fa-solid fa-eye"></i> Ver</button>
                    <button class="card-action-btn" onclick="event.stopPropagation(); editOrder('${p.id}')"><i class="fa-solid fa-pen"></i> Editar</button>
                </div>
            </div>
            `;
        }
```

Reemplazarlo completo por:

```javascript
        // Una tarjeta por producto del pedido (no una por pedido) — ver spec 2026-08-18-lote-cards-redesign-design.md.
        // Estado, saldo y datos del cliente son del pedido completo y se repiten identicos en cada tarjeta
        // hermana; el semaforo mueve el pedido completo aunque se toque desde cualquiera de ellas.
        function renderOrderCard(p) {
            const items = [...(p.items_pedido || [])].sort((a, b) => {
                const oa = (a.orden === null || a.orden === undefined) ? Infinity : a.orden;
                const ob = (b.orden === null || b.orden === undefined) ? Infinity : b.orden;
                return oa - ob;
            });

            if (items.length === 0) {
                return renderProductCard(p, null, 1, 1);
            }

            return items.map((item, idx) => renderProductCard(p, item, idx + 1, items.length)).join('');
        }

        function renderProductCard(p, item, posicion, total) {
            const photoUrl = item && item.fotos && item.fotos.length > 0 ? item.fotos[0] : '';
            const photoHtml = photoUrl
                ? `<img src="${photoUrl}" alt="">`
                : `<i class="fa-solid fa-image"></i>`;

            const tipoLabel = item && item.tipo_producto
                ? item.tipo_producto + (item.variante ? ' — ' + item.variante : '')
                : 'Sin productos';

            const chips = [];
            if (item && item.talla) {
                chips.push(`<span class="order-chip">Talla ${escapeHtml(item.talla)}</span>`);
            }
            if (item && item.corte) {
                chips.push(`<span class="order-chip order-chip-corte">${formatCorte(item.corte)}</span>`);
            }
            if (item && item.color) {
                const colorInfo = buscarColorPorCodigo(item.color);
                chips.push(colorInfo
                    ? `<span class="order-chip order-chip-color"><span class="swatch" style="background:${colorInfo.hex}"></span>${escapeHtml(item.color)}</span>`
                    : `<span class="order-chip">${escapeHtml(item.color)}</span>`);
            }
            if (item && item.patron) {
                const imagenPatron = resolvePatronImagen(item.patron);
                chips.push(imagenPatron
                    ? `<span class="order-chip order-chip-patron"><img src="${imagenPatron}" alt="">${escapeHtml(item.patron)}</span>`
                    : `<span class="order-chip">${escapeHtml(item.patron)}</span>`);
            }

            const tieneObservacionPropia = !!(item && item.observaciones && item.observaciones.trim());
            const eyeHtml = tieneObservacionPropia
                ? `<span class="order-client-eye" title="Tiene observación"><i class="fa-solid fa-eye"></i></span>`
                : '';

            const grupoHtml = total > 1
                ? `<div class="order-card-group-strip" style="background:${colorGrupoPedido(p.id)}"></div>
                   <div class="order-card-fraction">${posicion}/${total}</div>`
                : '';

            return `
            <div class="order-card ${p.urgente ? 'urgente' : ''}" onclick="verResumenPedido('${p.id}')">
                ${grupoHtml}
                ${renderEstadoStepper(p.id, p.estado)}
                <div class="order-card-header">
                    <span class="order-client">${escapeHtml(p.cliente_nombre)}${eyeHtml}</span>
                    <span class="order-num-badge">#${p.numero_pedido || '?'}</span>
                </div>
                <div class="order-info-row">
                    <div class="order-photo-wrap">${photoHtml}</div>
                    <div class="order-info-text">
                        <div class="order-details">${escapeHtml(tipoLabel)}</div>
                        ${chips.length > 0 ? `<div class="order-meta-row">${chips.join('')}</div>` : ''}
                    </div>
                </div>
                <div class="order-footer-row">
                    ${p.saldo_pendiente > 0 ? `<span class="order-saldo">Saldo: S/${p.saldo_pendiente}</span>` : `<span class="order-saldo pagado">Pagado</span>`}
                    <span class="order-canal-icon"><i class="fa-brands fa-${p.canal === 'wpp' ? 'whatsapp' : 'instagram'}"></i></span>
                </div>
            </div>
            `;
        }
```

- [ ] **Step 2: Verificar en el navegador**

Nota: en este punto las queries todavía NO traen `color`, `patron`, `corte`, `observaciones` ni `orden`
(eso es Task 6), así que el pedido de prueba de la Task 3 se va a ver con las 2 tarjetas separadas
correctamente numeradas 1/2 y 2/2 (porque `fotos, tipo_producto, variante, talla` sí se traen hoy), pero
sin los chips de color/corte/patrón/ojito todavía — eso es esperado en este punto, no es un bug.

Abrir `index.html` local en el Browser tool, ir a "Lote Activo", buscar el pedido
`ZZZ PRUEBA PLAN — BORRAR` y confirmar:
- Aparecen 2 tarjetas separadas para ese pedido (no 1 combinada)
- Cada una tiene su franja de color arriba y su pastilla "1/2" / "2/2"
- Las 2 muestran el mismo semáforo de estado
- No hay errores en la consola del navegador

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "Renderizar una tarjeta de pedido por producto en vez de una por pedido"
```

---

### Task 6: Ampliar las queries de Supabase del tablero

**Files:**
- Modify: `index.html:3233-3236` (query de `loadLoteView`)
- Modify: `index.html:3348-3351` (query de `toggleLoteAccordion`, sección "Lotes anteriores")

**Interfaces:**
- Consumes: nada nuevo.
- Produces: los objetos `pedidos[].items_pedido[]` que llegan a `renderOrderCard` ahora incluyen
  `color, patron, corte, observaciones, orden`, y vienen pre-ordenados por `orden` desde la base de datos
  (aunque `renderOrderCard` igual los reordena en el cliente por seguridad, ver Task 5).

- [ ] **Step 1: Ampliar la query de `loadLoteView`**

Ubicar en `index.html` (~línea 3233):

```javascript
            const { data: pedidos, error } = await sb
                .from('pedidos')
                .select('*, items_pedido(fotos, nombre_mascota, tipo_producto, variante, talla)')
                .eq('lote_id', currentLoteId);
```

Reemplazar por:

```javascript
            const { data: pedidos, error } = await sb
                .from('pedidos')
                .select('*, items_pedido(fotos, nombre_mascota, tipo_producto, variante, talla, color, patron, corte, observaciones, orden)')
                .eq('lote_id', currentLoteId)
                .order('orden', { foreignTable: 'items_pedido' });
```

- [ ] **Step 2: Ampliar la query de "Lotes anteriores"**

Ubicar en `index.html` (~línea 3348):

```javascript
            const { data: pedidos, error } = await sb
                .from('pedidos')
                .select('*, items_pedido(fotos, nombre_mascota, tipo_producto, variante, talla)')
                .eq('lote_id', loteId);
```

Reemplazar por:

```javascript
            const { data: pedidos, error } = await sb
                .from('pedidos')
                .select('*, items_pedido(fotos, nombre_mascota, tipo_producto, variante, talla, color, patron, corte, observaciones, orden)')
                .eq('lote_id', loteId)
                .order('orden', { foreignTable: 'items_pedido' });
```

- [ ] **Step 3: Verificar en el navegador**

Abrir `index.html` local en el Browser tool, ir a "Lote Activo", buscar de nuevo
`ZZZ PRUEBA PLAN — BORRAR` y confirmar ahora sí:
- La tarjeta "1/2" (Manga corta + short) muestra: chip de talla "M", chip de corte "Clásico", chip de color
  con su cuadradito, chip de patrón con la miniatura real, y el ojito rojo (porque tiene observación)
- La tarjeta "2/2" (Manga larga + pantalón) muestra talla "S" y su color, sin chip de corte (no aplica a
  manga larga), sin ojito (no tiene observación)
- Si el lote activo tiene otros pedidos de un solo producto, esas tarjetas no muestran franja ni pastilla
- El alto de las tarjetas se ve similar al diseño anterior (no se disparó verticalmente)

Si algo no coincide, revisar consola de errores antes de seguir.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Traer color, patron, corte, observaciones y orden en las queries del tablero"
```

---

### Task 7: Verificación final, limpieza de datos de prueba y despliegue

**Files:**
- Modify: `CLAUDE.md` (agregar entrada en "Progreso")
- Ninguno más (solo verificación)

- [ ] **Step 1: Checklist de verificación manual completo**

Con el Browser tool sobre `index.html` local:

- Redimensionar a viewport móvil (`resize_window` preset `mobile`) y repetir la revisión de la Task 6 —
  confirmar que los chips no se desbordan ni rompen el layout en pantalla chica
- Tocar un cuadradito del semáforo en la tarjeta "1/2" del pedido de prueba, confirmar el diálogo de
  confirmación si aplica, y verificar que AMBAS tarjetas hermanas (1/2 y 2/2) reflejan el nuevo estado
  después de recargar la vista
- Revisar un pedido real existente (no el de prueba) con un solo producto — confirmar que se ve como una
  tarjeta normal, sin franja ni pastilla de fracción
- Revisar (si existe en los datos reales) algún pedido viejo con color en texto libre (no código de
  pantonera) — confirmar que el chip de color muestra el texto sin cuadradito, sin error en consola
- Confirmar que ya no aparecen los botones "Ver"/"Editar" en ninguna tarjeta, y que tocar la tarjeta sigue
  abriendo el resumen correctamente

- [ ] **Step 2: Borrar el pedido de prueba**

Eliminar el pedido `ZZZ PRUEBA PLAN — BORRAR` desde la app (abrir su resumen → Eliminar). Confirmar por
REST que ya no existe:

```bash
curl -s "https://zafgoegngcqsswzzxcen.supabase.co/rest/v1/pedidos?cliente_nombre=eq.ZZZ%20PRUEBA%20PLAN%20%E2%80%94%20BORRAR&select=id" \
  -H "apikey: sb_publishable_xmTh0DSBcGFF_0ZBb2ePcQ_Ktv8gKUB" \
  -H "Authorization: Bearer sb_publishable_xmTh0DSBcGFF_0ZBb2ePcQ_Ktv8gKUB"
```

Expected: `[]` (array vacío). Si sigue apareciendo, borrarlo y volver a confirmar.

- [ ] **Step 3: Actualizar el registro de progreso en CLAUDE.md**

Agregar una entrada nueva al principio de la sección `## Progreso` de `CLAUDE.md` (formato igual a las
entradas existentes), describiendo brevemente: rediseño de tarjetas a una-por-producto, franja/pastilla de
agrupación, chips de color/corte/patrón, ojito de observación, columna `orden` nueva en `items_pedido`.

- [ ] **Step 4: Confirmar despliegue con el usuario**

Antes de pushear, preguntar explícitamente: "¿Confirmas que despliegue esto a producción ahora
(push a `main`, Vercel autodeploya)?" Esperar un sí explícito.

- [ ] **Step 5: Commit y push**

```bash
git add index.html CLAUDE.md
git commit -m "Actualizar CLAUDE.md con el rediseño de tarjetas de pedido"
git push origin main
```

- [ ] **Step 6: Verificar en producción**

Esperar el autodeploy de Vercel (1-2 min) y verificar el HTML servido:

```bash
curl -s https://registro-pedidos-pf.vercel.app/ | grep -o "renderProductCard" | head -1
```

Expected: imprime `renderProductCard` (confirma que el deploy tomó el código nuevo). Si el Browser tool
puede abrir `vercel.app` sin bloqueo, hacer también una revisión visual rápida ahí; si lo bloquea, esta
verificación por `curl` es suficiente (limitación ya conocida de este entorno, ver `CLAUDE.md`).
