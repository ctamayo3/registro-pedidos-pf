# Validación específica y revisión antes de enviar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En `pedido.html`, reemplazar la validación genérica por una que señale el producto y campo
exacto que falta, agregar una opción "Sin patrón", y agregar una pantalla de revisión (con preview local
de fotos) entre "llenar el formulario" y "guardar de verdad en Supabase".

**Architecture:** Todo el cambio vive en `pedido.html`. Se separa la función `enviarPedido()` (que hoy
valida + guarda todo junto) en: `validarFormulario()` (revisa reglas por tipo de producto),
`revisarPedido()` (valida y, si pasa, arma una vista previa con `URL.createObjectURL` sin tocar
Supabase), y `confirmarYEnviarPedido()` (la lógica real de guardado, idéntica a la de hoy, movida a un
botón nuevo en la pantalla de revisión).

**Tech Stack:** HTML/CSS/JS vanilla, sin dependencias nuevas.

## Global Constraints

- Reglas de campos obligatorios por tipo (exactas, del spec, no inventar variaciones):
  - Pijama: Talla, Color, Patrón (o "Sin patrón" explícito), al menos 1 foto.
  - Polo: Talla, Nombre de la mascota, al menos 1 foto.
  - Tote bag: Nombre de la mascota, al menos 1 foto (sin talla).
- Las fotos en la pantalla de revisión usan `URL.createObjectURL(file)` — no se suben a Supabase
  Storage hasta que el cliente toca "Confirmar y enviar".
- No se toca `index.html` ni ninguna tabla/columna de Supabase — cambio 100% dentro de `pedido.html`.
- Todo texto insertado vía `innerHTML` que venga de datos sigue pasando por `escapeHtml()` — no se
  agrega texto libre nuevo sin escapar en este plan (los mensajes de error son texto fijo con nombres de
  campo ya conocidos, no datos del usuario).

---

### Task 1: Opción "Sin patrón" en la galería de patrones

**Files:**
- Modify: `pedido.html` (CSS, cerca de `.pattern-option`)
- Modify: `pedido.html` (`renderPatternGallery`)
- Modify: `pedido.html` (`selectPattern`)

**Interfaces:**
- Produces: al elegir "Sin patrón", el input oculto `${prodId}_patron` queda con el valor literal
  `"Sin patrón"` (no vacío) — la Tarea 2 depende de que este valor sea no-vacío para que la validación
  lo cuente como "campo completo".

- [ ] **Step 1: CSS para la tarjeta vacía de "Sin patrón"**

En `pedido.html`, justo después de la regla `.pattern-option span { ... }` (busca
`.pattern-option span { display:block; font-size: 0.68rem; margin-top: 4px; }`), agregar:

```css
        .pattern-option-empty { width:100%; aspect-ratio:1; background: var(--card-secondary);
            border-radius: 10px; display:flex; align-items:center; justify-content:center;
            color: var(--text-muted); font-size: 1.4rem; }
```

- [ ] **Step 2: Agregar la tarjeta "Sin patrón" a `renderPatternGallery`**

En `pedido.html`, reemplazar:

```js
        function renderPatternGallery(prodId) {
            const tipoMascotaSelect = document.getElementById(`${prodId}_tipo_mascota`);
            const tipoMascota = tipoMascotaSelect ? tipoMascotaSelect.value : 'perro';
            const filtered = patterns.filter(p => !p.tipo_mascota || p.tipo_mascota === 'ambos' || p.tipo_mascota === tipoMascota);
            const container = document.getElementById(`${prodId}_patron_gallery`);
            if (!container) return;
            const currentValue = document.getElementById(`${prodId}_patron`).value;
            container.innerHTML = filtered.map(p => `
                <div class="pattern-option ${currentValue === p.nombre ? 'selected' : ''}" onclick="selectPattern('${prodId}', ${p.id})">
                    <img src="${p.imagen_url}" alt="${escapeHtml(p.nombre)}">
                    <span>${escapeHtml(p.nombre)}</span>
