# Campos que se pintan, "Tus datos" colapsable y miniatura de patrón — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En `pedido.html`, reemplazar el mini-preview en vivo (que quedaba fuera de vista) por un
marcado verde progresivo en cada campo obligatorio; hacer que "Tus datos" sea la primera tarjeta
colapsable del formulario, detrás de un botón "Continuar"; y mostrar la miniatura real del patrón
elegido en la ficha de resumen en vez de solo su número.

**Architecture:** Los 3 cambios son independientes entre sí dentro del mismo archivo. El marcado verde
reutiliza los mismos hooks que ya llamaban a `actualizarResumenProducto` (que se elimina). "Tus datos"
colapsable reutiliza el mismo patrón visual `summary`/`fields` ya usado en las tarjetas de producto,
aplicado a una tarjeta nueva. La miniatura de patrón extiende `renderFichaResumen` con un lookup en
`patterns` filtrado por especie, igual al ya corregido en `index.html`.

**Tech Stack:** HTML/CSS/JS vanilla, sin dependencias nuevas.

## Global Constraints

- El marcado verde aplica exactamente a los campos de `CAMPOS_REQUERIDOS_POR_TIPO` (Grupo 1) más Tipo y
  Modelo siempre — no se inventan campos nuevos a marcar.
- "Continuar" es un botón explícito — nunca se avanza automáticamente al completar los campos de "Tus
  datos".
- El lookup de patrón para la miniatura debe filtrar por `tipo_mascota` del producto, igual que el fix
  ya aplicado en `index.html` (`resolvePatronImagen`) — nunca solo por nombre.
- No se toca `index.html` ni ninguna tabla/columna de Supabase.

---

### Task 1: Reemplazar el mini-preview por campos que se marcan en verde

**Files:**
- Modify: `pedido.html` (CSS: eliminar reglas del mini-preview ya sin uso no aplica — se mantienen,
  `renderResumenProducto` las sigue usando para la tarjeta colapsada; se agregan las nuevas)
- Modify: `pedido.html` (`addProductItem`: quitar el contenedor del mini-preview, agregar ids a Tipo/
  Modelo/Fotos)
- Modify: `pedido.html` (eliminar `actualizarResumenProducto`, agregar `marcarCampoCompleto` y
  `actualizarEstadoCampos`)
- Modify: `pedido.html` (7 call sites: `onTipoProductoChange`, `updatePrice`, `selectTalla`,
  `selectColorFamilia`, `selectColorTono`, `selectPattern` x2, `renderImagePreviews`)

**Interfaces:**
- Produces: `actualizarEstadoCampos(prodId)` → `void`, reemplaza a `actualizarResumenProducto` en todos
  los hooks. `marcarCampoCompleto(groupId, completo)` → `void`, helper interno.
- Consumes: `CAMPOS_REQUERIDOS_POR_TIPO` (ya existente, Grupo 1).

- [ ] **Step 1: CSS del campo completo**

En `pedido.html`, inmediatamente después de `.resumen-producto-precio { ... }`, agregar:

```css
        .form-group.form-group-completo { border-left: 3px solid var(--success); padding-left: 12px; }
        .form-group.form-group-completo > label::after { content: " ✓"; color: var(--success); }
```

- [ ] **Step 2: Quitar el contenedor del mini-preview y agregar ids a Tipo/Modelo/Fotos**

En `pedido.html`, dentro de `addProductItem`, cambiar:

```js
                    <div id="${id}_resumen_preview"></div>
                    <div class="form-group">
                        <label>Tipo de producto</label>
                        <select id="${id}_tipo" onchange="onTipoProductoChange('${id}')">
                            <option value="">Selecciona...</option>
                            ${typeOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Modelo</label>
                        <select id="${id}_variante" onchange="updatePrice('${id}')">
                            <option value="">Elige el tipo primero</option>
                        </select>
                    </div>
```

por:

