# Formulario Público — Fase 4: PDF + WhatsApp/Instagram — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En la pantalla de éxito de `pedido.html`, agregar un botón para descargar el PDF de
resumen y un botón de contacto (WhatsApp o Instagram según el canal elegido) con el código de
pedido. Última fase del formulario público.

**Architecture:** Todo dentro de `pedido.html`. `enviarPedido()` ya recolecta los datos de cada
producto al guardar — se guardan en una variable junto con el código y el canal para que la
pantalla de éxito los use. El PDF se genera solo al tocar "Descargar PDF" (no automático al cargar
la pantalla — más seguro en Safari iOS, que es más estricto con descargas no disparadas por un
clic directo). El botón de contacto se elige según el canal que el cliente escogió al inicio.

**Tech Stack:** `jspdf` vía CDN (`https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js`),
JS vanilla.

## Global Constraints

- Spec completo: [docs/superpowers/specs/2026-08-18-formulario-publico-design.md](../specs/2026-08-18-formulario-publico-design.md).
- Paleta del PDF (dada explícitamente por el usuario, distinta de las variables CSS de la app):
  acento `#E8721C`, fondo `#F5F0E8`, texto `#2C1810`.
- Contenido del PDF: código de pedido + "logo"/marca, detalle de cada producto (tipo, variante,
  talla, color con cuadrito+código, patrón), precio total, mensaje de plazo de producción. **Sin
  fotos** (confirmado).
- Número de WhatsApp: `51928399285`. Usuario de Instagram: `peludosfactory`.
- Botón de contacto según el canal que el cliente eligió en el formulario: `wpp`/`otro` (incluye
  TikTok, mapeado a `otro`) → WhatsApp con mensaje pre-armado; `ig` → "Copiar mensaje y abrir
  Instagram" (Instagram no permite precargar texto en el DM desde un link externo).
- El PDF se genera solo después de que el guardado en Supabase ya fue exitoso — nunca antes, y
  nunca bloquea ni retrasa el guardado en sí.
- Sin fotos en el PDF, mantenerlo liviano y rápido de generar.

---

### Task 1: Cargar jsPDF y recolectar los datos del resumen al guardar

**Files:**
- Modify: `pedido.html` (agregar el `<script>` de jsPDF, y capturar el resumen dentro de
  `enviarPedido()`)

**Interfaces:**
- Produces: variable global `ultimoResumenPedido` con `{ codigo, canal, clienteNombre, items:
  [{tipo_producto, variante, talla, corte, color, patron, precio_unitario}], total }`. Consumida
  por Task 2 (PDF) y Task 3 (botones de contacto).

- [ ] **Step 1: Agregar el script de jsPDF**

Ubicar en `pedido.html`:

```html
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

Agregar justo después:

```html
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
```

- [ ] **Step 2: Recolectar el resumen dentro de `enviarPedido()`**

Ubicar en `pedido.html`:

```javascript
                let i = 0;
                for (const div of productDivs) {
                    i++;
                    const prodId = div.id;
                    const uploadedUrls = [];
```

Reemplazar por (agrega el array `itemsResumen` antes del loop):

```javascript
                let i = 0;
                const itemsResumen = [];
                for (const div of productDivs) {
                    i++;
                    const prodId = div.id;
                    const uploadedUrls = [];
```

Ubicar el final del mismo loop:

```javascript
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
                        precio_unitario: document.getElementById(`${prodId}_precio`).value,
                        observaciones: document.getElementById(`${prodId}_obs`).value,
                        fotos: uploadedUrls,
                        orden: i
                    }]);
                    if (itemError) throw itemError;
                }

                const { data: codigoPedido } = await sb.rpc('obtener_codigo_pedido', { pedido_id_param: pedidoId });
                mostrarExito(codigoPedido || null);