```

por:

```js
        function renderPatternGallery(prodId) {
            const tipoMascotaSelect = document.getElementById(`${prodId}_tipo_mascota`);
            const tipoMascota = tipoMascotaSelect ? tipoMascotaSelect.value : 'perro';
            const filtered = patterns.filter(p => !p.tipo_mascota || p.tipo_mascota === 'ambos' || p.tipo_mascota === tipoMascota);
            const container = document.getElementById(`${prodId}_patron_gallery`);
            if (!container) return;
            const currentValue = document.getElementById(`${prodId}_patron`).value;
            const sinPatronHtml = `
                <div class="pattern-option ${currentValue === 'Sin patrón' ? 'selected' : ''}" onclick="selectPattern('${prodId}', null)">
                    <div class="pattern-option-empty"><i class="fa-solid fa-ban"></i></div>
                    <span>Sin patrón</span>
                </div>`;
            container.innerHTML = sinPatronHtml + filtered.map(p => `
                <div class="pattern-option ${currentValue === p.nombre ? 'selected' : ''}" onclick="selectPattern('${prodId}', ${p.id})">
                    <img src="${p.imagen_url}" alt="${escapeHtml(p.nombre)}">
                    <span>${escapeHtml(p.nombre)}</span>
```

(el resto de la función, el cierre del `.map(...).join('')` y las líneas siguientes, no cambia).

- [ ] **Step 3: `selectPattern` maneja `patternId === null`**

En `pedido.html`, cambiar:

```js
        function selectPattern(prodId, patternId) {
            const pattern = patterns.find(p => p.id === patternId);
            if (!pattern) return;
            document.getElementById(`${prodId}_patron`).value = pattern.nombre;
            renderPatternGallery(prodId);
        }
```

por:

```js
        function selectPattern(prodId, patternId) {
            if (patternId === null) {
                document.getElementById(`${prodId}_patron`).value = 'Sin patrón';
                renderPatternGallery(prodId);
                return;
            }
            const pattern = patterns.find(p => p.id === patternId);
            if (!pattern) return;
            document.getElementById(`${prodId}_patron`).value = pattern.nombre;
            renderPatternGallery(prodId);
        }
```

- [ ] **Step 4: Verificar manualmente en el navegador**

Levantar el servidor estático local (`npx --yes serve -l 8811 .`) y abrir `pedido.html`. Elegir tipo
Pijama, ir a la sección Patrón: debe aparecer primero una tarjeta con ícono de prohibido y texto "Sin
patrón", seguida de los patrones reales filtrados por especie. Tocarla debe marcarla como seleccionada
(borde de acento) y dejar las demás sin seleccionar. Ejecutar en consola:
`document.getElementById('prod_1_patron').value` debe devolver exactamente `"Sin patrón"`.

- [ ] **Step 5: Commit**

```bash
git add pedido.html
git commit -m "$(cat <<'EOF'
Agregar opcion Sin patron a la galeria de patrones en pedido.html

Necesario para que Patron pueda ser obligatorio (siguiente tarea) sin
atascar a los clientes que genuinamente no quieren ningun patron. El
valor guardado es el texto literal "Sin patron", distinguible de "no
selecciono nada todavia".

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Validación específica por producto, con scroll y resaltado

**Files:**
- Modify: `pedido.html` (CSS, cerca de `.product-item`)
- Modify: `pedido.html` (agregar `CAMPOS_REQUERIDOS_POR_TIPO`, `NOMBRE_CAMPO`, `validarFormulario`,
  `mostrarErrorValidacion`, cerca de `TIPO_PRODUCTO_LABELS`/`CAMPOS_POR_TIPO`)

**Interfaces:**
- Produces: `validarFormulario()` → `{ valido: true }` o `{ valido: false, mensaje: string, prodId?:
  string }`. `mostrarErrorValidacion(resultado)` → `void`, muestra el mensaje y hace scroll+resalta si
  `resultado.prodId` viene presente. Ambas son consumidas por la Tarea 3 (`revisarPedido`).
- Consumes: `TIPO_PRODUCTO_LABELS` (ya existe), `imagesFiles` (array global ya existente).

- [ ] **Step 1: CSS del resaltado temporal de error**

En `pedido.html`, cambiar la línea de `.product-item` (buscar `.product-item { border: 1px solid
var(--border); border-radius: var(--border-radius-sm); padding: 1.25rem; margin-bottom: 1rem;
position: relative; }`) por:

```css
        .product-item { border: 1px solid var(--border); border-radius: var(--border-radius-sm); padding: 1.25rem; margin-bottom: 1rem; position: relative; transition: border-color 0.3s ease; }
        .product-item.error-highlight { border-color: var(--danger); }
```

- [ ] **Step 2: Agregar las reglas de campos obligatorios y la función de validación**

En `pedido.html`, inmediatamente después de la línea `const TIPO_PRODUCTO_LABELS = { pijama: 'Pijamas',
manta: 'Manta', polo: 'Polo', tote_bag: 'Tote bag' };`, agregar:

```js
        const CAMPOS_REQUERIDOS_POR_TIPO = {
            pijama: ['talla', 'color', 'patron', 'fotos'],
            polo: ['talla', 'mascota', 'fotos'],
            tote_bag: ['mascota', 'fotos']
        };

        const NOMBRE_CAMPO = {
            talla: 'Talla',
            color: 'Color',
            patron: 'Patrón',
            fotos: 'al menos 1 foto',
            mascota: 'Nombre de la mascota'
        };

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
            }

            return { valido: true };
        }

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

