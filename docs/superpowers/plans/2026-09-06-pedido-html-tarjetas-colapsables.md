# Tarjetas colapsables y mini-preview en vivo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En `pedido.html`, las tarjetas de producto ya completas se colapsan a un resumen chico al
agregar un producto nuevo, y mientras una tarjeta está abierta se muestra un mini-preview en vivo (foto
+ chips + precio) que se actualiza con cada campo llenado.

**Architecture:** Un componente compartido (`renderResumenProducto`) genera el HTML de "foto + tipo/
modelo + chips + precio" para un producto — se usa tanto para el mini-preview en vivo (dentro de la
tarjeta abierta) como para el resumen colapsado (cuando la tarjeta se oculta). Colapsar/expandir es
puro CSS (`display:none`/`block` sobre un contenedor `.product-item-fields`) — nunca se destruyen ni
reconstruyen los campos, así que ningún valor se pierde.

**Tech Stack:** HTML/CSS/JS vanilla, sin dependencias nuevas.

## Global Constraints

- Colapsar una tarjeta NUNCA borra sus valores — solo oculta el contenedor de campos con CSS. Reabrir
  debe mostrar exactamente lo que había.
- El disparador de colapso es únicamente "Agregar otro producto" — no se agrega un botón de colapsar
  manual.
- El campo Corte no aparece en `renderResumenProducto` (ni en el mini-preview ni en el resumen
  colapsado).
- Si la validación final (`mostrarErrorValidacion`, ya existente del Grupo 1) apunta a un producto que
  está colapsado, ese producto se expande automáticamente antes de hacer scroll/resaltar.
- No se toca `index.html` ni ninguna tabla/columna de Supabase.

---

### Task 1: Componente `renderResumenProducto` + CSS

**Files:**
- Modify: `pedido.html` (CSS, cerca de `.product-item.error-highlight`)
- Modify: `pedido.html` (agregar `renderResumenProducto`, `actualizarResumenProducto`, cerca de
  `buscarColorPorCodigo`)

**Interfaces:**
- Produces: `renderResumenProducto(prodId)` → `string` (HTML de foto + tipo/modelo + chips de talla/
  color/patrón + precio). `actualizarResumenProducto(prodId)` → `void`, refresca el contenedor
  `${prodId}_resumen_preview` si existe en el DOM (no falla si no existe, para poder llamarse desde
  cualquier handler sin verificar el contexto). Ambas serán consumidas por las Tareas 2 y 3.
- Consumes: `TIPO_PRODUCTO_LABELS`, `buscarColorPorCodigo`, `escapeHtml`, `imagesFiles` (todos ya
  existentes).

- [ ] **Step 1: CSS del resumen y del contenedor colapsado**

En `pedido.html`, inmediatamente después de la línea `.product-item.error-highlight { border-color:
var(--danger); }`, agregar:

```css
        .product-item-summary { display:none; align-items:center; gap:10px; cursor:pointer; }
        .product-item-summary-edit { color: var(--text-muted); font-size:0.95rem; flex-shrink:0; }
        .resumen-producto { display:flex; align-items:center; gap:10px; flex:1; min-width:0; }
        .resumen-producto-foto { width:44px; height:44px; border-radius:8px; object-fit:cover; flex-shrink:0; background: var(--card-secondary); }
        .resumen-producto-foto-vacia { display:flex; align-items:center; justify-content:center; color: var(--text-muted); }
        .resumen-producto-info { flex:1; min-width:0; }
        .resumen-producto-titulo { font-weight:600; font-size:0.85rem; margin-bottom:4px; }
        .resumen-producto-chips { display:flex; flex-wrap:wrap; gap:5px; }
        .resumen-producto-chip { display:inline-flex; align-items:center; gap:4px; background: var(--card-secondary); padding:2px 8px; border-radius: var(--border-radius-pill); font-size:0.68rem; }
        .resumen-producto-chip-sw { width:9px; height:9px; border-radius:3px; flex-shrink:0; }
        .resumen-producto-precio { font-family: var(--font-display); font-weight:700; color: var(--accent-dark); font-size:0.9rem; flex-shrink:0; }
```