```

Reemplazar por (agrega el `push` a `itemsResumen` antes del `if (itemError)`, y arma
`ultimoResumenPedido` antes de llamar `mostrarExito`):

```javascript
                    const precioUnitario = Number(document.getElementById(`${prodId}_precio`).value) || 0;
                    itemsResumen.push({
                        tipo_producto: document.getElementById(`${prodId}_tipo`).value,
                        variante: document.getElementById(`${prodId}_variante`).value,
                        talla: document.getElementById(`${prodId}_talla`) ? document.getElementById(`${prodId}_talla`).value : '',
                        corte: (aplicaCorte && corteEl) ? corteEl.value : '',
                        color: document.getElementById(`${prodId}_color`) ? document.getElementById(`${prodId}_color`).value : '',
                        patron: document.getElementById(`${prodId}_patron`) ? document.getElementById(`${prodId}_patron`).value : '',
                        precio_unitario: precioUnitario
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
```

- [ ] **Step 3: Declarar la variable global**

Ubicar en `pedido.html`:

```javascript
        let enviando = false;
```

Reemplazar por:

```javascript
        let enviando = false;
        let ultimoResumenPedido = null;
```

- [ ] **Step 4: Verificar en el navegador**

Recargar `pedido.html`, llenar un producto de prueba y enviarlo (igual que en la Fase 2). Confirmar
en la consola que no hay errores, y que `ultimoResumenPedido` tiene los datos correctos:

```javascript
console.log(JSON.stringify(ultimoResumenPedido, null, 2))
```

- [ ] **Step 5: Commit**

```bash
git add pedido.html
git commit -m "Recolectar resumen del pedido al guardar, para el PDF y los botones de contacto"
```

---

### Task 2: Generación del PDF

**Files:**
- Modify: `pedido.html`

**Interfaces:**
- Consumes: `ultimoResumenPedido` (Task 1), `buscarColorPorCodigo` (ya existe en `pedido.html`,
  copiado de `PANTONERA`... en realidad `pedido.html` no tiene `buscarColorPorCodigo` — usa
  `PANTONERA` directo. Se agrega un helper chico local, ver Step 1).
- Produces: `descargarPDF()` — genera y descarga el PDF con `jsPDF`.

- [ ] **Step 1: Agregar un helper para buscar el hex de un código de color**

Agregar cerca de `PANTONERA` (después de su cierre `};`):

```javascript
        function buscarColorPorCodigoPDF(codigo) {
            if (!codigo) return null;
            for (const familia of Object.values(PANTONERA)) {
                const encontrado = familia.colores.find(c => c.codigo === codigo);
                if (encontrado) return encontrado;
            }
            return null;
        }

        function hexToRgb(hex) {
            const n = parseInt(hex.replace('#', ''), 16);
            return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
        }
```

- [ ] **Step 2: Agregar `descargarPDF()`**

Agregar después de `mostrarExito` (se define en la Task 3, o al final del `<script>` si `mostrarExito`
todavía no existe en ese punto — el orden de las funciones no importa en JS, solo que estén dentro
del mismo `<script>`):

```javascript
        async function descargarPDF() {
            if (!ultimoResumenPedido) return;
            const r = ultimoResumenPedido;
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ unit: 'mm', format: 'a4' });

            const ACENTO = [0xE8, 0x72, 0x1C];
            const TEXTO = [0x2C, 0x18, 0x10];
            const FONDO = [0xF5, 0xF0, 0xE8];

            doc.setFillColor(...ACENTO);
            doc.rect(0, 0, 210, 32, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(20);
            doc.text('PELUDOS FACTORY', 105, 16, { align: 'center' });
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text('Resumen de tu pedido', 105, 24, { align: 'center' });

            doc.setFillColor(...FONDO);
            doc.rect(0, 32, 210, 20, 'F');
            doc.setTextColor(...ACENTO);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.text(r.codigo || 'Código pendiente', 105, 45, { align: 'center' });

            let y = 62;
            doc.setTextColor(...TEXTO);
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.text('Detalle de tu pedido', 15, y);
            y += 8;

            doc.setFontSize(10.5);
            r.items.forEach((item, idx) => {
                if (y > 260) { doc.addPage(); y = 20; }
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...TEXTO);
                const titulo = `${idx + 1}. ${item.tipo_producto}${item.variante ? ' — ' + item.variante : ''}`;
                doc.text(titulo, 15, y);
                doc.text(`S/ ${item.precio_unitario.toFixed(2)}`, 195, y, { align: 'right' });
                y += 6;

                doc.setFont('helvetica', 'normal');
                doc.setTextColor(90, 78, 68);
                const detalles = [];
                if (item.talla) detalles.push(`Talla: ${item.talla}`);
                if (item.corte) detalles.push(`Corte: ${item.corte === 'princesa' ? 'Princesa' : 'Clásico'}`);
                if (item.patron) detalles.push(`Patrón: ${item.patron}`);
                if (detalles.length > 0) {
                    doc.text(detalles.join('   ·   '), 15, y);
                    y += 5.5;
                }
                if (item.color) {
                    const colorInfo = buscarColorPorCodigoPDF(item.color);
                    if (colorInfo) {
                        doc.setFillColor(...hexToRgb(colorInfo.hex));
                        doc.rect(15, y - 3, 4, 4, 'F');
                        doc.text(`Color: ${item.color}`, 21, y);
                    } else {
                        doc.text(`Color: ${item.color}`, 15, y);
                    }
                    y += 5.5;
                }
                y += 4;
            });

            y += 2;
            doc.setDrawColor(...ACENTO);
            doc.line(15, y, 195, y);
            y += 10;

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.setTextColor(...ACENTO);
            doc.text(`Total: S/ ${r.total.toFixed(2)}`, 195, y, { align: 'right' });
            y += 15;

            doc.setFillColor(...FONDO);
            doc.roundedRect(15, y, 180, 22, 3, 3, 'F');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9.5);
            doc.setTextColor(...TEXTO);
            const plazoTexto = 'El plazo máximo de producción son 7 días hábiles. Sin embargo, en caso su pedido esté listo antes, le enviaremos un mensaje para coordinar el envío.';
            const lineas = doc.splitTextToSize(plazoTexto, 170);
            doc.text(lineas, 20, y + 8);

            doc.save(`Pedido-${r.codigo || 'PeludosFactory'}.pdf`);
        }