```js
                    <div class="form-group" id="${id}_tipo_group">
                        <label>Tipo de producto</label>
                        <select id="${id}_tipo" onchange="onTipoProductoChange('${id}')">
                            <option value="">Selecciona...</option>
                            ${typeOptions}
                        </select>
                    </div>
                    <div class="form-group" id="${id}_variante_group">
                        <label>Modelo</label>
                        <select id="${id}_variante" onchange="updatePrice('${id}')">
                            <option value="">Elige el tipo primero</option>
                        </select>
                    </div>
```

Y más abajo, en el mismo `addProductItem`, cambiar:

```js
                    <div class="form-group">
                        <label>Fotos de tu mascota</label>
```

por:

```js
                    <div class="form-group" id="${id}_fotos_group">
                        <label>Fotos de tu mascota</label>
```

- [ ] **Step 3: Reemplazar `actualizarResumenProducto` por `actualizarEstadoCampos`**

En `pedido.html`, cambiar:

```js
        function actualizarResumenProducto(prodId) {
            const el = document.getElementById(`${prodId}_resumen_preview`);
            if (el) el.innerHTML = renderResumenProducto(prodId);
        }
```

por:

```js
        function marcarCampoCompleto(groupId, completo) {
            const el = document.getElementById(groupId);
            if (el) el.classList.toggle('form-group-completo', completo);
        }

        function actualizarEstadoCampos(prodId) {
            const tipo = document.getElementById(`${prodId}_tipo`).value;
            const variante = document.getElementById(`${prodId}_variante`).value;
            marcarCampoCompleto(`${prodId}_tipo_group`, !!tipo);
            marcarCampoCompleto(`${prodId}_variante_group`, !!variante);

            const tallaGroup = document.getElementById(`${prodId}_talla_group`);
            if (tallaGroup && tallaGroup.style.display !== 'none') {
                const tallaEl = document.getElementById(`${prodId}_talla`);
                marcarCampoCompleto(`${prodId}_talla_group`, !!(tallaEl && tallaEl.value));
            }

            const colorGroup = document.getElementById(`${prodId}_color_group`);
            if (colorGroup && colorGroup.style.display !== 'none') {
                const colorEl = document.getElementById(`${prodId}_color`);
                marcarCampoCompleto(`${prodId}_color_group`, !!(colorEl && colorEl.value));
            }

            const patronGroup = document.getElementById(`${prodId}_patron_group`);
            if (patronGroup && patronGroup.style.display !== 'none') {
                const patronEl = document.getElementById(`${prodId}_patron`);
                marcarCampoCompleto(`${prodId}_patron_group`, !!(patronEl && patronEl.value));
            }

            marcarCampoCompleto(`${prodId}_fotos_group`, imagesFiles[prodId] && imagesFiles[prodId].length > 0);
        }
```

- [ ] **Step 4: Cambiar los 7 call sites**

En `pedido.html`, reemplazar cada aparición de `actualizarResumenProducto(prodId);` por
`actualizarEstadoCampos(prodId);` — ocurre dentro de `onTipoProductoChange`, `updatePrice`,
`selectTalla`, `selectColorFamilia`, `selectColorTono`, dos veces en `selectPattern`, y en
`renderImagePreviews`. Confirmar con:

```bash
grep -n "actualizarResumenProducto\|actualizarEstadoCampos" pedido.html
```

Expected: 0 apariciones de `actualizarResumenProducto`, 8 de `actualizarEstadoCampos` (7 llamadas +
la definición).

- [ ] **Step 5: Verificar manualmente en el navegador**

Levantar el servidor estático local y abrir `pedido.html`. En consola:

```js
document.getElementById('prod_1_tipo').value = 'pijama';
onTipoProductoChange('prod_1');
document.getElementById('prod_1_variante').value = catalog.find(c => c.tipo_producto === 'pijama').variante;
updatePrice('prod_1');
JSON.stringify({
  tipoCompleto: document.getElementById('prod_1_tipo_group').classList.contains('form-group-completo'),
  varianteCompleto: document.getElementById('prod_1_variante_group').classList.contains('form-group-completo'),
  tallaCompleto: document.getElementById('prod_1_talla_group').classList.contains('form-group-completo')
});
```

