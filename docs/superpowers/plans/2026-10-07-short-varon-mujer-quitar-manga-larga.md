# Short de varón/mujer y retiro de manga larga — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar si el short de la pijama es de varón o de mujer (obligatorio para el cliente) y retirar "Manga larga + pantalón" del catálogo sin romper pedidos antiguos.

**Architecture:** Columna nueva nullable `items_pedido.tipo_short`. Cada archivo HTML es independiente (sin imports), así que la regla `aplicaTipoShort` y sus etiquetas se definen en ambos. El retiro de manga larga es un `UPDATE` de catálogo más una tolerancia en `updateVariants` de `index.html`.

**Tech Stack:** HTML/CSS/JS vanilla, Supabase (PostgREST), jsPDF (ya cargado en `index.html`).

**Spec:** `docs/superpowers/specs/2026-10-07-short-varon-mujer-quitar-manga-larga-design.md`

## Global Constraints

- Regla: aplica solo si `tipo_producto === 'pijama'` y `variante === 'Manga corta + short'`. Valores guardados: `'varon'` / `'mujer'` / `null`.
- Etiquetas: campo público "¿Short de varón o de mujer?"; chips "Short varón" / "Short mujer"; alerta "Short: sin definir".
- `pedido.html`: obligatorio, sin valor preseleccionado. `index.html`: opcional, nunca bloquea `saveOrder`.
- **No hacer `git push` hasta que el usuario confirme que corrió el `ALTER TABLE`** — el código nombra la columna en `select`/`insert` y sin ella fallan Lote Activo y el formulario público. Verificar con: `curl -s "$SUPABASE_URL/rest/v1/items_pedido?select=tipo_short&limit=1" -H "apikey: $KEY"` → `[]` (existe) vs. error `42703` (no existe).
- El `UPDATE` que desactiva manga larga se corre **después** de publicar el código.
- Pedidos existentes no se migran ni se modifican.

## Estrategia de pruebas

Sin framework de tests. Se abre el archivo local en el Browser pane y se invocan las funciones globales con `javascript_tool`. `index.html` se prueba sin login reemplazando `sb.from` por datos de ejemplo. Nada de esto escribe en Supabase.

---

### Task 1: `index.html` — short en formulario, tarjetas, resumen y PDF + variante descontinuada

**Files:**
- Modify: `index.html` (CSS `.order-chip-corte`; helpers junto a `VARIANTES_CON_CORTE`; `renderRevisionProductRow`; `renderProductCard`; `verResumenPedido`; `addProductItem`; `duplicarProductoItem`; `onTipoProductoChange`; `updateVariants`; `updatePrice`; `saveOrder`; `piezaConfeccion`; `resumenConfeccion`; `obtenerPijamasProduccion`; `construirPDFConfeccion`; 3 `select` de `items_pedido(...)`)

**Interfaces:**
- Produces: `VARIANTE_CON_SHORT`, `aplicaTipoShort(tipo, variante) → boolean`, `formatTipoShort(valor) → 'Short varón'|'Short mujer'|''`, `renderChipTipoShort(item, mostrarAlerta) → html`, `updateTipoShortVisibility(prodId)`, `piezaConfeccion(item)` (antes recibía `variante`).

- [ ] **Step 1: Prueba que falla** — en `index.html` local:

```js
const f = []; const eq = (n, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) f.push(`${n}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); };
eq('aplica', aplicaTipoShort('pijama', 'Manga corta + short'), true);
eq('no aplica pantalon', aplicaTipoShort('pijama', 'Manga corta + pantalón'), false);
eq('no aplica polo', aplicaTipoShort('polo', 'Manga corta + short'), false);
eq('fmt', [formatTipoShort('varon'), formatTipoShort('mujer'), formatTipoShort(null)], ['Short varón', 'Short mujer', '']);
eq('pieza', [
  piezaConfeccion({ variante: 'Manga corta + short', tipo_short: 'mujer' }),
  piezaConfeccion({ variante: 'Manga corta + short', tipo_short: null }),
  piezaConfeccion({ variante: 'Manga corta + pantalón', tipo_short: null }),
  piezaConfeccion({ variante: 'Manga larga + pantalón' })
], ['Short mujer', 'Short', 'Pantalón', 'Pantalón']);
eq('resumen separa', resumenConfeccion([
  { variante: 'Manga corta + short', tipo_short: 'varon', talla: 'M', color: 'A04' },
  { variante: 'Manga corta + short', tipo_short: 'mujer', talla: 'M', color: 'A04' },
  { variante: 'Manga corta + short', tipo_short: 'mujer', talla: 'M', color: 'A04' }
]).map(r => `${r.pieza}:${r.cantidad}`), ['Short mujer:2', 'Short varón:1']);
const it = { tipo_producto: 'pijama', variante: 'Manga corta + short', tipo_short: null };
eq('chip alerta', renderChipTipoShort(it, true).includes('sin definir'), true);
eq('chip sin alerta', renderChipTipoShort(it, false), '');
eq('chip valor', renderChipTipoShort({ ...it, tipo_short: 'varon' }, false).includes('Short varón'), true);
eq('chip no aplica', renderChipTipoShort({ tipo_producto: 'polo', variante: 'Polo de algodón' }, true), '');
f.length ? f : 'OK';
```

- [ ] **Step 2: Verificar que falla** — `ReferenceError: aplicaTipoShort is not defined`.

- [ ] **Step 3: Implementar**

CSS, después de `.order-chip-corte { ... }`:

```css
        .order-chip-alerta {
            background: var(--danger-soft);
            color: var(--danger);
        }