- [ ] **Step 2: Agregar `renderResumenProducto` y `actualizarResumenProducto`**

En `pedido.html`, inmediatamente después de la función `buscarColorPorCodigo` (busca el `}` que cierra
`function buscarColorPorCodigo(codigo) { ... }`, justo antes de `function renderForm() {`), agregar:

```js
        function renderResumenProducto(prodId) {
            const tipo = document.getElementById(`${prodId}_tipo`).value;
            const variante = document.getElementById(`${prodId}_variante`).value;
            const tipoLabel = TIPO_PRODUCTO_LABELS[tipo] || tipo;
            const precioEl = document.getElementById(`${prodId}_precio_display`);
            const precioTexto = precioEl ? precioEl.textContent : 'S/ 0.00';

            const fotos = imagesFiles[prodId] || [];
            const fotoHtml = fotos.length > 0
                ? `<img src="${URL.createObjectURL(fotos[0])}" class="resumen-producto-foto">`
                : `<div class="resumen-producto-foto resumen-producto-foto-vacia"><i class="fa-solid fa-image"></i></div>`;

            const tallaEl = document.getElementById(`${prodId}_talla`);
            const colorEl = document.getElementById(`${prodId}_color`);
            const patronEl = document.getElementById(`${prodId}_patron`);

            const chips = [];
            if (tallaEl && tallaEl.value) chips.push(`<span class="resumen-producto-chip">${escapeHtml(tallaEl.value)}</span>`);
            if (colorEl && colorEl.value) {
                const colorInfo = buscarColorPorCodigo(colorEl.value);
                chips.push(colorInfo
                    ? `<span class="resumen-producto-chip"><span class="resumen-producto-chip-sw" style="background:${colorInfo.hex}"></span>${escapeHtml(colorEl.value)}</span>`
                    : `<span class="resumen-producto-chip">${escapeHtml(colorEl.value)}</span>`);
            }
            if (patronEl && patronEl.value) chips.push(`<span class="resumen-producto-chip">${escapeHtml(patronEl.value)}</span>`);

            return `
                <div class="resumen-producto">
                    ${fotoHtml}
                    <div class="resumen-producto-info">
                        <div class="resumen-producto-titulo">${tipo ? escapeHtml(tipoLabel) + (variante ? ' — ' + escapeHtml(variante) : '') : 'Producto sin completar'}</div>
                        <div class="resumen-producto-chips">${chips.join('')}</div>
                    </div>
                    <div class="resumen-producto-precio">${precioTexto}</div>
                </div>`;
        }

        function actualizarResumenProducto(prodId) {
            const el = document.getElementById(`${prodId}_resumen_preview`);
            if (el) el.innerHTML = renderResumenProducto(prodId);
        }
```

- [ ] **Step 3: Verificar manualmente en el navegador**

Levantar el servidor estático local y abrir `pedido.html`. En consola:

```js
document.getElementById('cliente_nombre').value = 'PRUEBA';
document.getElementById('cliente_contacto').value = '999';
document.getElementById('prod_1_tipo').value = 'pijama';
onTipoProductoChange('prod_1');
document.getElementById('prod_1_variante').value = catalog.find(c => c.tipo_producto === 'pijama').variante;
updatePrice('prod_1');
selectTalla('prod_1', 'M');
document.body.insertAdjacentHTML('beforeend', `<div id="test_preview">${renderResumenProducto('prod_1')}</div>`);
```

Expected: aparece al final de la página una franja con un cuadrado placeholder de foto (todavía sin
foto real), el texto "Pijamas — [variante elegida]", un chip "M", y el precio a la derecha. Sin errores
en consola. Recargar la página después para descartar el div de prueba.

- [ ] **Step 4: Commit**

