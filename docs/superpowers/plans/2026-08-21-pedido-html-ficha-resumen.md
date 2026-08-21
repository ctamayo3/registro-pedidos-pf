# Ficha visual de resumen en pedido.html — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el PDF de resumen en `pedido.html` por una ficha HTML persistente en la pantalla de
éxito, y quitar la descarga de PDF del flujo de contacto (WhatsApp/Instagram).

**Architecture:** Todo el cambio vive en un único archivo, `pedido.html` (HTML+CSS+JS vanilla, sin build
step). Se agrega una función `renderFichaResumen(resumen)` que arma HTML a partir del objeto
`ultimoResumenPedido` ya existente en memoria (sin nuevas consultas a Supabase), se inserta esa ficha
dentro de `mostrarExito()`, y se elimina por completo la ruta de generación de PDF (jsPDF).

**Tech Stack:** HTML/CSS/JS vanilla. Sin frameworks, sin dependencias nuevas — de hecho esta tarea
**elimina** una dependencia (`jspdf`).

## Global Constraints

- No se agrega ningún mecanismo de Web Share API ni botón de "compartir imagen" — se descartó
  explícitamente en el brainstorming. Único mecanismo de guardar la ficha: captura de pantalla manual.
- El botón de contacto (WhatsApp/Instagram) mantiene exactamente el mismo comportamiento de hoy (mismo
  mensaje pre-armado, mismo número/usuario fijo) salvo que ya no dispara la descarga de PDF.
- No se toca `index.html`, ni ninguna tabla/columna de Supabase — cero SQL en esta tarea.
- Todo texto insertado vía `innerHTML` que venga de datos (tipo_producto, variante, talla, color, patrón)
  debe pasar por `escapeHtml()` (definida en `pedido.html:150`), igual que el resto del archivo.
- No usar `<datalist>` para nada nuevo (no aplica en este cambio, pero es la convención del proyecto).
- Los colores de la ficha se resuelven contra la constante `PANTONERA` ya existente
  (`pedido.html:177-238`) — no se inventan colores nuevos.

---

## Contexto de testing

Este proyecto no tiene framework de tests automatizados — es un archivo HTML+JS estático sin build. La
verificación de cada tarea es manual, vía navegador, sirviendo el archivo con un servidor estático local
(evita los problemas conocidos de `file://` con `crypto.randomUUID()` documentados en `CLAUDE.md` — aunque
para esta tarea en particular no se necesita insertar en Supabase, solo renderizar HTML).

Para todas las tareas de este plan, usar este objeto de prueba en la consola del navegador (no requiere
conexión a Supabase ni crea datos reales):

```js
const mockResumen = {
    codigo: 'PF-2608-999',
    canal: 'wpp',
    clienteNombre: 'Cliente de Prueba',
    items: [
        {
            tipo_producto: 'Pijama',
            variante: 'Manga corta + short',
            talla: 'M',
            corte: 'clasico',
            color: 'A04',
            patron: 'Huesitos',
            precio_unitario: 95,
            fotos: ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=']
        },
        {
            tipo_producto: 'Tote bag',
            variante: 'Tote bag',
            talla: '',
            corte: '',
            color: '',
            patron: '',
            precio_unitario: 45,
            fotos: []
        }
    ],
    total: 140
};
```

Levantar el servidor estático (desde la raíz del repo):

```bash
python -m http.server 8811
```

Y navegar a `http://localhost:8811/pedido.html`.

---

### Task 1: Renombrar `buscarColorPorCodigoPDF` y crear `renderFichaResumen`

**Files:**
- Modify: `pedido.html:240-247` (rename función)
- Modify: `pedido.html:324` (actualizar el único call site existente, dentro de `descargarPDF`, para que
  siga funcionando hasta que Task 3 elimine esa función)
- Modify: `pedido.html:66` (agregar CSS nuevo justo después del bloque `.pago-destacado`)
- Modify: `pedido.html` — agregar la función `renderFichaResumen` nueva, junto a `mostrarExito` (antes de
  `pedido.html:893`)

**Interfaces:**
- Produces: `buscarColorPorCodigo(codigo)` → `{ codigo, hex } | null` (antes se llamaba
  `buscarColorPorCodigoPDF`, mismo comportamiento, buscar en `PANTONERA`).
- Produces: `renderFichaResumen(resumen)` → `string` (HTML de la ficha completa, con un bloque `.card`
  que contiene una fila por producto + el total). Consumida por Task 2 dentro de `mostrarExito()`.