Expected: `tipoCompleto: true`, `varianteCompleto: true`, `tallaCompleto: false` (todavía no se eligió
talla). Luego `selectTalla('prod_1', 'M')` y volver a revisar `prod_1_talla_group` — debe pasar a
`true`. Confirmar visualmente (zoom o screenshot) que esos campos ahora tienen un borde verde a la
izquierda y un check junto a la etiqueta. Sin errores de consola.

- [ ] **Step 6: Commit**

```bash
git add pedido.html
git commit -m "$(cat <<'EOF'
Reemplazar el mini-preview por campos que se marcan en verde

El mini-preview vivia fijo debajo del encabezado y quedaba fuera de
vista al bajar en la tarjeta. Se reemplaza por actualizarEstadoCampos,
que marca cada campo obligatorio (Tipo, Modelo, Talla/Color/Patron/
Fotos segun aplique) con un check y borde verde apenas queda
completo, visible sin importar cuanto se haya bajado.
renderResumenProducto se mantiene para el resumen de tarjeta
colapsada, que no cambia.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: "Tus datos" colapsable con botón "Continuar"

**Files:**
- Modify: `pedido.html` (`renderForm`: reestructurar en 2 fases)
- Modify: `pedido.html` (agregar `continuarDesdeDatos`, `expandirDatos`)

**Interfaces:**
- Produces: `continuarDesdeDatos()` → `void`, valida nombre/contacto, colapsa "Tus datos" y revela el
  resto del formulario (creando Producto 1 si todavía no existe ningún producto).
  `expandirDatos()` → `void`, vuelve a mostrar los campos de "Tus datos" sin afectar el resto.
- Consumes: `addProductItem` (ya existente).

- [ ] **Step 1: Reestructurar `renderForm`**

En `pedido.html`, reemplazar la función completa `renderForm` por:

```js
        function renderForm() {
            document.getElementById('form-view').innerHTML = `
                <div class="card">
                    <div class="datos-summary" id="datos_summary" style="display:none; align-items:center; justify-content:space-between; cursor:pointer;" onclick="expandirDatos()">
                        <span id="datos_resumen_texto"></span>
                        <i class="fa-solid fa-pen product-item-summary-edit"></i>
                    </div>
                    <div id="datos_fields">
                        <h2>Tus datos</h2>
                        <div class="form-group">
                            <label>¿Por dónde nos escribes?</label>
                            <select id="cliente_canal" onchange="onCanalChange()">
                                <option value="wpp">WhatsApp</option>
                                <option value="ig">Instagram</option>
                                <option value="otro">TikTok / Otro</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label id="cliente_nombre_label">Nombre</label>
                            <input type="text" id="cliente_nombre" required>
                        </div>
                        <div class="form-group">
                            <label>Contacto (teléfono o usuario)</label>
                            <input type="text" id="cliente_contacto" required>
                        </div>
                        <p id="datos-error" style="display:none; color: var(--danger); margin-bottom: 1rem; font-size: 0.85rem;"></p>
                        <button type="button" class="btn" onclick="continuarDesdeDatos()" style="width:100%;">Continuar</button>
                    </div>
                </div>

                <div id="resto-pedido" style="display:none;">
                    <div id="productos-container"></div>

                    <div class="card" style="text-align:center;">
                        <button type="button" class="btn btn-secondary" onclick="agregarOtroProducto()">
                            <i class="fa-solid fa-plus"></i> Agregar otro producto
                        </button>
                    </div>

                    <div class="card">
                        <div style="display:flex; justify-content:space-between; align-items:center; font-family: var(--font-display); font-size: 1.2rem;">
                            <span>Total</span>
                            <span id="total-display">S/ 0.00</span>
                        </div>
                    </div>

                    <div class="info-banner">
                        El plazo máximo de producción son 7 días hábiles 🗓️ sin embargo en caso su
                        pedido esté listo antes le enviaremos el mensajito para coordinar el envío ⭐️✅
                    </div>

                    <p id="submit-error" style="display:none; color: var(--danger); margin-bottom: 1rem; font-size: 0.85rem;"></p>

                    <button type="button" class="btn" id="btn-enviar" onclick="revisarPedido()" style="width:100%;">
                        <span id="btn-enviar-text">Registrar pedido</span>
                        <div class="loader" id="btn-enviar-loader" style="display:none;"></div>
                    </button>
                </div>
            `;
        }