```bash
git add pedido.html
git commit -m "$(cat <<'EOF'
Agregar renderResumenProducto para el mini-preview y resumen colapsado

Componente compartido (foto + tipo/modelo + chips de talla/color/
patron + precio) que usaran tanto el mini-preview en vivo como las
tarjetas colapsadas de las siguientes tareas. Todavia no se conecta a
ningun lado.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Estructura colapsable de la tarjeta + `colapsarProducto`/`expandirProducto`

**Files:**
- Modify: `pedido.html` (`addProductItem`, plantilla HTML y valor de retorno)

**Interfaces:**
- Produces: `addProductItem()` ahora también hace `return id;` (antes no retornaba nada — la Tarea 4 lo
  necesita para saber el id de la tarjeta recién creada). `colapsarProducto(prodId)` y
  `expandirProducto(prodId)`, nuevas.
- Consumes: `renderResumenProducto` (Tarea 1).

- [ ] **Step 1: Envolver los campos en `.product-item-fields` y agregar `.product-item-summary`**

En `pedido.html`, dentro de `addProductItem()`, cambiar:

```js
            const html = `
                <div class="card product-item" id="${id}">
                    <div class="product-item-header">
                        <strong>Producto <span class="prod-num">${productCounter}</span></strong>
                        <button type="button" class="remove-item-btn" onclick="removeProductItem('${id}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                    <div class="form-group">
                        <label>Tipo de producto</label>
```

por:

```js
            const html = `
                <div class="card product-item" id="${id}">
                    <div class="product-item-summary" id="${id}_summary" onclick="expandirProducto('${id}')">
                        <div class="resumen-producto-slot"></div>
                        <i class="fa-solid fa-pen product-item-summary-edit"></i>
                    </div>
                    <div class="product-item-fields" id="${id}_fields">
                    <div class="product-item-header">
                        <strong>Producto <span class="prod-num">${productCounter}</span></strong>
                        <button type="button" class="remove-item-btn" onclick="removeProductItem('${id}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                    <div id="${id}_resumen_preview"></div>
                    <div class="form-group">
                        <label>Tipo de producto</label>
```

- [ ] **Step 2: Cerrar `.product-item-fields` antes de cerrar la tarjeta**

En la misma plantilla, cambiar el final:

```js
                    <div class="form-group">
                        <label>Observaciones (opcional)</label>
                        <input type="text" id="${id}_obs" placeholder="Algo que debamos saber sobre este producto">
                    </div>
                </div>
            `;
```

por:

```js
                    <div class="form-group">
                        <label>Observaciones (opcional)</label>
                        <input type="text" id="${id}_obs" placeholder="Algo que debamos saber sobre este producto">
                    </div>
                    </div>
                </div>
            `;
```

- [ ] **Step 3: `addProductItem` devuelve el id**

En `pedido.html`, al final de `addProductItem` (después del bloque que agrega el listener de
`${id}_upload_area`), agregar antes del `}` de cierre de la función:

```js
            return id;
```

- [ ] **Step 4: Agregar `colapsarProducto` y `expandirProducto`**

En `pedido.html`, inmediatamente después de la función `removeProductItem`, agregar:

```js
        function colapsarProducto(prodId) {
            const summary = document.getElementById(`${prodId}_summary`);
            const fields = document.getElementById(`${prodId}_fields`);
            if (!summary || !fields) return;
            summary.querySelector('.resumen-producto-slot').innerHTML = renderResumenProducto(prodId);
            summary.style.display = 'flex';
            fields.style.display = 'none';
        }

        function expandirProducto(prodId) {
            const summary = document.getElementById(`${prodId}_summary`);
            const fields = document.getElementById(`${prodId}_fields`);
            if (!summary || !fields) return;
            summary.style.display = 'none';
            fields.style.display = 'block';
        }
```

- [ ] **Step 5: Verificar manualmente en el navegador**

Recargar `pedido.html`. En consola:

```js
colapsarProducto('prod_1');
JSON.stringify({
  summaryVisible: document.getElementById('prod_1_summary').style.display,
  fieldsVisible: document.getElementById('prod_1_fields').style.display,
  resumenText: document.getElementById('prod_1_summary').textContent.trim().slice(0, 40)
});
```

Expected: `summaryVisible: "flex"`, `fieldsVisible: "none"`, y `resumenText` debe mostrar "Producto sin
completar" (porque `prod_1` recién creado no tiene tipo elegido). Luego:

```js
expandirProducto('prod_1');
JSON.stringify({
  summaryVisible: document.getElementById('prod_1_summary').style.display,
  fieldsVisible: document.getElementById('prod_1_fields').style.display
});
```

Expected: `summaryVisible: "none"`, `fieldsVisible: "block"`. Sin errores de consola en ningún paso.

- [ ] **Step 6: Commit**

```bash
git add pedido.html
git commit -m "$(cat <<'EOF'
Agregar estructura colapsable a las tarjetas de producto