- Consumes: `escapeHtml(str)` (`pedido.html:150`), `PANTONERA` (`pedido.html:177`).

- [ ] **Step 1: Renombrar la función de búsqueda de color**

En `pedido.html:240`, cambiar:

```js
        function buscarColorPorCodigoPDF(codigo) {
```

por:

```js
        function buscarColorPorCodigo(codigo) {
```

Y en `pedido.html:324` (dentro de `descargarPDF`), cambiar la única línea que la llama:

```js
                        const colorInfo = buscarColorPorCodigoPDF(item.color);
```

por:

```js
                        const colorInfo = buscarColorPorCodigo(item.color);
```

- [ ] **Step 2: Agregar el CSS de la ficha**

En `pedido.html`, inmediatamente después de la línea `.pago-destacado i { font-size: 1.5rem; flex-shrink: 0; }`
(`pedido.html:66`), agregar:

```css
        .ficha-hint { color: var(--text-muted); font-size: 0.8rem; text-align: center; margin: 0.75rem 0 1.25rem; }
        .ficha-item { display: flex; gap: 12px; text-align: left; padding: 1rem 0; border-bottom: 1px solid var(--border); }
        .ficha-item:last-of-type { border-bottom: none; }
        .ficha-item-foto { width: 64px; height: 64px; border-radius: var(--border-radius-sm); object-fit: cover; flex-shrink: 0; background: var(--card-secondary); }
        .ficha-item-info { flex: 1; min-width: 0; }
        .ficha-item-titulo { display: flex; justify-content: space-between; gap: 8px; font-weight: 600; margin-bottom: 6px; }
        .ficha-item-titulo span:last-child { color: var(--accent-dark); white-space: nowrap; }
        .ficha-chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
        .ficha-chip { display: inline-flex; align-items: center; gap: 5px; background: var(--card-secondary); color: var(--text-dark);
            padding: 3px 10px; border-radius: var(--border-radius-pill); font-size: 0.75rem; }
        .ficha-chip-swatch { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
        .ficha-total { display: flex; justify-content: space-between; align-items: center; padding-top: 1rem; margin-top: 0.25rem;
            font-family: var(--font-display); font-size: 1.1rem; font-weight: 700; color: var(--accent-dark); }
```

- [ ] **Step 3: Agregar `renderFichaResumen`**

Inmediatamente antes de `function mostrarExito(resumen) {` (`pedido.html:893`), agregar:

```js
        function renderFichaResumen(resumen) {
            const filas = resumen.items.map(item => {
                const foto = (item.fotos && item.fotos[0])
                    ? `<img class="ficha-item-foto" src="${escapeHtml(item.fotos[0])}" alt="">`
                    : `<div class="ficha-item-foto"></div>`;

                const chips = [];
                if (item.talla) chips.push(`<span class="ficha-chip">${escapeHtml(item.talla)}</span>`);
                if (item.corte) chips.push(`<span class="ficha-chip">${item.corte === 'princesa' ? 'Princesa' : 'Clásico'}</span>`);
                if (item.color) {
                    const colorInfo = buscarColorPorCodigo(item.color);
                    chips.push(colorInfo
                        ? `<span class="ficha-chip"><span class="ficha-chip-swatch" style="background:${colorInfo.hex}"></span>${escapeHtml(item.color)}</span>`
                        : `<span class="ficha-chip">${escapeHtml(item.color)}</span>`);
                }
                if (item.patron) chips.push(`<span class="ficha-chip">${escapeHtml(item.patron)}</span>`);

                return `
                    <div class="ficha-item">
                        ${foto}
                        <div class="ficha-item-info">
                            <div class="ficha-item-titulo">
                                <span>${escapeHtml(item.tipo_producto)}${item.variante ? ' — ' + escapeHtml(item.variante) : ''}</span>
                                <span>S/ ${item.precio_unitario.toFixed(2)}</span>
                            </div>
                            <div class="ficha-chip-row">${chips.join('')}</div>
                        </div>
                    </div>`;
            }).join('');

            return `
                <div class="card" style="text-align:left; padding-top:1rem; padding-bottom:0.5rem;">
                    ${filas}
                    <div class="ficha-total">
                        <span>Total</span>
                        <span>S/ ${resumen.total.toFixed(2)}</span>
                    </div>
                </div>`;
        }
```

- [ ] **Step 4: Verificar manualmente en el navegador**