```

Helpers, después de la constante `VARIANTES_CON_CORTE`:

```js
        // Unica variante que pide elegir short de varon o de mujer (items_pedido.tipo_short).
        const VARIANTE_CON_SHORT = 'Manga corta + short';

        function aplicaTipoShort(tipo, variante) {
            return tipo === 'pijama' && variante === VARIANTE_CON_SHORT;
        }

        function formatTipoShort(valor) {
            if (valor === 'varon') return 'Short varón';
            if (valor === 'mujer') return 'Short mujer';
            return '';
        }

        // Chip del short para tarjetas. Pijama con short sin el dato (pedidos anteriores al campo):
        // chip de alerta solo si mostrarAlerta, para que se complete al editar.
        function renderChipTipoShort(item, mostrarAlerta) {
            if (!item || !aplicaTipoShort(item.tipo_producto, item.variante)) return '';
            if (item.tipo_short) return `<span class="order-chip order-chip-corte">${formatTipoShort(item.tipo_short)}</span>`;
            return mostrarAlerta ? '<span class="order-chip order-chip-alerta">Short: sin definir</span>' : '';
        }

        function updateTipoShortVisibility(prodId) {
            const grupo = document.getElementById(`${prodId}_tipo_short_group`);
            if(!grupo) return;
            const aplica = aplicaTipoShort(
                document.getElementById(`${prodId}_tipo`).value,
                document.getElementById(`${prodId}_variante`).value);
            grupo.style.display = aplica ? '' : 'none';
            if(!aplica) document.getElementById(`${prodId}_tipo_short`).value = '';
        }
```

`renderRevisionProductRow` y `renderProductCard`: justo después del chip de talla:

```js
            const chipShort = renderChipTipoShort(item, true);                       // revision
            const chipShort = renderChipTipoShort(item, p.estado !== 'Entregado');   // lote activo
            if (chipShort) chips.push(chipShort);
```

`verResumenPedido`, después de la línea de Talla:

```js
                            ${aplicaTipoShort(it.tipo_producto, it.variante) ? `Short: ${it.tipo_short === 'varon' ? 'Varón' : (it.tipo_short === 'mujer' ? 'Mujer' : 'sin definir')}<br>` : ''}
```

`addProductItem`, después del `div` `${id}_corte_group`:

```html
                        <div class="form-group" id="${id}_tipo_short_group" style="display:none;">
                            <label>Short</label>
                            <select id="${id}_tipo_short">
                                <option value="">Sin definir</option>
                                <option value="varon" ${data && data.tipo_short === 'varon' ? 'selected' : ''}>Varón</option>
                                <option value="mujer" ${data && data.tipo_short === 'mujer' ? 'selected' : ''}>Mujer</option>
                            </select>
                        </div>
```

Llamar `updateTipoShortVisibility(id)` / `(prodId)` inmediatamente después de cada una de las 3 llamadas a `updateCorteVisibility` (`addProductItem`, `onTipoProductoChange`, `updatePrice`).

`duplicarProductoItem`: agregar al objeto `data` → `tipo_short: document.getElementById(`${prodId}_tipo_short`).value || null,`.

`saveOrder`, en el objeto de `itemsToInsert.push`, después de `corte:`:

```js
                        tipo_short: aplicaTipoShort(itemTipoProducto, itemVariante) ? (document.getElementById(`${prodId}_tipo_short`).value || null) : null,
```

`updateVariants` (variante guardada fuera del catálogo activo):

```js
            const descontinuada = preselectedVariant && !variants.some(v => v.variante === preselectedVariant)
                ? `<option value="${escapeHtml(preselectedVariant)}" selected>${escapeHtml(preselectedVariant)} (descontinuado)</option>`
                : '';
            select.innerHTML = '<option value="">Seleccione...</option>' +
                variants.map(v => `...igual que hoy...`).join('') + descontinuada;