```

- [ ] **Step 3: Verificar en el navegador**

Después de enviar un pedido de prueba (pantalla de éxito visible), correr en consola:

```javascript
descargarPDF()
```

Confirmar que no lanza error y que se descarga un archivo `Pedido-PF-....pdf` (revisar la carpeta
de Descargas). Abrir el PDF y confirmar: franja de color de marca, código grande, detalle de
productos con precio, cuadradito de color si aplica, total, y el mensaje de plazo en el recuadro.

- [ ] **Step 4: Commit**

```bash
git add pedido.html
git commit -m "Generar PDF de resumen del pedido con jsPDF"
```

---

### Task 3: Botones de contacto (WhatsApp / Instagram) y pantalla de éxito final

**Files:**
- Modify: `pedido.html` (reescribir `mostrarExito`)

**Interfaces:**
- Consumes: `ultimoResumenPedido` (Task 1), `descargarPDF` (Task 2).
- Produces: `mostrarExito(resumen)` ahora acepta el objeto completo (no solo el código), muestra
  botón de PDF y el botón de contacto correspondiente al canal. Nueva función
  `copiarMensajeYAbrirInstagram()`.

- [ ] **Step 1: Reescribir `mostrarExito`**

Ubicar en `pedido.html`:

```javascript
        function mostrarExito(codigoPedido) {
            document.getElementById('form-view').style.display = 'none';
            const successView = document.getElementById('success-view');
            successView.style.display = 'block';
            successView.innerHTML = `
                <div class="card" style="text-align:center;">
                    <i class="fa-solid fa-circle-check" style="font-size: 2.5rem; color: var(--success); margin-bottom: 1rem;"></i>
                    <h2>${codigoPedido ? escapeHtml(codigoPedido) : ''}</h2>
                    <p style="margin-top: 0.75rem;">¡Tu pedido fue registrado con éxito! 🎉 Para confirmarlo, coordinamos contigo por WhatsApp el adelanto del 50% del total y cualquier detalle final 💛</p>
                    <div class="info-banner" style="margin-top: 1.25rem; text-align:left;">
                        El plazo máximo de producción son 7 días hábiles 🗓️ sin embargo en caso su
                        pedido esté listo antes le enviaremos el mensajito para coordinar el envío ⭐️✅
                    </div>
                </div>
            `;
        }