```

(Nota: ya no se llama `addProductItem()` al final — eso pasa a `continuarDesdeDatos`, Step 2.)

- [ ] **Step 2: Agregar `continuarDesdeDatos` y `expandirDatos`**

En `pedido.html`, inmediatamente después de la función `renderForm`, agregar:

```js
        function continuarDesdeDatos() {
            const clienteNombre = document.getElementById('cliente_nombre').value.trim();
            const clienteContacto = document.getElementById('cliente_contacto').value.trim();
            const errorEl = document.getElementById('datos-error');

            if (!clienteNombre || !clienteContacto) {
                errorEl.textContent = 'Completa tu nombre y contacto antes de continuar.';
                errorEl.style.display = 'block';
                return;
            }
            errorEl.style.display = 'none';

            const canal = document.getElementById('cliente_canal').value;
            const canalLabel = canal === 'wpp' ? 'WhatsApp' : (canal === 'ig' ? 'Instagram' : 'TikTok / Otro');
            document.getElementById('datos_resumen_texto').textContent = `${clienteNombre} — ${canalLabel} — ${clienteContacto}`;
            document.getElementById('datos_summary').style.display = 'flex';
            document.getElementById('datos_fields').style.display = 'none';
            document.getElementById('resto-pedido').style.display = 'block';

            if (document.querySelectorAll('.product-item').length === 0) {
                addProductItem();
            }
        }

        function expandirDatos() {
            document.getElementById('datos_summary').style.display = 'none';
            document.getElementById('datos_fields').style.display = 'block';
        }
```

- [ ] **Step 3: Verificar manualmente en el navegador**

Recargar `pedido.html`. Expected: solo se ve la tarjeta "Tus datos" con el botón "Continuar" — sin
ninguna tarjeta de producto, botón de agregar, total ni botón de enviar visibles. Confirmar con:

```js
JSON.stringify({
  productoExiste: !!document.getElementById('prod_1'),
  restoVisible: document.getElementById('resto-pedido').style.display
});
```

Expected: `productoExiste: false`, `restoVisible: "none"`. Tocar "Continuar" sin llenar nada:

```js
continuarDesdeDatos();
document.getElementById('datos-error').style.display
```

Expected: `"block"`, y `resto-pedido` sigue en `"none"`. Ahora completar y continuar:

```js
document.getElementById('cliente_nombre').value = 'María';
document.getElementById('cliente_contacto').value = '987654321';
continuarDesdeDatos();
JSON.stringify({
  datosSummary: document.getElementById('datos_summary').style.display,
  datosFields: document.getElementById('datos_fields').style.display,
  restoVisible: document.getElementById('resto-pedido').style.display,
  productoExiste: !!document.getElementById('prod_1'),
  resumenTexto: document.getElementById('datos_resumen_texto').textContent
});
```

Expected: `datosSummary: "flex"`, `datosFields: "none"`, `restoVisible: "block"`, `productoExiste: true`,
`resumenTexto: "María — WhatsApp — 987654321"`. Tocar `document.getElementById('datos_summary').click()`
y confirmar que reabre los campos con "María" y "987654321" todavía ahí, sin que `prod_1` desaparezca.

- [ ] **Step 4: Commit**

```bash
git add pedido.html
git commit -m "$(cat <<'EOF'
Hacer "Tus datos" colapsable detras de un boton Continuar

renderForm ahora solo muestra la tarjeta de datos del cliente al
cargar. El resto del formulario (productos, total, boton de enviar)
no existe en el DOM hasta tocar "Continuar", que valida nombre/
contacto, colapsa "Tus datos" a un resumen, y recien ahi crea el
Producto 1. Reabrir "Tus datos" no afecta los productos ya armados.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Miniatura del patrón en la ficha de resumen