Levantar el servidor estático y abrir `http://localhost:8811/pedido.html`. Abrir la consola del navegador
(F12) y ejecutar, pegando primero el `mockResumen` de la sección "Contexto de testing" y luego:

```js
document.body.insertAdjacentHTML('afterbegin', renderFichaResumen(mockResumen));
```

Expected: aparece arriba de todo una tarjeta con 2 filas — "Pijama — Manga corta + short" con una foto
(imagen de prueba de 1x1, se verá como un cuadradito de color sólido, es esperado) y chips "M",
"Clásico", un cuadradito de color + "A04", "Huesitos", precio "S/ 95.00" a la derecha; y "Tote bag —
Tote bag" sin foto (placeholder vacío del color `--card-secondary`) y sin chips, precio "S/ 45.00". Al
final, "Total — S/ 140.00". Sin errores en consola.

Repetir el mismo `insertAdjacentHTML` pero cambiando en `mockResumen.items[0].color` el valor `'A04'`
por uno que no exista en `PANTONERA`, ej. `'Z99'` — el chip de color debe seguir apareciendo (con el
código `'Z99'` como texto) pero **sin** el cuadradito de color, sin error en consola (esto ejercita la
rama `colorInfo === null` de `buscarColorPorCodigo`, el mismo criterio de "gracia" que ya usa el resto
de la app con pedidos viejos de texto libre).

Recargar la página después (para descartar los `insertAdjacentHTML` de prueba, que no persisten tras
recargar).

- [ ] **Step 5: Commit**

```bash
git add pedido.html
git commit -m "$(cat <<'EOF'
Agregar renderFichaResumen para el resumen visual de pedido.html

Prepara la funcion que arma la ficha en HTML (foto + chips + precio
por producto) reutilizando buscarColorPorCodigo (renombrada desde
buscarColorPorCodigoPDF). Todavia no se usa en mostrarExito, eso es
el siguiente paso.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Insertar la ficha en la pantalla de éxito

**Files:**
- Modify: `pedido.html:917-932` (dentro de `mostrarExito`, el `successView.innerHTML = ...`)

**Interfaces:**
- Consumes: `renderFichaResumen(resumen)` de Task 1.
- Produces: `mostrarExito(resumen)` sigue teniendo la misma firma y el mismo punto de entrada
  (`pedido.html:869`, `pedido.html:869` llama `mostrarExito(ultimoResumenPedido)`) — no cambia para quien
  la consume.

- [ ] **Step 1: Reescribir el cuerpo de `mostrarExito`**

En `pedido.html`, dentro de `function mostrarExito(resumen) {` (`pedido.html:893`), reemplazar el bloque
`successView.innerHTML = ...` completo (`pedido.html:917-932`) por:

```js
            const fichaHtml = (resumen && resumen.items) ? renderFichaResumen(resumen) : '';

            successView.innerHTML = `
                <div class="card" style="text-align:center;">
                    <i class="fa-solid fa-circle-check" style="font-size: 2.5rem; color: var(--success); margin-bottom: 1rem;"></i>
                    <h2>${codigoPedido ? escapeHtml(codigoPedido) : ''}</h2>
                    <p style="margin-top: 0.75rem;">¡Tu pedido fue registrado con éxito! 🎉</p>
                </div>
                ${fichaHtml}
                <p class="ficha-hint">📸 Guarda esta pantalla — toma una captura si quieres tener tu resumen a la mano</p>
                <div class="card" style="text-align:center;">
                    <div class="pago-destacado">
                        <i class="fa-solid fa-circle-dollar-to-slot"></i>
                        <span>Solo falta coordinar el adelanto del 50% por <strong>${canalTexto}</strong> para empezar tu pedido 💛</span>
                    </div>
                    <div class="info-banner" style="margin-top: 1rem; text-align:left;">
                        El plazo máximo de producción son 7 días hábiles 🗓️ sin embargo en caso su
                        pedido esté listo antes le enviaremos el mensajito para coordinar el envío ⭐️✅
                    </div>
                    ${botonContactoHtml}
                </div>
            `;
```

(El resto de la función — cálculo de `codigoPedido`, `canal`, `canalTexto`, `mensaje`, `botonContactoHtml`
— no cambia en este paso.)

- [ ] **Step 2: Verificar manualmente en el navegador**

Recargar `http://localhost:8811/pedido.html`, abrir la consola y ejecutar (con el `mockResumen` de la
sección "Contexto de testing" ya pegado):

