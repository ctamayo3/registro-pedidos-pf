# Formulario Público — Fase 3: Cola de Revisión en `index.html` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que los pedidos `estado='Por confirmar'` (creados por `pedido.html`) dejen de mezclarse con
los pedidos reales en el dashboard/tablero, y vivan en una vista dedicada donde Cesar los revisa,
edita si hace falta, y confirma o rechaza.

**Architecture:** Todo dentro de `index.html` (la app ya logueada). Un filtro único al inicio de
`loadDashboard()` y `loadLoteView()` separa los pedidos `Por confirmar` del resto antes de cualquier
cálculo. Una vista nueva (`revision-view`) lista esos pedidos con tarjetas propias (más simples que
`renderOrderCard`, sin semáforo — no tienen un estado de producción todavía) y botones
Confirmar/Rechazar/Editar (reutiliza `editOrder` ya existente).

**Tech Stack:** HTML/CSS/JS vanilla, mismo cliente `sb` autenticado ya existente.

## Global Constraints

- Spec completo: [docs/superpowers/specs/2026-08-18-formulario-publico-design.md](../specs/2026-08-18-formulario-publico-design.md).
- No se toca `pedido.html` ni el trigger de Postgres en esta fase.
- "Por confirmar" NO se agrega a `ESTADOS_ORDEN`/`renderEstadoStepper` — el semáforo de 5 pasos
  sigue siendo solo para pedidos ya confirmados (`Pendiente` en adelante). No se altera el diseño
  del tablero para ningún pedido existente.
- Los pedidos `Por confirmar` deben excluirse de: conteos/hero del Dashboard, alertas de entregas
  próximas, `calcularMaterialesLote`, y el grid de "Lote Activo" (activos + entregados). NO se
  excluyen de "Buscar Pedidos" (fuera de alcance explícito del spec — es una herramienta de
  búsqueda histórica, no un cálculo).
- La cola de revisión consulta `Por confirmar` de **todos los lotes**, no solo el activo — un pedido
  público pudo quedar asignado a un lote que ya no es el activo si Cesar cambió de lote mientras
  estaba sin revisar.
- No hay framework de tests — verificación manual vía navegador, contra el Supabase real.
- Datos de prueba: cliente `ZZZ PRUEBA FASE3 — BORRAR`, borrar al final y confirmar.

---

### Task 1: Excluir "Por confirmar" del Dashboard + card de alerta

**Files:**
- Modify: `index.html:3127-3273` (función `loadDashboard`)

**Interfaces:**
- Produces: `loadDashboard` ya no cuenta pedidos `Por confirmar` en ningún stat/alerta/cálculo de
  materiales. Nueva card de alerta si hay 1+ pedidos por revisar, con botón a `revision-view`
  (creada en la Task 4).

- [ ] **Step 1: Filtrar los pedidos al inicio de la función**

Ubicar en `index.html`:

```javascript
            const { data: pedidos, error } = await sb
                .from('pedidos')
                .select('*')
                .eq('lote_id', currentLoteId);

            if (error) {
                showToast('Error cargando dashboard', true);
                return;
            }

            // Stats (del lote activo)
            const total = pedidos.length;
```

Reemplazar por:

```javascript
            const { data: pedidosRaw, error } = await sb
                .from('pedidos')
                .select('*')
                .eq('lote_id', currentLoteId);

            if (error) {
                showToast('Error cargando dashboard', true);
                return;
            }

            const porConfirmarCount = pedidosRaw.filter(p => p.estado === 'Por confirmar').length;
            const pedidos = pedidosRaw.filter(p => p.estado !== 'Por confirmar');

            // Stats (del lote activo, sin contar los "Por confirmar")
            const total = pedidos.length;
```

- [ ] **Step 2: Agregar la card de alerta si hay pedidos por revisar**