```

PDF:

```js
        function piezaConfeccion(item) {
            if (item.variante !== VARIANTE_CON_SHORT) return 'Pantalón';
            return formatTipoShort(item.tipo_short) || 'Short';
        }
```

y cambiar `piezaConfeccion(it.variante)` → `piezaConfeccion(it)` en `resumenConfeccion` y `construirPDFConfeccion`.

Consultas: agregar `tipo_short` a las listas de columnas de `items_pedido(...)` en `loadRevisionView`, las 2 de `loadLoteView`, y al `select` de `obtenerPijamasProduccion`.

- [ ] **Step 4: Verificar** — recargar; el script del Step 1 devuelve `"OK"`. Luego, con `sb.from` reemplazado por datos de ejemplo y `mostrarApp()`:
  - `crearNuevoPedido()`; elegir pijama + "Manga corta + short" → `prod_1_tipo_short_group` visible; elegir "Mujer"; cambiar a "Manga corta + pantalón" → oculto y valor `''`.
  - `updateVariants('prod_1', 'Manga larga + pantalón')` con un catálogo sin esa variante → el select queda en `Manga larga + pantalón` con texto "(descontinuado)".
  - Lote Activo: tarjeta de short con `tipo_short:'mujer'` muestra "Short mujer"; con `null` muestra "Short: sin definir"; entregado con `null` no muestra chip.
  - `construirPDFConfeccion` con items de ejemplo: el texto del PDF contiene "Short mujer" y "Short varón".

- [ ] **Step 5: Commit** — `git add index.html && git commit -m "Agregar short de varon/mujer al panel y tolerar variantes descontinuadas al editar"` (sin push).

---

### Task 2: `pedido.html` — campo obligatorio de short

**Files:**
- Modify: `pedido.html` (`NOMBRE_CAMPO`; constantes junto a `VARIANTES_CON_CORTE`; `validarProducto`; `renderResumenProducto`; `actualizarEstadoCampos`; plantilla de `addProductItem`; `onTipoProductoChange`; `updatePrice`; `construirResumenPreview`; `confirmarYEnviarPedido`; `renderFichaResumen`)

**Interfaces:**
- Produces: `VARIANTE_CON_SHORT`, `aplicaTipoShort`, `formatTipoShort`, `leerTipoShort(prodId) → 'varon'|'mujer'|null`, `selectTipoShort(prodId, valor)`, `updateTipoShortVisibility(prodId)`.

- [ ] **Step 1: Prueba que falla** — en `pedido.html` local, tras llenar datos y `continuarDesdeDatos()`:

```js
document.getElementById('prod_1_tipo').value = 'pijama'; onTipoProductoChange('prod_1');
document.getElementById('prod_1_variante').value = 'Manga corta + short'; updatePrice('prod_1');
const g = document.getElementById('prod_1_tipo_short_group');
({ existe: !!g, visible: g && g.style.display !== 'none' });
```

- [ ] **Step 2: Verificar que falla** — `existe: false`.

- [ ] **Step 3: Implementar**

`NOMBRE_CAMPO`: agregar `tipo_short: 'Short de varón o de mujer'`.

Después de `VARIANTES_CON_CORTE`:

```js
        // Unica variante que pide elegir short de varon o de mujer (items_pedido.tipo_short).
        const VARIANTE_CON_SHORT = 'Manga corta + short';

        function aplicaTipoShort(tipo, variante) {
            return tipo === 'pijama' && variante === VARIANTE_CON_SHORT;
        }

        function formatTipoShort(valor) {
            if (valor === 'varon') return 'Short varón';
            if (valor === 'mujer') return 'Short mujer';
            return '';
        }

        function leerTipoShort(prodId) {
            const aplica = aplicaTipoShort(
                document.getElementById(`${prodId}_tipo`).value,
                document.getElementById(`${prodId}_variante`).value);
            const el = document.getElementById(`${prodId}_tipo_short`);
            return (aplica && el && el.value) ? el.value : null;
        }
```

`validarProducto`, después del bloque `if (!tipo || !variante)`:

```js
            if (aplicaTipoShort(tipo, variante) && !leerTipoShort(prodId)) {
                return { valido: false, prodId, mensaje: `El Producto ${numero} (${tipoLabel}) todavía no tiene ${NOMBRE_CAMPO.tipo_short} — revísalo arriba.` };
            }
```

Plantilla, después del `div` `${id}_variante_group`:

```html
                    <div class="form-group" id="${id}_tipo_short_group" style="display:none;">
                        <label>¿Short de varón o de mujer?</label>
                        <div class="chip-grid" id="${id}_tipo_short_chips">
                            <span class="chip-option" data-valor="varon" onclick="selectTipoShort('${id}', 'varon')">Varón</span>
                            <span class="chip-option" data-valor="mujer" onclick="selectTipoShort('${id}', 'mujer')">Mujer</span>
                        </div>
                        <input type="hidden" id="${id}_tipo_short">
                    </div>