- [ ] **Step 3: Verificar manualmente en el navegador**

Recargar `pedido.html`. Con la consola abierta, agregar 2 productos (`addProductItem()` ya se llama
automáticamente al menos una vez). Llenar el primero completo (Pijama con talla/color/patrón/foto) y
dejar el segundo con Tipo="Pijama" pero sin Color. Ejecutar en consola:

```js
JSON.stringify(validarFormulario())
```

Expected: `{"valido":false,"prodId":"prod_2","mensaje":"El Producto 2 (Pijamas) todavía no tiene Color — revísalo arriba."}`
(el número de producto y el `prodId` exacto pueden variar según el orden real de las tarjetas en tu
prueba — lo importante es que mencione el producto y el campo correctos). Luego completar el Color del
segundo producto y volver a ejecutar `validarFormulario()`: debe devolver `{"valido":true}`.

Probar también `mostrarErrorValidacion(validarFormulario())` con el segundo producto incompleto:
debe hacer scroll hasta esa tarjeta y agregarle un borde rojo que desaparece solo a los ~2 segundos.

- [ ] **Step 4: Commit**

```bash
git add pedido.html
git commit -m "$(cat <<'EOF'
Agregar validarFormulario con reglas por tipo de producto

Reemplaza la validacion generica (solo Tipo+Modelo) por reglas
especificas: Pijama exige Talla/Color/Patron/foto, Polo exige
Talla/Nombre de mascota/foto, Tote bag exige Nombre de mascota/foto.
El mensaje de error ahora dice que producto y que campo falta, y hace
scroll + resalta la tarjeta con el problema. Compilar y usar esto queda
para la siguiente tarea (revisarPedido).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Pantalla de revisión antes de enviar

**Files:**
- Modify: `pedido.html` (HTML, agregar `<div id="review-view">` junto a `form-view`/`success-view`)
- Modify: `pedido.html` (botón principal: `onclick="enviarPedido()"` → `onclick="revisarPedido()"`)
- Modify: `pedido.html` (reemplazar la función `enviarPedido()` completa por
  `construirResumenPreview()`, `revisarPedido()`, `volverAEditar()`, `confirmarYEnviarPedido()`)

**Interfaces:**
- Consumes: `validarFormulario()`/`mostrarErrorValidacion()` (Tarea 2), `renderFichaResumen()` (ya
  existente, sin cambios), `generarUUID()` (ya existente).
- Produces: `revisarPedido()` es la nueva función que dispara el botón principal (reemplaza a
  `enviarPedido()` en ese rol). `confirmarYEnviarPedido()` es quien realmente inserta en Supabase.

- [ ] **Step 1: Agregar el contenedor `review-view`**

En `pedido.html`, cambiar:

```html
        <div id="form-view"></div>
        <div id="success-view" style="display:none;"></div>