addProductItem ahora envuelve los campos en .product-item-fields y
agrega un contenedor .product-item-summary (oculto por defecto).
colapsarProducto/expandirProducto alternan cual de los dos se ve, sin
tocar ni perder ningun valor de los campos. Todavia no se conecta a
"Agregar otro producto" (siguiente tarea).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Conectar el mini-preview en vivo a los campos

**Files:**
- Modify: `pedido.html` (`onTipoProductoChange`, `updatePrice`, `selectTalla`, `selectColorFamilia`,
  `selectColorTono`, `selectPattern`, `renderImagePreviews`)

**Interfaces:**
- Consumes: `actualizarResumenProducto` (Tarea 1).

- [ ] **Step 1: Hook en `onTipoProductoChange`**

```js
        function onTipoProductoChange(prodId) {
            updateVariants(prodId);
            updateCamposPorTipo(prodId);
            actualizarResumenProducto(prodId);
        }
```

- [ ] **Step 2: Hook en `updatePrice`**

```js
        function updatePrice(prodId) {
            const select = document.getElementById(`${prodId}_variante`);
            const option = select.options[select.selectedIndex];
            const precio = option && option.dataset.price ? option.dataset.price : 0;
            document.getElementById(`${prodId}_precio`).value = precio;
            document.getElementById(`${prodId}_precio_display`).textContent = `S/ ${Number(precio).toFixed(2)}`;
            updateCorteVisibility(prodId);
            calculateTotal();
            actualizarResumenProducto(prodId);
        }
```

- [ ] **Step 3: Hook en `selectTalla`**

```js
        function selectTalla(prodId, talla) {
            document.getElementById(`${prodId}_talla`).value = talla;
            document.querySelectorAll(`#${prodId}_talla_chips .chip-option`).forEach(el => {
                el.classList.toggle('selected', el.textContent === talla);
            });
            actualizarResumenProducto(prodId);
        }
```

- [ ] **Step 4: Hook en `selectColorFamilia`**

```js
        function selectColorFamilia(prodId, key) {
            document.querySelectorAll(`#${prodId}_color_familias .chip-option`).forEach((el, idx) => {
                el.classList.toggle('selected', Object.keys(PANTONERA)[idx] === key);
            });
            const familia = PANTONERA[key];
            const tonosContainer = document.getElementById(`${prodId}_color_tonos`);
            tonosContainer.innerHTML = familia.colores.map(c =>
                `<span class="color-swatch-btn" style="background:${c.hex}" onclick="selectColorTono('${prodId}', '${c.codigo}', '${c.hex}')" title="${c.codigo}"></span>`
            ).join('');
            document.getElementById(`${prodId}_color_info`).style.display = 'none';
            document.getElementById(`${prodId}_color`).value = '';
            actualizarResumenProducto(prodId);
        }
```

- [ ] **Step 5: Hook en `selectColorTono`**

```js
        function selectColorTono(prodId, codigo, hex) {
            document.getElementById(`${prodId}_color`).value = codigo;
            document.querySelectorAll(`#${prodId}_color_tonos .color-swatch-btn`).forEach(el => {
                el.classList.toggle('selected', el.title === codigo);
            });
            const info = document.getElementById(`${prodId}_color_info`);
            info.style.display = 'flex';
            info.innerHTML = `<span class="sw" style="background:${hex}"></span> Elegiste ${codigo}`;
            actualizarResumenProducto(prodId);
        }