**Files:**
- Modify: `pedido.html` (CSS: agregar `.ficha-chip-thumb`)
- Modify: `pedido.html` (`construirResumenPreview`, agregar `tipo_mascota` al item)
- Modify: `pedido.html` (`confirmarYEnviarPedido`, agregar `tipo_mascota` a `itemsResumen.push`)
- Modify: `pedido.html` (`renderFichaResumen`, resolver la miniatura del patrón)

**Interfaces:**
- Consumes: `patterns` (array global ya cargado, con `nombre`, `tipo_mascota`, `imagen_url` por fila).

- [ ] **Step 1: CSS de la miniatura**

En `pedido.html`, inmediatamente después de `.ficha-chip-swatch { width: 10px; height: 10px;
border-radius: 3px; flex-shrink: 0; }`, agregar:

```css
        .ficha-chip-thumb { width: 16px; height: 16px; border-radius: 3px; object-fit: cover; flex-shrink: 0; }
```

- [ ] **Step 2: Agregar `tipo_mascota` a `construirResumenPreview`**

En `pedido.html`, dentro de `construirResumenPreview`, cambiar:

```js
                items.push({
                    tipo_producto: document.getElementById(`${prodId}_tipo`).value,
                    variante: document.getElementById(`${prodId}_variante`).value,
                    talla: document.getElementById(`${prodId}_talla`) ? document.getElementById(`${prodId}_talla`).value : '',
                    corte: (aplicaCorte && corteEl) ? corteEl.value : '',
                    color: document.getElementById(`${prodId}_color`) ? document.getElementById(`${prodId}_color`).value : '',
                    patron: document.getElementById(`${prodId}_patron`) ? document.getElementById(`${prodId}_patron`).value : '',
                    precio_unitario: precioUnitario,
                    fotos: fotosPreview
                });
```

por:

```js
                const tipoMascotaEl = document.getElementById(`${prodId}_tipo_mascota`);
                items.push({
                    tipo_producto: document.getElementById(`${prodId}_tipo`).value,
                    variante: document.getElementById(`${prodId}_variante`).value,
                    talla: document.getElementById(`${prodId}_talla`) ? document.getElementById(`${prodId}_talla`).value : '',
                    corte: (aplicaCorte && corteEl) ? corteEl.value : '',
                    color: document.getElementById(`${prodId}_color`) ? document.getElementById(`${prodId}_color`).value : '',
                    patron: document.getElementById(`${prodId}_patron`) ? document.getElementById(`${prodId}_patron`).value : '',
                    tipo_mascota: tipoMascotaEl ? tipoMascotaEl.value : null,
                    precio_unitario: precioUnitario,
                    fotos: fotosPreview
                });
```

- [ ] **Step 3: Agregar `tipo_mascota` al `itemsResumen` de `confirmarYEnviarPedido`**

En `pedido.html`, dentro de `confirmarYEnviarPedido`, cambiar:

```js
                    itemsResumen.push({
                        tipo_producto: document.getElementById(`${prodId}_tipo`).value,
                        variante: document.getElementById(`${prodId}_variante`).value,
                        talla: document.getElementById(`${prodId}_talla`) ? document.getElementById(`${prodId}_talla`).value : '',
                        corte: (aplicaCorte && corteEl) ? corteEl.value : '',
                        color: document.getElementById(`${prodId}_color`) ? document.getElementById(`${prodId}_color`).value : '',
                        patron: document.getElementById(`${prodId}_patron`) ? document.getElementById(`${prodId}_patron`).value : '',
                        precio_unitario: precioUnitario,
                        fotos: uploadedUrls
                    });
```

por:

```js
                    itemsResumen.push({
                        tipo_producto: document.getElementById(`${prodId}_tipo`).value,
                        variante: document.getElementById(`${prodId}_variante`).value,
                        talla: document.getElementById(`${prodId}_talla`) ? document.getElementById(`${prodId}_talla`).value : '',
                        corte: (aplicaCorte && corteEl) ? corteEl.value : '',
                        color: document.getElementById(`${prodId}_color`) ? document.getElementById(`${prodId}_color`).value : '',
                        patron: document.getElementById(`${prodId}_patron`) ? document.getElementById(`${prodId}_patron`).value : '',
                        tipo_mascota: tipoMascotaEl ? tipoMascotaEl.value : null,
                        precio_unitario: precioUnitario,
                        fotos: uploadedUrls
                    });
```