```js
mostrarExito(mockResumen);
```

Expected: la vista cambia a la pantalla de éxito, en este orden de arriba hacia abajo: ✓ + código
"PF-2608-999" + mensaje de éxito → ficha con los 2 productos y el total (S/ 140.00) → texto "📸 Guarda
esta pantalla..." → caja de pago destacado mencionando "WhatsApp" (porque `canal: 'wpp'` en el mock) →
banner de plazo → botón "Escribir por WhatsApp". Sin errores en consola. Repetir cambiando
`mockResumen.canal` a `'ig'` y volver a llamar `mostrarExito(mockResumen)` — el botón debe cambiar a
"Copiar mensaje y abrir Instagram" y la caja de pago debe decir "Instagram".

Repetir la misma verificación en viewport móvil: usar el resize del navegador a preset "mobile" (o
achicar la ventana a ~390px de ancho) y volver a llamar `mostrarExito(mockResumen)`. Expected: la ficha
no rompe el layout ni obliga a scroll horizontal — la foto (64px) y los chips deben acomodarse dentro
del ancho de la tarjeta igual que en escritorio, dado que `.wrap { max-width: 640px }` ya centra todo el
contenido y `.ficha-item` usa `flex` sin anchos fijos más allá de la foto.

- [ ] **Step 3: Commit**

```bash
git add pedido.html
git commit -m "$(cat <<'EOF'
Mostrar la ficha de resumen en la pantalla de exito de pedido.html

mostrarExito ahora inserta renderFichaResumen() entre el mensaje de
exito y la caja de pago destacado, con un texto sugiriendo captura
de pantalla. El boton de WhatsApp/Instagram sigue igual por ahora
(la limpieza del PDF es la siguiente tarea).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Eliminar el PDF por completo

**Files:**
- Modify: `pedido.html:13` (quitar el `<script>` de jsPDF)
- Modify: `pedido.html:240-265` → tras Task 1, este rango ahora contiene `buscarColorPorCodigo`,
  `hexToRgb` y `fetchImagenComoDataUrl`. Se elimina `hexToRgb` y `fetchImagenComoDataUrl` (se queda
  `buscarColorPorCodigo`, la sigue usando `renderFichaResumen`).
- Modify: `pedido.html:267-381` (función `descargarPDF` completa) → eliminar
- Modify: `pedido.html:912` (atributo `onclick="descargarPDF()"` en el link de WhatsApp) → quitar
- Modify: `pedido.html:936` (línea `await descargarPDF();` dentro de `copiarMensajeYAbrirInstagram`) →
  quitar

**Interfaces:**
- Produces: `copiarMensajeYAbrirInstagram()` mantiene la misma firma (sin parámetros, `async`), pero ya
  no espera ningún PDF antes de copiar el mensaje.
- Consumes: nada nuevo.

- [ ] **Step 1: Quitar el script de jsPDF**

En `pedido.html:13`, eliminar la línea:

```html
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
```

- [ ] **Step 2: Eliminar `hexToRgb` y `fetchImagenComoDataUrl`**

Eliminar estas dos funciones completas (quedaron en `pedido.html:249-265` después de Task 1, justo
debajo de `buscarColorPorCodigo`, que sí se queda):

```js
        function hexToRgb(hex) {
            const n = parseInt(hex.replace('#', ''), 16);
            return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
        }

        async function fetchImagenComoDataUrl(url) {
            const res = await fetch(url);
            const blob = await res.blob();
            const formato = blob.type.includes('png') ? 'PNG' : (blob.type.includes('webp') ? 'WEBP' : 'JPEG');
            const dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            return { dataUrl, formato };
        }
```

- [ ] **Step 3: Eliminar `descargarPDF` completa**

Eliminar la función completa (`pedido.html:267-381` antes de este paso, el rango se corre hacia arriba
tras el Step 2 — buscar por el nombre de la función, no por número de línea):

```js
        async function descargarPDF() {
            if (!ultimoResumenPedido) return;
            // ... todo el cuerpo de la función, incluyendo el doc.save(...) final
        }