```

- [ ] **Step 6: Hook en `selectPattern` (los dos caminos)**

```js
        function selectPattern(prodId, patternId) {
            if (patternId === null) {
                document.getElementById(`${prodId}_patron`).value = 'Sin patrón';
                renderPatternGallery(prodId);
                actualizarResumenProducto(prodId);
                return;
            }
            const pattern = patterns.find(p => p.id === patternId);
            if (!pattern) return;
            document.getElementById(`${prodId}_patron`).value = pattern.nombre;
            renderPatternGallery(prodId);
            actualizarResumenProducto(prodId);
        }
```

- [ ] **Step 7: Hook en `renderImagePreviews`**

```js
        function renderImagePreviews(prodId) {
            const container = document.getElementById(`${prodId}_previews`);
            container.innerHTML = imagesFiles[prodId].map((f, idx) => `
                <div class="image-preview-wrapper">
                    <img src="${URL.createObjectURL(f)}" class="image-preview">
                    <button type="button" class="remove-img-btn" onclick="removeImage('${prodId}', ${idx})"><i class="fa-solid fa-xmark"></i></button>
                </div>
            `).join('');
            actualizarResumenProducto(prodId);
        }
```

- [ ] **Step 8: Verificar manualmente en el navegador**

Recargar `pedido.html`. En consola, ir llenando un producto paso a paso y revisar
`document.getElementById('prod_1_resumen_preview').textContent` después de cada uno:

```js
document.getElementById('prod_1_tipo').value = 'pijama';
onTipoProductoChange('prod_1');
document.getElementById('prod_1_resumen_preview').textContent
```

Expected: ya dice "Pijamas" (sin modelo todavía, sin chips).

```js
document.getElementById('prod_1_variante').value = catalog.find(c => c.tipo_producto === 'pijama').variante;
updatePrice('prod_1');
selectTalla('prod_1', 'M');
document.getElementById('prod_1_resumen_preview').textContent
```

Expected: ahora incluye el modelo, el precio, y el chip "M". Repetir agregando color y patrón (`selectColorFamilia`/`selectColorTono`/`selectPattern`) y confirmar que cada uno se refleja. Sin errores de consola en ningún paso.

- [ ] **Step 9: Commit**

```bash
git add pedido.html
git commit -m "$(cat <<'EOF'
Conectar el mini-preview en vivo a los campos del producto

actualizarResumenProducto() se llama ahora desde cada handler que
cambia tipo, modelo, talla, color o patron, y desde
renderImagePreviews (cubre subir y quitar fotos). La franja debajo del
encabezado "Producto N" se actualiza en cada paso mientras se llena.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Colapsar al agregar otro producto + auto-expandir en error

**Files:**
- Modify: `pedido.html` (`validarFormulario`, agregar `validarProducto`)
- Modify: `pedido.html` (`mostrarErrorValidacion`)
- Modify: `pedido.html` (agregar `agregarOtroProducto`, cambiar el botón "Agregar otro producto")

**Interfaces:**
- Produces: `validarProducto(div, numero)` → `{ valido: true } | { valido: false, prodId, mensaje }`
  (misma forma que ya devolvía el bloque interno de `validarFormulario`). `agregarOtroProducto()` → `void`,
  reemplaza a `addProductItem()` como handler del botón.
- Consumes: `validarProducto`, `mostrarErrorValidacion`, `colapsarProducto`, `addProductItem` (ahora con
  su valor de retorno, Tarea 2).

- [ ] **Step 1: Extraer `validarProducto` de `validarFormulario`**

En `pedido.html`, reemplazar la función completa `validarFormulario` (desde `function
validarFormulario() {` hasta el `}` que la cierra, justo antes de `function mostrarErrorValidacion`) por:

```js
        function validarFormulario() {
            const clienteNombre = document.getElementById('cliente_nombre').value.trim();
            const clienteContacto = document.getElementById('cliente_contacto').value.trim();
            if (!clienteNombre || !clienteContacto) {
                return { valido: false, mensaje: 'Completa tu nombre y contacto antes de continuar.' };
            }

            const productDivs = document.querySelectorAll('.product-item');
            if (productDivs.length === 0) {
                return { valido: false, mensaje: 'Agrega al menos un producto.' };
            }

            let numero = 0;
            for (const div of productDivs) {
                numero++;
                const resultado = validarProducto(div, numero);
                if (!resultado.valido) return resultado;
            }

            return { valido: true };
        }

        function validarProducto(div, numero) {
            const prodId = div.id;
            const tipo = document.getElementById(`${prodId}_tipo`).value;
            const variante = document.getElementById(`${prodId}_variante`).value;
            const tipoLabel = TIPO_PRODUCTO_LABELS[tipo] || tipo || 'Producto';

            if (!tipo || !variante) {
                return { valido: false, prodId, mensaje: `El Producto ${numero} (${tipoLabel || 'sin tipo'}) todavía no tiene Tipo y Modelo completos — revísalo arriba.` };
            }

            const requeridos = CAMPOS_REQUERIDOS_POR_TIPO[tipo] || [];
            for (const campo of requeridos) {
                let valorValido;
                if (campo === 'fotos') {
                    valorValido = imagesFiles[prodId] && imagesFiles[prodId].length > 0;
                } else {
                    const el = document.getElementById(`${prodId}_${campo}`);
                    valorValido = el && el.value.trim() !== '';
                }
                if (!valorValido) {
                    return { valido: false, prodId, mensaje: `El Producto ${numero} (${tipoLabel}) todavía no tiene ${NOMBRE_CAMPO[campo]} — revísalo arriba.` };
                }
            }
            return { valido: true };
        }
```

- [ ] **Step 2: Auto-expandir en `mostrarErrorValidacion`**

En `pedido.html`, cambiar:

```js
        function mostrarErrorValidacion(resultado) {
            const errorEl = document.getElementById('submit-error');
            errorEl.textContent = resultado.mensaje;
            errorEl.style.display = 'block';

            if (resultado.prodId) {
                const div = document.getElementById(resultado.prodId);
                if (div) {
                    div.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    div.classList.add('error-highlight');
                    setTimeout(() => div.classList.remove('error-highlight'), 2000);
                }
            }
        }
```

por:

```js
        function mostrarErrorValidacion(resultado) {
            const errorEl = document.getElementById('submit-error');
            errorEl.textContent = resultado.mensaje;
            errorEl.style.display = 'block';

            if (resultado.prodId) {
                const fields = document.getElementById(`${resultado.prodId}_fields`);
                if (fields && fields.style.display === 'none') {
                    expandirProducto(resultado.prodId);
                }
                const div = document.getElementById(resultado.prodId);
                if (div) {
                    div.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    div.classList.add('error-highlight');
                    setTimeout(() => div.classList.remove('error-highlight'), 2000);
                }
            }
        }
```

- [ ] **Step 3: Agregar `agregarOtroProducto` y cambiar el botón**

En `pedido.html`, inmediatamente antes de `function onCanalChange() {`, agregar:

```js
        function agregarOtroProducto() {
            const productDivs = document.querySelectorAll('.product-item');
            if (productDivs.length > 0) {
                const ultimo = productDivs[productDivs.length - 1];
                const fields = document.getElementById(`${ultimo.id}_fields`);
                const estaExpandido = fields && fields.style.display !== 'none';
                if (estaExpandido) {
                    const resultado = validarProducto(ultimo, productDivs.length);
                    if (!resultado.valido) {
                        mostrarErrorValidacion(resultado);
                        return;
                    }
                    colapsarProducto(ultimo.id);
                }
            }
            const nuevoId = addProductItem();
            const nuevoDiv = document.getElementById(nuevoId);
            if (nuevoDiv) nuevoDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
```

Y cambiar el botón (dentro de `renderForm`):

```html
                <div class="card" style="text-align:center;">
                    <button type="button" class="btn btn-secondary" onclick="addProductItem()">
                        <i class="fa-solid fa-plus"></i> Agregar otro producto
                    </button>
                </div>
```

por:

```html
                <div class="card" style="text-align:center;">
                    <button type="button" class="btn btn-secondary" onclick="agregarOtroProducto()">
                        <i class="fa-solid fa-plus"></i> Agregar otro producto
                    </button>
                </div>
```