(`tipoMascotaEl` ya está declarado un par de líneas arriba en esta misma función, no hace falta
declararlo de nuevo.)

- [ ] **Step 4: Resolver la miniatura en `renderFichaResumen`**

En `pedido.html`, dentro de `renderFichaResumen`, cambiar:

```js
                if (item.patron) chips.push(`<span class="ficha-chip">${escapeHtml(item.patron)}</span>`);
```

por:

```js
                if (item.patron && item.patron !== 'Sin patrón') {
                    const patronInfo = patterns.find(p => p.nombre === item.patron &&
                        (!p.tipo_mascota || p.tipo_mascota === 'ambos' || p.tipo_mascota === item.tipo_mascota));
                    chips.push(patronInfo
                        ? `<span class="ficha-chip"><img class="ficha-chip-thumb" src="${patronInfo.imagen_url}" alt="">${escapeHtml(item.patron)}</span>`
                        : `<span class="ficha-chip">${escapeHtml(item.patron)}</span>`);
                } else if (item.patron === 'Sin patrón') {
                    chips.push(`<span class="ficha-chip">Sin patrón</span>`);
                }
```

- [ ] **Step 5: Verificar manualmente en el navegador**

Recargar `pedido.html`, completar "Tus datos" y un producto Pijama con un patrón real elegido (no "Sin
patrón") y una foto, y llamar `revisarPedido()`. Expected: en la ficha de revisión, el chip de patrón
debe mostrar la miniatura real (una imagen chica de 16x16 antes del texto), no solo el número. Repetir
eligiendo "Sin patrón" en otro producto — el chip debe decir "Sin patrón" sin ninguna imagen, sin error
en consola.

Para confirmar que el filtro por especie funciona, en consola:

```js
JSON.stringify({
  perro: patterns.find(p => p.nombre === '2' && p.tipo_mascota === 'perro'),
  gato: patterns.find(p => p.nombre === '2' && p.tipo_mascota === 'gato')
});
```

Si existen ambos (perro "2" y gato "2"), confirmar visualmente que un producto de perro con patrón "2"
muestra la miniatura de perro, y uno de gato con patrón "2" muestra la de gato.

- [ ] **Step 6: Commit**

```bash
git add pedido.html
git commit -m "$(cat <<'EOF'
Mostrar la miniatura real del patron en la ficha de resumen

renderFichaResumen buscaba el patron solo por nombre (un numero,
repetido igual en perro y gato) sin resolver ninguna imagen - el
cliente veia un chip con solo un numero suelto. Ahora busca en
patterns filtrando tambien por tipo_mascota (el mismo fix ya aplicado
en index.html) y muestra la miniatura real. "Sin patron" se sigue
mostrando como texto, sin imagen.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Verificación end-to-end real y publicación

**Files:**
- No se modifica código en esta tarea — solo verificación y push.

- [ ] **Step 1: Flujo completo real, con patrón real y con "Sin patrón"**

Con el servidor local corriendo: completar "Tus datos", tocar "Continuar", armar un Producto 1 Pijama
con un patrón real (confirmar que sus campos se van pintando de verde a medida que se llenan), agregar
un Producto 2 Pijama con "Sin patrón" elegido. Pasar por "Revisar tu pedido" y confirmar que ambos
patrones se ven correctos (uno con miniatura, el otro con el texto "Sin patrón"). Confirmar y enviar.
Verificar en Supabase que ambos items quedaron con su `tipo_mascota` y `patron` correctos, y borrar el
pedido de prueba después.

- [ ] **Step 2: Push a producción**

```bash
git push origin main
```

- [ ] **Step 3: Verificar en el sitio real**

Esperar el deploy de Vercel y repetir el flujo del Step 1 contra
`https://registro-pedidos-pf.vercel.app/pedido.html`, borrando el pedido de prueba al final.