```

(Es la función completa documentada en el spec — desde `async function descargarPDF() {` hasta el `}`
que cierra, justo antes de `function renderForm() {`.)

- [ ] **Step 4: Quitar las llamadas a `descargarPDF()`**

En el botón de WhatsApp dentro de `mostrarExito` (`pedido.html:912` antes de este paso), cambiar:

```js
                    <a href="${url}" target="_blank" rel="noopener" class="btn" style="width:100%; margin-top:10px; display:block; text-decoration:none; box-sizing:border-box; text-align:center;" onclick="descargarPDF()">
```

por:

```js
                    <a href="${url}" target="_blank" rel="noopener" class="btn" style="width:100%; margin-top:10px; display:block; text-decoration:none; box-sizing:border-box; text-align:center;">
```

Y en `copiarMensajeYAbrirInstagram()`, quitar la primera línea del cuerpo:

```js
        async function copiarMensajeYAbrirInstagram() {
            await descargarPDF();
```

dejando:

```js
        async function copiarMensajeYAbrirInstagram() {
```

- [ ] **Step 5: Verificar que no queda ninguna referencia**

```bash
grep -n "jspdf\|jsPDF\|descargarPDF\|fetchImagenComoDataUrl\|hexToRgb" pedido.html
```

Expected: sin resultados (0 coincidencias).

- [ ] **Step 6: Verificar manualmente en el navegador**

Recargar `http://localhost:8811/pedido.html`, consola sin errores al cargar (confirma que quitar el
script de jsPDF no rompió nada). Pegar el `mockResumen` y ejecutar `mostrarExito(mockResumen)` de nuevo
— la ficha debe verse igual que en Task 2. Click en el botón "Escribir por WhatsApp": debe abrir
`wa.me` en pestaña nueva con el mensaje pre-armado, **sin ningún intento de descarga** en la pestaña
original. Cambiar `mockResumen.canal = 'ig'`, volver a llamar `mostrarExito(mockResumen)`, click en
"Copiar mensaje y abrir Instagram": debe copiar el mensaje y abrir Instagram en pestaña nueva, sin
descarga.

- [ ] **Step 7: Commit**

```bash
git add pedido.html
git commit -m "$(cat <<'EOF'
Eliminar el PDF de resumen en pedido.html

descargarPDF() y sus helpers (fetchImagenComoDataUrl, hexToRgb) y el
script de jsPDF quedan sin uso ahora que el resumen se ve en pantalla
como ficha (ver renderFichaResumen). El boton de WhatsApp/Instagram
ya no dispara ninguna descarga.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Verificación end-to-end real y publicación

**Files:**
- No se modifica código en esta tarea — solo verificación y push.

**Interfaces:**
- Consumes: el flujo completo de `pedido.html` (formulario real → `saveOrder`/insert en Supabase →
  `mostrarExito`).

- [ ] **Step 1: Submit real de prueba (WhatsApp)**

Con el servidor estático corriendo, abrir `http://localhost:8811/pedido.html` en el navegador, llenar el
formulario real con datos de prueba obvios (ej. nombre "PRUEBA BORRAR", canal WhatsApp), un producto con
foto real subida por paste/click, y enviarlo. Confirmar:
- La pantalla de éxito muestra la ficha con el producto, su foto real (esta vez sí carga desde Storage,
  no el placeholder de Task 1-3), talla/color/patrón si aplican, y el precio correcto.
- El texto de sugerencia de captura aparece debajo de la ficha.
- Click en "Escribir por WhatsApp" abre WhatsApp en pestaña nueva con el mensaje y el código correcto,
  **sin disparar ninguna descarga**.
- Volver a la pestaña de `pedido.html` (sin recargar): la ficha sigue visible exactamente igual — este
  es el problema original que motivó el cambio, confirmar que quedó resuelto.

- [ ] **Step 2: Borrar el pedido de prueba**

Usando las credenciales de Supabase de `CLAUDE.md` (rol `authenticated`, o pedirle a Cesar que lo revise
en "Por Confirmar" dentro de `index.html` y lo rechace desde ahí con el botón "Rechazar" — es la vía más
simple ya que el pedido de prueba entra como `estado='Por confirmar'`). Confirmar después que ya no
aparece.

- [ ] **Step 3: Push a producción**

```bash
git push origin main
```

- [ ] **Step 4: Verificar en el sitio real**

Abrir `https://registro-pedidos-pf.vercel.app/pedido.html` (esperar a que termine el deploy de Vercel,
usualmente ~1 minuto) y repetir un submit de prueba rápido (mismo criterio que Step 1) directamente
contra producción, confirmando que la ficha se ve igual ahí. Borrar ese pedido de prueba también (Step
2) y confirmar que quedó limpio.