- [ ] **Step 4: Verificar manualmente en el navegador (flujo completo)**

Recargar `pedido.html`. Con consola:

```js
document.getElementById('cliente_nombre').value = 'PRUEBA';
document.getElementById('cliente_contacto').value = '999';
agregarOtroProducto();
JSON.stringify(document.getElementById('submit-error').textContent);
```

Expected: como `prod_1` está vacío (sin tipo), debe mostrar el error "El Producto 1 (sin tipo)..." y
**no** debe existir `prod_2` (`document.getElementById('prod_2')` debe ser `null`).

Ahora completar `prod_1` (tipo tote_bag es el más rápido — sin color/patrón):

```js
document.getElementById('prod_1_tipo').value = 'tote_bag';
onTipoProductoChange('prod_1');
document.getElementById('prod_1_variante').value = catalog.find(c => c.tipo_producto === 'tote_bag').variante;
updatePrice('prod_1');
document.getElementById('prod_1_mascota').value = 'Firulais';
imagesFiles['prod_1'].push(new File(['x'], 'f.png', { type: 'image/png' }));

agregarOtroProducto();
JSON.stringify({
  prod1Summary: document.getElementById('prod_1_summary').style.display,
  prod1Fields: document.getElementById('prod_1_fields').style.display,
  prod2Existe: !!document.getElementById('prod_2'),
  prod2Fields: document.getElementById('prod_2_fields') ? document.getElementById('prod_2_fields').style.display : null
});
```

Expected: `prod1Summary: "flex"`, `prod1Fields: "none"` (colapsado), `prod2Existe: true`, `prod2Fields:
"block"` (el nuevo, abierto). Tocar `document.getElementById('prod_1_summary').click()` en consola debe
volver a expandir `prod_1` con `Firulais` todavía en el campo de nombre de mascota.

Por último, probar el auto-expandir: colapsar `prod_1` de nuevo, borrarle el nombre de mascota
directamente en el DOM (simulando que quedó incompleto) y correr `mostrarErrorValidacion({ valido:
false, prodId: 'prod_1', mensaje: 'prueba' })` — `prod_1_fields` debe volver a `display: "block"`
automáticamente.

- [ ] **Step 5: Commit**

```bash
git add pedido.html
git commit -m "$(cat <<'EOF'
Colapsar tarjeta al agregar otro producto, con validacion previa

agregarOtroProducto() valida el ultimo producto abierto (validarProducto,
extraida de validarFormulario) antes de colapsarlo y agregar uno nuevo
— si esta incompleto, no agrega nada y muestra el mismo error de
siempre. mostrarErrorValidacion ahora expande automaticamente una
tarjeta colapsada si el error apunta a ella.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Verificación end-to-end real y publicación

**Files:**
- No se modifica código en esta tarea — solo verificación y push.

- [ ] **Step 1: Confirmar el caso de un solo producto (el más común)**

Con el servidor local corriendo, llenar un pedido de un solo producto de punta a punta (sin tocar
"Agregar otro producto") y confirmar que se ve y se comporta exactamente igual que antes de este plan —
nunca debe colapsarse nada.

- [ ] **Step 2: Confirmar el flujo con 2 productos, real, contra Supabase**

Armar un pedido real de prueba con 2 productos (ej. un Tote bag y un Polo), usando "Agregar otro
producto" para pasar del primero al segundo (debe colapsar el primero automáticamente). Revisar el
primero colapsado, tocarlo para confirmar que reabre con sus datos. Completar el segundo, pasar por la
pantalla de revisión (Grupo 1) y confirmar y enviar. Verificar en Supabase que ambos productos quedaron
bien guardados, y borrar el pedido de prueba después.

- [ ] **Step 3: Push a producción**

```bash
git push origin main
```

- [ ] **Step 4: Verificar en el sitio real**

Esperar el deploy de Vercel y repetir la prueba de 2 productos (Step 2) contra
`https://registro-pedidos-pf.vercel.app/pedido.html`, borrando el pedido de prueba al final.