```

Reemplazar por:

```javascript
        const WHATSAPP_NUMERO = '51928399285';
        const INSTAGRAM_USUARIO = 'peludosfactory';

        function mensajeContacto(codigo) {
            return `¡Hola! Acabo de registrar mi pedido en la web de Peludos Factory 🐾 Mi código es ${codigo || '(sin código)'}.`;
        }

        function mostrarExito(resumen) {
            const codigoPedido = resumen ? resumen.codigo : null;
            document.getElementById('form-view').style.display = 'none';
            const successView = document.getElementById('success-view');
            successView.style.display = 'block';

            const mensaje = mensajeContacto(codigoPedido);
            const canal = resumen ? resumen.canal : 'otro';

            let botonContactoHtml;
            if (canal === 'ig') {
                botonContactoHtml = `
                    <button type="button" class="btn btn-secondary" style="width:100%; margin-top:10px;" onclick="copiarMensajeYAbrirInstagram()">
                        <i class="fa-brands fa-instagram"></i> Copiar mensaje y abrir Instagram
                    </button>`;
            } else {
                const url = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensaje)}`;
                botonContactoHtml = `
                    <a href="${url}" target="_blank" rel="noopener" class="btn" style="width:100%; margin-top:10px; display:block; text-decoration:none; box-sizing:border-box; text-align:center;">
                        <i class="fa-brands fa-whatsapp"></i> Escribir por WhatsApp
                    </a>`;
            }

            successView.innerHTML = `
                <div class="card" style="text-align:center;">
                    <i class="fa-solid fa-circle-check" style="font-size: 2.5rem; color: var(--success); margin-bottom: 1rem;"></i>
                    <h2>${codigoPedido ? escapeHtml(codigoPedido) : ''}</h2>
                    <p style="margin-top: 0.75rem;">¡Tu pedido fue registrado con éxito! 🎉 Para confirmarlo, coordinamos contigo por WhatsApp el adelanto del 50% del total y cualquier detalle final 💛</p>
                    <div class="info-banner" style="margin-top: 1.25rem; text-align:left;">
                        El plazo máximo de producción son 7 días hábiles 🗓️ sin embargo en caso su
                        pedido esté listo antes le enviaremos el mensajito para coordinar el envío ⭐️✅
                    </div>
                    <button type="button" class="btn btn-secondary" style="width:100%; margin-top:10px;" onclick="descargarPDF()">
                        <i class="fa-solid fa-file-pdf"></i> Descargar PDF del pedido
                    </button>
                    ${botonContactoHtml}
                </div>
            `;
        }

        async function copiarMensajeYAbrirInstagram() {
            const mensaje = mensajeContacto(ultimoResumenPedido ? ultimoResumenPedido.codigo : null);
            try {
                await navigator.clipboard.writeText(mensaje);
                showToast('Mensaje copiado — pégalo en el chat de Instagram');
            } catch (err) {
                console.error(err);
                showToast('No se pudo copiar el mensaje, escríbelo tú mismo', true);
            }
            window.open(`https://ig.me/m/${INSTAGRAM_USUARIO}`, '_blank', 'noopener');
        }
```

- [ ] **Step 2: Verificar en el navegador — los 3 canales**

Enviar 3 pedidos de prueba (uno por canal: WhatsApp, Instagram, TikTok/Otro), confirmando en cada
uno:
- **WhatsApp**: aparece un botón/link "Escribir por WhatsApp" que abre `wa.me/51928399285` con el
  mensaje pre-armado incluyendo el código real.
- **Instagram**: aparece "Copiar mensaje y abrir Instagram" — al tocarlo, copia el mensaje (pegar en
  algún campo de texto para confirmar) y abre `ig.me/m/peludosfactory` en pestaña nueva.
- **TikTok/Otro**: debe comportarse igual que WhatsApp (respaldo universal, ya confirmado en el
  spec).
- El botón "Descargar PDF del pedido" funciona en los 3 casos.

Borrar los 3 pedidos de prueba al final.

- [ ] **Step 3: Commit**

```bash
git add pedido.html
git commit -m "Agregar botones de WhatsApp/Instagram y PDF a la pantalla de exito"
```

---

### Task 4: Verificación final y `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Probar el flujo completo una vez más de punta a punta**

Un pedido real de prueba: llenar formulario → enviar → pantalla de éxito → descargar PDF → abrir el
PDF y revisar que se vea bien → tocar el botón de contacto correspondiente. Confirmar en `index.html`
(logueado) que el pedido cae en "Por Confirmar" como siempre. Borrar el pedido de prueba.

- [ ] **Step 2: Actualizar `CLAUDE.md`**

Marcar la Fase 4 como completada en el intro y en Progreso — el formulario público queda con sus 4
fases completas. Documentar el número de WhatsApp/usuario de Instagram usados (útil si algún día
cambian y hay que actualizarlos en el código).

- [ ] **Step 3: Commit y confirmar despliegue**

```bash
git add CLAUDE.md
git commit -m "Actualizar CLAUDE.md: Fase 4 completada, formulario publico terminado"
```

Confirmar con el usuario antes de pushear — es el cierre completo del proyecto del formulario
público.