```

Funciones nuevas, junto a `updateCorteVisibility`:

```js
        function updateTipoShortVisibility(prodId) {
            const aplica = aplicaTipoShort(
                document.getElementById(`${prodId}_tipo`).value,
                document.getElementById(`${prodId}_variante`).value);
            document.getElementById(`${prodId}_tipo_short_group`).style.display = aplica ? '' : 'none';
            if (!aplica) selectTipoShort(prodId, '');
        }

        function selectTipoShort(prodId, valor) {
            document.getElementById(`${prodId}_tipo_short`).value = valor;
            document.querySelectorAll(`#${prodId}_tipo_short_chips .chip-option`).forEach(el => {
                el.classList.toggle('selected', el.dataset.valor === valor);
            });
            actualizarEstadoCampos(prodId);
        }
```

`onTipoProductoChange`: agregar `updateCorteVisibility(prodId); updateTipoShortVisibility(prodId);` antes de `actualizarEstadoCampos` (hoy el corte no se oculta al cambiar de tipo: un polo elegido después de una pijama se guarda con `corte`). `updatePrice`: `updateTipoShortVisibility(prodId);` después de `updateCorteVisibility(prodId);`.

`actualizarEstadoCampos`, después del bloque de talla:

```js
            const shortGroup = document.getElementById(`${prodId}_tipo_short_group`);
            if (shortGroup && shortGroup.style.display !== 'none') {
                marcarCampoCompleto(`${prodId}_tipo_short_group`, !!document.getElementById(`${prodId}_tipo_short`).value);
            }
```

`renderResumenProducto`, después del chip de talla:

```js
            const tipoShort = leerTipoShort(prodId);
            if (tipoShort) chips.push(`<span class="resumen-producto-chip">${formatTipoShort(tipoShort)}</span>`);
```

`construirResumenPreview` y el `itemsResumen.push` de `confirmarYEnviarPedido`: agregar `tipo_short: leerTipoShort(prodId),`. `insert` de `items_pedido`: agregar `tipo_short: leerTipoShort(prodId),`.

`renderFichaResumen`, después del chip de talla:

```js
                if (item.tipo_short) chips.push(`<span class="ficha-chip">${formatTipoShort(item.tipo_short)}</span>`);
```

- [ ] **Step 4: Verificar** — recargar y repetir el Step 1 → `{existe: true, visible: true}`. Además:
  - Sin elegir: `validarProducto(document.getElementById('prod_1'), 1).mensaje` contiene "Short de varón o de mujer".
  - `selectTipoShort('prod_1','mujer')` → chip "Mujer" seleccionado, grupo con `form-group-completo`, `leerTipoShort` = `'mujer'`.
  - Cambiar variante a "Manga corta + pantalón" → grupo oculto, `leerTipoShort` = `null`.
  - Cambiar tipo a polo → `prod_1_corte_group` oculto.
  - `renderFichaResumen({ items: [{ tipo_producto:'pijama', variante:'Manga corta + short', talla:'M', tipo_short:'mujer', precio_unitario:95, fotos:[] }], total:95 })` contiene "Short mujer".

- [ ] **Step 5: Commit** — `git add pedido.html && git commit -m "Pedir short de varon o mujer en el formulario publico"` (sin push).

---

### Task 3: SQL de referencia y documentación

**Files:**
- Create: `supabase-sql/2026-10-07-tipo-short-y-manga-larga.sql`
- Modify: `CLAUDE.md` (Esquema `items_pedido` y catálogo; Lógica de negocio; Gotchas; Progreso)

- [ ] **Step 1:** Crear el archivo SQL con las 2 sentencias y el orden de ejecución comentado.
- [ ] **Step 2:** Actualizar `CLAUDE.md`.
- [ ] **Step 3:** Commit (sin push).

---

### Task 4: Despliegue coordinado con el usuario

- [ ] **Step 1:** Usuario corre el `ALTER TABLE`. Verificar con el `curl` de Global Constraints → `[]`.
- [ ] **Step 2:** `git push origin main`; confirmar con `curl` que Vercel sirve `aplicaTipoShort` en ambos archivos.
- [ ] **Step 3:** Prueba en producción: pedido de prueba por `pedido.html` (pijama con short de mujer). Pedir al usuario que lo vea en "Por Confirmar" con el chip "Short mujer" y lo rechace (borra el pedido); `anon` no puede leer ni borrar pedidos.
- [ ] **Step 4:** Usuario corre el `UPDATE` de manga larga. Verificar: `curl` al catálogo ya no devuelve la variante con `activo=true`.