Ubicar el cierre del bloque `dashboard-stats` (justo después del `stat-card` de "Listos para
entrega"):

```javascript
                <div class="stat-card">
                    <div class="stat-icon-circle icon-green"><i class="fa-solid fa-circle-check"></i></div>
                    <div class="stat-title">Listos para entrega</div>
                    <div class="stat-value">${listos}</div>
                </div>
            `;
```

Reemplazar por (agrega la card nueva al final, solo si hay algo que revisar):

```javascript
                <div class="stat-card">
                    <div class="stat-icon-circle icon-green"><i class="fa-solid fa-circle-check"></i></div>
                    <div class="stat-title">Listos para entrega</div>
                    <div class="stat-value">${listos}</div>
                </div>
                ${porConfirmarCount > 0 ? `
                <div class="stat-card" style="grid-column: 1 / -1; background: var(--gold-soft); cursor: pointer;" onclick="navigateTo('revision-view')">
                    <div class="stat-icon-circle icon-gold"><i class="fa-solid fa-inbox"></i></div>
                    <div class="stat-title">${porConfirmarCount} pedido${porConfirmarCount > 1 ? 's' : ''} nuevo${porConfirmarCount > 1 ? 's' : ''} por revisar</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">Vienen del formulario público — tócalo para revisarlos</div>
                </div>` : ''}
            `;
```

- [ ] **Step 3: Verificar en el navegador**

Recargar `index.html` local, loguearse, ir a Dashboard. Si no hay pedidos `Por confirmar` en el
lote activo, no debe aparecer la card nueva y los totales deben verse igual que siempre. (La
verificación con un pedido real de prueba se hace en la Task 5, después de tener la vista de
revisión lista.)

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Excluir pedidos Por confirmar de los calculos del Dashboard y agregar alerta"
```

---

### Task 2: Excluir "Por confirmar" del grid de "Lote Activo"

**Files:**
- Modify: `index.html:3421-3470` (función `loadLoteView`)

**Interfaces:**
- Produces: `loadLoteView` ya no muestra pedidos `Por confirmar` en el grid ni en los conteos del
  encabezado.

- [ ] **Step 1: Filtrar los pedidos al inicio de la función**

Ubicar en `index.html`:

```javascript
            const { data: pedidos, error } = await sb
                .from('pedidos')
                .select('*, items_pedido(fotos, nombre_mascota, tipo_producto, variante, talla, color, patron, corte, observaciones, orden)')
                .eq('lote_id', currentLoteId)
                .order('orden', { foreignTable: 'items_pedido' });

            if (error) {
                showToast('Error cargando lote', true);
                return;
            }

            const counts = { 'Pendiente': 0, 'Diseño enviado': 0, 'En producción': 0, 'Listo': 0, 'Entregado': 0 };
            pedidos.forEach(p => { if(counts[p.estado] !== undefined) counts[p.estado]++; });
```

Reemplazar por:

```javascript
            const { data: pedidosRaw, error } = await sb
                .from('pedidos')
                .select('*, items_pedido(fotos, nombre_mascota, tipo_producto, variante, talla, color, patron, corte, observaciones, orden)')
                .eq('lote_id', currentLoteId)
                .order('orden', { foreignTable: 'items_pedido' });

            if (error) {
                showToast('Error cargando lote', true);
                return;
            }

            const pedidos = pedidosRaw.filter(p => p.estado !== 'Por confirmar');

            const counts = { 'Pendiente': 0, 'Diseño enviado': 0, 'En producción': 0, 'Listo': 0, 'Entregado': 0 };
            pedidos.forEach(p => { if(counts[p.estado] !== undefined) counts[p.estado]++; });
```

- [ ] **Step 2: Verificar en el navegador**

Recargar, ir a "Lote Activo". Los conteos y el grid deben verse igual que siempre (sin pedidos de
prueba todavía).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "Excluir pedidos Por confirmar del grid de Lote Activo"
```

---

### Task 3: Agregar "Por confirmar" como opción del select de Estado

**Files:**
- Modify: `index.html:2189-2195` (select `#estado` del formulario de pedido)

**Interfaces:**
- Produces: al editar un pedido `Por confirmar` con `editOrder()` (ya existente), el select de
  Estado muestra correctamente "Por confirmar" en vez de quedar sin coincidencia — evita que
  guardar sin querer lo cambie de estado.

- [ ] **Step 1: Agregar la opción**

Ubicar en `index.html`:

```html
                            <select id="estado" onchange="marcarPagadoSiEntregado()">
                                <option value="Pendiente">Pendiente</option>
                                <option value="Diseño enviado">Diseño enviado</option>
                                <option value="En producción">En producción</option>
                                <option value="Listo">Listo</option>
                                <option value="Entregado">Entregado</option>
                            </select>
```

Reemplazar por:

```html
                            <select id="estado" onchange="marcarPagadoSiEntregado()">
                                <option value="Por confirmar">Por confirmar (pedido del formulario público)</option>
                                <option value="Pendiente">Pendiente</option>
                                <option value="Diseño enviado">Diseño enviado</option>
                                <option value="En producción">En producción</option>
                                <option value="Listo">Listo</option>
                                <option value="Entregado">Entregado</option>
                            </select>
```

- [ ] **Step 2: Verificar en el navegador**

Abrir "Nuevo Pedido" (no editar uno existente) — el select debe mostrar "Pendiente" seleccionado
por default igual que siempre (el HTML no tiene `selected` en ninguna opción, así que el navegador
selecciona la primera — verificar que sigue siendo el comportamiento esperado; si no, agregar
`selected` explícito a la opción "Pendiente"). Si el comportamiento cambió, ajustar.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "Agregar Por confirmar como opcion del select de Estado"
```

---

### Task 4: Vista "Pedidos por confirmar"

**Files:**
- Modify: `index.html` (nuevo nav item, nuevo `<div id="revision-view">`, nuevas funciones JS)

**Interfaces:**
- Consumes: `editOrder(id)` (ya existente, reutilizado para "Editar").
- Produces: `navigateTo('revision-view')` carga `loadRevisionView()`. Funciones nuevas:
  `loadRevisionView()`, `renderRevisionCard(p)`, `confirmarPedidoWeb(id)`, `rechazarPedidoWeb(id)`.

- [ ] **Step 1: Agregar el nav item**

Ubicar en `index.html`:

```html
                <li><a href="#" onclick="navigateTo('search')" id="nav-search"><i class="fa-solid fa-magnifying-glass"></i> <span>Buscar Pedidos</span></a></li>
            </ul>
```

Reemplazar por:

```html
                <li><a href="#" onclick="navigateTo('search')" id="nav-search"><i class="fa-solid fa-magnifying-glass"></i> <span>Buscar Pedidos</span></a></li>
                <li><a href="#" onclick="navigateTo('revision-view')" id="nav-revision-view"><i class="fa-solid fa-inbox"></i> <span>Por Confirmar</span></a></li>
            </ul>
```

- [ ] **Step 2: Agregar el HTML de la vista**

Ubicar el cierre de la vista "search" en `index.html`:

```html
                    <tbody id="search-results">
                        <tr>
                            <td colspan="8" style="text-align: center; color: var(--text-muted);">Usa el buscador para encontrar pedidos</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- ORDER FORM VIEW -->
```

Reemplazar por (agrega la vista nueva completa antes del comentario "ORDER FORM VIEW"):

```html
                    <tbody id="search-results">
                        <tr>
                            <td colspan="8" style="text-align: center; color: var(--text-muted);">Usa el buscador para encontrar pedidos</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- REVISION VIEW (pedidos del formulario publico, "Por confirmar") -->
        <div id="revision-view" class="view">
            <div class="header">
                <h1>Pedidos por Confirmar</h1>
            </div>
            <p style="color: var(--text-muted); margin-bottom: 1.5rem; max-width: 600px;">
                Pedidos registrados por clientes desde el formulario público. No cuentan en ningún
                cálculo hasta que los confirmes — revísalos, edítalos si algo está mal, y confirma
                o rechaza.
            </p>
            <div id="revision-list" class="kanban-items-grid"></div>
        </div>

        <!-- ORDER FORM VIEW -->
```

- [ ] **Step 3: Agregar `loadRevisionView` y `renderRevisionCard` al bootstrap de navegación**

Ubicar en `index.html` la función `navigateTo`:

```javascript
            if(viewId === 'dashboard') loadDashboard();
            if(viewId === 'lote-view') loadLoteView();
            if(viewId === 'patrones-view') loadPatronesView();
            if(viewId === 'search') loadSearchHistorial();
            if(viewId === 'gastos-view') loadGastosView();
```

Reemplazar por:

```javascript
            if(viewId === 'dashboard') loadDashboard();
            if(viewId === 'lote-view') loadLoteView();
            if(viewId === 'patrones-view') loadPatronesView();
            if(viewId === 'search') loadSearchHistorial();
            if(viewId === 'gastos-view') loadGastosView();
            if(viewId === 'revision-view') loadRevisionView();
```

- [ ] **Step 4: Agregar las funciones nuevas**

Agregar justo antes de `async function loadDashboard() {` (o en cualquier punto del `<script>`
después de que `escapeHtml`/`sb` ya estén definidos):

```javascript
        async function loadRevisionView() {
            const { data: pedidos, error } = await sb
                .from('pedidos')
                .select('*, items_pedido(tipo_producto, variante, talla, color, patron)')
                .eq('estado', 'Por confirmar')
                .order('created_at', { ascending: true });

            const container = document.getElementById('revision-list');
            if (error) {
                container.innerHTML = '<p style="color: var(--danger);">Error cargando pedidos por confirmar.</p>';
                return;
            }
            if (!pedidos || pedidos.length === 0) {
                container.innerHTML = '<p style="color: var(--text-muted);">No hay pedidos nuevos por revisar.</p>';
                return;
            }
            container.innerHTML = pedidos.map(p => renderRevisionCard(p)).join('');
        }

        function renderRevisionCard(p) {
            const detalles = (p.items_pedido || []).map(it => {
                const partes = [it.tipo_producto + (it.variante ? ' — ' + it.variante : '')];
                if (it.talla) partes.push('Talla ' + it.talla);
                if (it.color) {
                    const colorInfo = buscarColorPorCodigo(it.color);
                    partes.push(colorInfo ? `Color ${it.color}` : `Color ${it.color}`);
                }
                if (it.patron) partes.push('Patrón ' + it.patron);
                return `<div style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 4px;">${escapeHtml(partes.join(' · '))}</div>`;
            }).join('');

            return `
            <div class="order-card">
                <div class="order-card-header">
                    <span class="order-client">${escapeHtml(p.cliente_nombre)}</span>
                    <span class="order-num-badge">${p.codigo_pedido ? escapeHtml(p.codigo_pedido) : '—'}</span>
                </div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px;">
                    <i class="fa-brands fa-${p.canal === 'wpp' ? 'whatsapp' : (p.canal === 'ig' ? 'instagram' : 'circle-notch')}"></i>
                    ${escapeHtml(p.cliente_contacto || 'Sin contacto')}
                </div>
                ${detalles}
                <div class="order-footer-row">
                    <span class="order-saldo">Total: S/ ${Number(p.precio_total || 0).toFixed(2)}</span>
                </div>
                <div class="order-card-actions" style="display:flex; gap:6px; margin-top:10px;">
                    <button class="card-action-btn" onclick="editOrder('${p.id}')"><i class="fa-solid fa-pen"></i> Editar</button>
                    <button class="card-action-btn" style="background: var(--success-soft); color: var(--success);" onclick="confirmarPedidoWeb('${p.id}')"><i class="fa-solid fa-check"></i> Confirmar</button>
                    <button class="card-action-btn" style="background: var(--danger-soft); color: var(--danger);" onclick="rechazarPedidoWeb('${p.id}')"><i class="fa-solid fa-xmark"></i> Rechazar</button>
                </div>
            </div>
            `;
        }

        async function confirmarPedidoWeb(id) {
            if (!confirm('¿Confirmar este pedido? Pasará a "Pendiente" y contará en todos los cálculos del lote.')) return;
            try {
                const { error } = await sb.from('pedidos').update({ estado: 'Pendiente' }).eq('id', id);
                if (error) throw error;
                showToast('Pedido confirmado');
                loadRevisionView();
                loadDashboard();
            } catch (err) {
                console.error(err);
                showToast('Error al confirmar el pedido', true);
            }
        }

        async function rechazarPedidoWeb(id) {
            if (!confirm('¿Rechazar y eliminar este pedido permanentemente? Esta acción no se puede deshacer.')) return;
            try {
                const { error } = await sb.from('pedidos').delete().eq('id', id);
                if (error) throw error;
                showToast('Pedido rechazado');
                loadRevisionView();
                loadDashboard();
            } catch (err) {
                console.error(err);
                showToast('Error al rechazar el pedido', true);
            }
        }
```

Nota: `renderRevisionCard` reutiliza las clases CSS `.order-card`, `.order-card-header`,
`.order-client`, `.order-num-badge`, `.order-footer-row`, `.order-saldo`, `.card-action-btn` que ya
existen (de la tarjeta de "Lote Activo") — no hace falta CSS nuevo.

- [ ] **Step 5: Verificar en el navegador**

Recargar, loguearse, ir a "Por Confirmar" desde el nav. Si no hay pedidos, debe mostrar "No hay
pedidos nuevos por revisar." sin errores de consola.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "Agregar vista de revision para pedidos Por confirmar (editar/confirmar/rechazar)"
```

---

### Task 5: Verificación end-to-end con un pedido de prueba real

**Files:**
- Ninguno (solo verificación)

- [ ] **Step 1: Crear un pedido de prueba simulando el formulario público**

Desde la consola del navegador, logueado (usa `sb` autenticado, que tiene acceso completo):

```javascript
(async () => {
  const id = crypto.randomUUID();
  await sb.from('pedidos').insert([{ id, cliente_nombre: 'ZZZ PRUEBA FASE3 — BORRAR', canal: 'wpp', origen: 'web', precio_total: 0, monto_pagado: 0, estado: 'Pendiente' }]);
  await sb.from('items_pedido').insert([{ pedido_id: id, tipo_producto: 'pijama', variante: 'Manga corta + short', precio_unitario: 1, orden: 1 }]);
  console.log('creado:', id);
})();
```

(El trigger de la Fase 1/2 lo convierte solo a `origen='web'`, `estado='Por confirmar'`,
`codigo_pedido` real, `precio_unitario`/`precio_total` recalculados — igual que si viniera de
`pedido.html`.)

- [ ] **Step 2: Confirmar que NO aparece en ningún cálculo**

Ir a Dashboard: debe aparecer la card de alerta "1 pedido nuevo por revisar". "Total Pedidos" y
"Por cobrar" NO deben incluirlo (comparar el total antes y después de crear el pedido de prueba).
Ir a "Lote Activo": el pedido de prueba NO debe aparecer en el grid.

- [ ] **Step 3: Confirmar que SÍ aparece en la cola de revisión**

Ir a "Por Confirmar": debe verse la tarjeta con el cliente, el código real (`PF-2608-NNN`), el
detalle del producto (pijama, Manga corta + short) y el precio recalculado (S/95, no el S/1
enviado).

- [ ] **Step 4: Confirmar el pedido y verificar que empieza a contar**

Tocar "Confirmar" en la tarjeta de prueba. Verificar: desaparece de "Por Confirmar", aparece en el
grid de "Lote Activo" con estado "Pendiente", y el "Total Pedidos"/"Por cobrar" del Dashboard ahora
sí lo incluyen.

- [ ] **Step 5: Limpieza**

Eliminar el pedido de prueba (desde su tarjeta en "Lote Activo" → resumen → Eliminar, o por
consola) y confirmar que ya no existe.

---

### Task 6: Actualizar `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Actualizar la sección de estados/Kanban y agregar entrada en Progreso**

Documentar: la vista "Por Confirmar" nueva, qué queda excluido de qué cálculo, el select de Estado
con la opción nueva, y que la Fase 3 de 4 quedó completa (falta solo la Fase 4: PDF + WhatsApp en
`pedido.html`).

- [ ] **Step 2: Commit y confirmar despliegue**

```bash
git add CLAUDE.md
git commit -m "Actualizar CLAUDE.md: cola de revision Por Confirmar (Fase 3 formulario publico)"
```

Confirmar con el usuario antes de pushear.