```

por:

```html
        <div id="form-view"></div>
        <div id="review-view" style="display:none;"></div>
        <div id="success-view" style="display:none;"></div>
```

- [ ] **Step 2: Cambiar el botón principal**

En `pedido.html`, cambiar:

```html
                <button type="button" class="btn" id="btn-enviar" onclick="enviarPedido()" style="width:100%;">
```

por:

```html
                <button type="button" class="btn" id="btn-enviar" onclick="revisarPedido()" style="width:100%;">
```

- [ ] **Step 3: Reemplazar `enviarPedido()` por las 4 funciones nuevas**

En `pedido.html`, reemplazar la función completa `async function enviarPedido() { ... }` (desde
`async function enviarPedido() {` hasta el `}` que la cierra, justo antes de
`const WHATSAPP_NUMERO = '51928399285';`) por:

```js
        function construirResumenPreview() {
            const clienteNombre = document.getElementById('cliente_nombre').value.trim();
            const canal = document.getElementById('cliente_canal').value;
            const productDivs = document.querySelectorAll('.product-item');

            const items = [];
            for (const div of productDivs) {
                const prodId = div.id;
                const corteGrupo = document.getElementById(`${prodId}_corte_group`);
                const corteEl = document.getElementById(`${prodId}_corte`);
                const aplicaCorte = corteGrupo && corteGrupo.style.display !== 'none';
                const precioUnitario = Number(document.getElementById(`${prodId}_precio`).value) || 0;
                const fotosPreview = (imagesFiles[prodId] || []).map(f => URL.createObjectURL(f));

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
            }

            return {
                codigo: null,
                canal: canal,
                clienteNombre: clienteNombre,
                items: items,
                total: items.reduce((sum, it) => sum + it.precio_unitario, 0)
            };
        }

        function revisarPedido() {
            if (enviando) return;
            const errorEl = document.getElementById('submit-error');
            errorEl.style.display = 'none';

            const resultado = validarFormulario();
            if (!resultado.valido) {
                mostrarErrorValidacion(resultado);
                return;
            }

            const resumenPreview = construirResumenPreview();
            document.getElementById('form-view').style.display = 'none';
            const reviewView = document.getElementById('review-view');
            reviewView.style.display = 'block';
            reviewView.innerHTML = `
                <div class="card" style="text-align:center;">
                    <h2>Revisa tu pedido</h2>
                    <p style="margin-top:0.5rem; color: var(--text-muted); font-size:0.85rem;">Confirma que todo esté correcto antes de enviarlo</p>
                </div>
                ${renderFichaResumen(resumenPreview)}
                <div class="card" style="display:flex; gap:10px;">
                    <button type="button" class="btn btn-secondary" style="flex:1;" onclick="volverAEditar()">Editar</button>
                    <button type="button" class="btn" style="flex:1;" id="btn-confirmar" onclick="confirmarYEnviarPedido()">
                        <span id="btn-confirmar-text">Confirmar y enviar</span>
                        <div class="loader" id="btn-confirmar-loader" style="display:none;"></div>
                    </button>
                </div>
            `;
        }

        function volverAEditar() {
            document.getElementById('review-view').style.display = 'none';
            document.getElementById('form-view').style.display = 'block';
        }

        async function confirmarYEnviarPedido() {
            if (enviando) return;
            enviando = true;
            const btn = document.getElementById('btn-confirmar');
            const btnText = document.getElementById('btn-confirmar-text');
            const loader = document.getElementById('btn-confirmar-loader');
            btn.disabled = true;
            btnText.textContent = 'Enviando...';
            loader.style.display = 'inline-block';

            const clienteNombre = document.getElementById('cliente_nombre').value.trim();
            const clienteContacto = document.getElementById('cliente_contacto').value.trim();
            const canal = document.getElementById('cliente_canal').value;
            const productDivs = document.querySelectorAll('.product-item');

            try {
                const pedidoId = generarUUID();
                const { error: pedidoError } = await sb.from('pedidos').insert([{
                    id: pedidoId,
                    cliente_nombre: clienteNombre,
                    cliente_contacto: clienteContacto,
                    canal: canal,
                    origen: 'web',
                    precio_total: 0,
                    monto_pagado: 0,
                    estado: 'Pendiente'
                }]);

                if (pedidoError) throw pedidoError;

                let i = 0;
                const itemsResumen = [];
                for (const div of productDivs) {
                    i++;
                    const prodId = div.id;
                    const uploadedUrls = [];
                    for (const f of imagesFiles[prodId]) {
                        const ext = f.name ? f.name.split('.').pop() : 'png';
                        const fileName = `${pedidoId}/${prodId}_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
                        const { error: storageError } = await sb.storage.from('fotos-pedidos').upload(fileName, f, { cacheControl: '3600', upsert: false });
                        if (storageError) { console.error('Error subiendo foto:', storageError); continue; }
                        const { data: { publicUrl } } = sb.storage.from('fotos-pedidos').getPublicUrl(fileName);
                        uploadedUrls.push(publicUrl);
                    }

                    const tipoMascotaEl = document.getElementById(`${prodId}_tipo_mascota`);
                    const corteGrupo = document.getElementById(`${prodId}_corte_group`);
                    const corteEl = document.getElementById(`${prodId}_corte`);
                    const aplicaCorte = corteGrupo && corteGrupo.style.display !== 'none';

                    const precioUnitario = Number(document.getElementById(`${prodId}_precio`).value) || 0;
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

                    const { error: itemError } = await sb.from('items_pedido').insert([{
                        pedido_id: pedidoId,
                        tipo_producto: document.getElementById(`${prodId}_tipo`).value,
                        variante: document.getElementById(`${prodId}_variante`).value,
                        talla: document.getElementById(`${prodId}_talla`) ? document.getElementById(`${prodId}_talla`).value : null,
                        color: document.getElementById(`${prodId}_color`) ? document.getElementById(`${prodId}_color`).value : null,
                        patron: document.getElementById(`${prodId}_patron`) ? document.getElementById(`${prodId}_patron`).value : null,
                        corte: (aplicaCorte && corteEl) ? corteEl.value : null,
                        tipo_mascota: tipoMascotaEl ? tipoMascotaEl.value : null,
                        nombre_mascota: document.getElementById(`${prodId}_mascota`) ? document.getElementById(`${prodId}_mascota`).value : null,
                        año_nacimiento_mascota: document.getElementById(`${prodId}_ano`) ? document.getElementById(`${prodId}_ano`).value : null,
                        raza_o_frase: document.getElementById(`${prodId}_raza`) ? document.getElementById(`${prodId}_raza`).value : null,
                        precio_unitario: precioUnitario,
                        observaciones: document.getElementById(`${prodId}_obs`).value,
                        fotos: uploadedUrls,
                        orden: i
                    }]);
                    if (itemError) throw itemError;
                }

                const { data: codigoPedido } = await sb.rpc('obtener_codigo_pedido', { pedido_id_param: pedidoId });
                ultimoResumenPedido = {
                    codigo: codigoPedido || null,
                    canal: canal,
                    clienteNombre: clienteNombre,
                    items: itemsResumen,
                    total: itemsResumen.reduce((sum, it) => sum + it.precio_unitario, 0)
                };
                mostrarExito(ultimoResumenPedido);
            } catch (error) {
                console.error(error);
                enviando = false;
                volverAEditar();
                const errorEl = document.getElementById('submit-error');
                if (error.message && error.message.includes('NO_LOTE_ACTIVO')) {
                    errorEl.textContent = 'Estamos actualizando pedidos, intenta en unos minutos 🙏';
                } else {
                    errorEl.textContent = 'No se pudo registrar tu pedido. Revisa tu conexión e intenta de nuevo — tus datos siguen aquí, no se perdieron.';
                }
                errorEl.style.display = 'block';
            }
        }
```

(Nota: `enviando = false` y re-habilitar el botón en caso de éxito no hace falta — `mostrarExito` oculta
`review-view` de la app real reemplazándola... en realidad `mostrarExito` solo toca `form-view` y
`success-view`, no `review-view` — ver Step 4 para el ajuste necesario.)

- [ ] **Step 4: Ocultar `review-view` al mostrar la pantalla de éxito**

En `pedido.html`, dentro de `function mostrarExito(resumen) {`, la primera línea ya oculta
`form-view`. Buscar:

```js
        function mostrarExito(resumen) {
            const codigoPedido = resumen ? resumen.codigo : null;
            document.getElementById('form-view').style.display = 'none';
            const successView = document.getElementById('success-view');
```

y cambiarla por:

```js
        function mostrarExito(resumen) {
            const codigoPedido = resumen ? resumen.codigo : null;
            document.getElementById('form-view').style.display = 'none';
            document.getElementById('review-view').style.display = 'none';
            const successView = document.getElementById('success-view');
```

- [ ] **Step 5: Verificar manualmente en el navegador (flujo completo con datos simulados)**

Recargar `pedido.html`, llenar un producto Pijama completo con una foto real subida por el input de
archivo (no por consola — necesita un `File` real para que `URL.createObjectURL` funcione), y tocar
"Registrar pedido". Expected: aparece la pantalla "Revisa tu pedido" con la ficha mostrando la foto (la
vista previa local, debe verse la imagen real, no un ícono roto), talla/color/patrón, y el total.

Tocar "Editar": debe volver al formulario con todos los campos y la foto ya subida tal cual estaban (sin
perder nada). Volver a tocar "Registrar pedido" y luego, esta vez, tocar "Confirmar y enviar": debe
completarse el registro real contra Supabase y mostrar la pantalla de éxito de siempre, con la ficha
final (esta vez con la foto real ya subida a Storage, no el blob local) y el código de pedido real.
Confirmar en Supabase (`SELECT * FROM pedidos WHERE cliente_nombre ILIKE '%<nombre de prueba>%'`) que se
creó correctamente, y borrarlo después.

- [ ] **Step 6: Commit**

```bash
git add pedido.html
git commit -m "$(cat <<'EOF'
Agregar pantalla de revision antes de enviar el pedido

enviarPedido() se divide en revisarPedido() (valida y muestra una
vista previa con fotos locales via URL.createObjectURL, sin tocar
Supabase) y confirmarYEnviarPedido() (la logica real de guardado,
sin cambios de fondo, ahora disparada desde el boton "Confirmar y
enviar" de la pantalla de revision). El boton "Editar" regresa al
formulario sin perder ningun dato.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Verificación end-to-end real y publicación

**Files:**
- No se modifica código en esta tarea — solo verificación y push.

- [ ] **Step 1: Verificar los 5 casos de validación del spec**

Con el servidor local corriendo, probar cada uno y confirmar el mensaje/comportamiento exacto:
1. Nombre de cliente vacío → mensaje de siempre, sin llegar a la revisión.
2. Pijama sin Color → menciona producto + "Pijama" + "Color", scroll + borde rojo.
3. Pijama con "Sin patrón" elegido explícitamente → pasa validación, la ficha de revisión muestra el
   chip "Sin patrón".
4. Polo sin nombre de mascota → menciona "Nombre de la mascota".
5. Tote bag sin foto → menciona la foto, no pide talla.

- [ ] **Step 2: Prueba real de punta a punta con Supabase**

Completar un pedido real de prueba (nombre "PRUEBA BORRAR revision"), pasar por la pantalla de
revisión, tocar "Editar" una vez para confirmar que no se pierde nada, volver a revisar y tocar
"Confirmar y enviar". Confirmar en Supabase que el pedido y sus fotos quedaron bien, y que no quedó
ningún pedido a medias de los intentos de "Editar". Borrar el pedido de prueba y sus fotos del bucket
`fotos-pedidos` después.

- [ ] **Step 3: Push a producción**

```bash
git push origin main
```

- [ ] **Step 4: Verificar en el sitio real**

Esperar el deploy de Vercel y repetir un flujo completo (llenar → revisar → editar → confirmar) contra
`https://registro-pedidos-pf.vercel.app/pedido.html`, con un pedido de prueba que se borre al final.
