# PDFs de producción (confección y estampado) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desde el Dashboard de `index.html`, generar 2 PDFs de pijamas del lote (pantalones/shorts
para confección, polos con fotos para estampado) y descargarlos o compartirlos por WhatsApp.

**Architecture:** Todo en `index.html` (sin build, JS vanilla). Funciones puras de orden/agrupación,
una capa de datos (Supabase), una capa de imágenes (fetch → canvas → JPEG reducido), 2 constructores de
PDF con jsPDF que no tocan DOM ni Supabase, y un modal que orquesta. Solo lectura, sin cambios de DB.

**Tech Stack:** HTML/CSS/JS vanilla, `@supabase/supabase-js@2` (ya cargado como `sb`), jsPDF 2.5.1
desde cdnjs.

**Spec:** `docs/superpowers/specs/2026-09-12-pdfs-produccion-design.md`

## Global Constraints

- Solo `items_pedido.tipo_producto = 'pijama'`. Polo/Tote bag sueltos no entran.
- Ningún PDF ni nombre de archivo dice "confección"/"confeccionista"/"estampado"/"estampador". Subtítulos: `Pantalones y shorts` / `Polos`. Archivos: `Lote{n}-pantalones-{YYYY-MM-DD}.pdf` / `Lote{n}-polos-{YYYY-MM-DD}.pdf`.
- Estados ofrecidos: `Pendiente, Diseño enviado, En producción, Listo, Entregado`; por defecto los 3 primeros. `Por confirmar` nunca.
- Pieza: `Manga corta + short` → `Short`; resto → `Pantalón`. Parte de arriba: `Manga larga + pantalón` → `Manga larga`; si no, `Clásico`/`Princesa` (vía `formatCorte`).
- Patrón siempre se resuelve con `resolvePatronImagen(nombre, tipo_mascota)` (filtro por especie obligatorio).
- Fotos reducidas a máx. 800 px, JPEG 0.75, fondo blanco; imágenes procesadas en secuencia; falla → recuadro "foto no disponible", nunca aborta.
- Flujo en 2 pasos (Generar PDF → Descargar/Compartir) por la restricción de gesto de usuario de Safari iOS.
- Nunca usar `hidden` sin la regla CSS `#produccionModal [hidden] { display: none !important; }` (`.btn` define `display`).
- Sin datos de prueba en Supabase; sin SQL.

## Estrategia de pruebas

El proyecto no tiene framework de tests. Se prueba abriendo `index.html` local (`file://`) en el
Browser pane: aunque se muestre el login, todas las funciones son globales y se pueden invocar con
`javascript_tool`. Las funciones puras se prueban con aserciones en consola; los constructores de PDF
con datos de ejemplo que usan imágenes reales públicas de Storage (patrones), abriendo el PDF generado
en una pestaña para inspección visual. La prueba dentro de la app logueada la hace el usuario.

---

### Task 1: Lógica pura y capa de datos

**Files:**
- Modify: `index.html` — agregar bloque JS justo antes de `// --- Utilities ---` (antes de `function showToast`)

**Interfaces:**
- Consumes: `formatCorte(corte)`, `formatNumeroPedido(n, lote)`, `activeLotes`, `sb`
- Produces:
  - `PRODUCCION_ESTADOS: string[]`, `PRODUCCION_ESTADOS_DEFAULT: string[]`
  - `piezaConfeccion(variante) → 'Short'|'Pantalón'`
  - `parteArribaEstampado(item) → 'Manga larga'|'Clásico'|'Princesa'|'—'`
  - `compararTallaProduccion(a, b) → number`
  - `ordenarItemsProduccion(items) → items` (copia ordenada)
  - `resumenConfeccion(items) → [{pieza, talla, color, cantidad}]`
  - `fechaLocalProduccion(date?) → {legible:'DD/MM/YYYY', iso:'YYYY-MM-DD'}`
  - `nombreArchivoProduccion(modo, loteNumero, fechaIso) → string`
  - `obtenerPijamasProduccion(loteId, estados) → Promise<item[]>` donde item = fila de `items_pedido` (`id, pedido_id, variante, talla, corte, color, patron, tipo_mascota, fotos[], orden`) + `numero_pedido` + `numero` (`'39-L5'`)

- [ ] **Step 1: Escribir la prueba (falla)** — abrir `index.html` local en el Browser pane y ejecutar:

```js
const fallas = [];
const eq = (n, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) fallas.push(`${n}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); };
eq('pieza short', piezaConfeccion('Manga corta + short'), 'Short');
eq('pieza pantalon', piezaConfeccion('Manga larga + pantalón'), 'Pantalón');
eq('arriba larga', parteArribaEstampado({ variante: 'Manga larga + pantalón', corte: null }), 'Manga larga');
eq('arriba princesa', parteArribaEstampado({ variante: 'Manga corta + short', corte: 'princesa' }), 'Princesa');
eq('arriba sin corte', parteArribaEstampado({ variante: 'Manga corta + short', corte: null }), '—');
eq('tallas', ['XL', 'raro', '12', 'M', '', 'S', '14'].sort(compararTallaProduccion), ['12', '14', 'S', 'M', 'XL', '', 'raro']);
eq('orden', ordenarItemsProduccion([
  { id: 'c', numero_pedido: 2, orden: null }, { id: 'b', numero_pedido: 2, orden: 1 }, { id: 'a', numero_pedido: 1, orden: 2 }
]).map(i => i.id), ['a', 'b', 'c']);
eq('resumen', resumenConfeccion([
  { variante: 'Manga corta + short', talla: 'S', color: 'A04' },
  { variante: 'Manga corta + pantalón', talla: 'M', color: 'A04' },
  { variante: 'Manga larga + pantalón', talla: 'M', color: 'A04' },
  { variante: 'Manga corta + pantalón', talla: '12', color: 'R01' }
]), [
  { pieza: 'Pantalón', talla: '12', color: 'R01', cantidad: 1 },
  { pieza: 'Pantalón', talla: 'M', color: 'A04', cantidad: 2 },
  { pieza: 'Short', talla: 'S', color: 'A04', cantidad: 1 }
]);
eq('fecha', fechaLocalProduccion(new Date(2026, 8, 5)), { legible: '05/09/2026', iso: '2026-09-05' });
eq('archivo', nombreArchivoProduccion('confeccion', 5, '2026-09-12'), 'Lote5-pantalones-2026-09-12.pdf');
eq('archivo2', nombreArchivoProduccion('estampado', 5, '2026-09-12'), 'Lote5-polos-2026-09-12.pdf');
fallas.length ? fallas : 'OK';
```

- [ ] **Step 2: Verificar que falla** — Expected: `ReferenceError: piezaConfeccion is not defined`.

- [ ] **Step 3: Implementar** — insertar antes de `// --- Utilities ---`:

```js
        // --- PDFs de produccion (confeccion / estampado) ---
        // Solo pijamas. Los PDFs NUNCA dicen para quien son: "confeccion"/"estampado" son etiquetas
        // internas de la app; el documento solo describe su contenido ("Pantalones y shorts" / "Polos").
        const PRODUCCION_ESTADOS = ['Pendiente', 'Diseño enviado', 'En producción', 'Listo', 'Entregado'];
        const PRODUCCION_ESTADOS_DEFAULT = ['Pendiente', 'Diseño enviado', 'En producción'];
        const PRODUCCION_TALLA_ORDEN = ['12', '14', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];

        function piezaConfeccion(variante) {
            return variante === 'Manga corta + short' ? 'Short' : 'Pantalón';
        }

        function parteArribaEstampado(item) {
            if (item.variante === 'Manga larga + pantalón') return 'Manga larga';
            return formatCorte(item.corte) || '—';
        }

        // Tallas conocidas en su orden real; las desconocidas (o vacias) al final, alfabeticas.
        function compararTallaProduccion(a, b) {
            const ta = (a || '').toUpperCase();
            const tb = (b || '').toUpperCase();
            const ia = PRODUCCION_TALLA_ORDEN.indexOf(ta);
            const ib = PRODUCCION_TALLA_ORDEN.indexOf(tb);
            if (ia !== -1 && ib !== -1) return ia - ib;
            if (ia !== -1) return -1;
            if (ib !== -1) return 1;
            return ta.localeCompare(tb);
        }

        // Por numero de pedido y, dentro del pedido, por el orden del formulario (null al final).
        function ordenarItemsProduccion(items) {
            const ordenDe = it => (it.orden == null ? Number.MAX_SAFE_INTEGER : it.orden);
            return [...items].sort((a, b) =>
                ((a.numero_pedido || 0) - (b.numero_pedido || 0)) || (ordenDe(a) - ordenDe(b)));
        }

        function resumenConfeccion(items) {
            const mapa = {};
            items.forEach(it => {
                const pieza = piezaConfeccion(it.variante);
                const talla = it.talla || '';
                const color = it.color || '';
                const key = `${pieza}|${talla}|${color}`;
                if (!mapa[key]) mapa[key] = { pieza, talla, color, cantidad: 0 };
                mapa[key].cantidad++;
            });
            return Object.values(mapa).sort((a, b) =>
                a.pieza.localeCompare(b.pieza) ||
                compararTallaProduccion(a.talla, b.talla) ||
                a.color.localeCompare(b.color));
        }

        function fechaLocalProduccion(fecha = new Date()) {
            const dd = String(fecha.getDate()).padStart(2, '0');
            const mm = String(fecha.getMonth() + 1).padStart(2, '0');
            const yyyy = fecha.getFullYear();
            return { legible: `${dd}/${mm}/${yyyy}`, iso: `${yyyy}-${mm}-${dd}` };
        }

        function nombreArchivoProduccion(modo, loteNumero, fechaIso) {
            const contenido = modo === 'confeccion' ? 'pantalones' : 'polos';
            return `Lote${loteNumero}-${contenido}-${fechaIso}.pdf`;
        }

        async function obtenerPijamasProduccion(loteId, estados) {
            const lote = activeLotes.find(l => l.id === loteId);
            const { data: pedidos, error } = await sb.from('pedidos')
                .select('id, numero_pedido')
                .eq('lote_id', loteId)
                .in('estado', estados);
            if (error) throw error;
            if (!pedidos || pedidos.length === 0) return [];

            const { data: items, error: errorItems } = await sb.from('items_pedido')
                .select('id, pedido_id, variante, talla, corte, color, patron, tipo_mascota, fotos, orden')
                .in('pedido_id', pedidos.map(p => p.id))
                .eq('tipo_producto', 'pijama');
            if (errorItems) throw errorItems;

            const pedidoPorId = Object.fromEntries(pedidos.map(p => [p.id, p]));
            return ordenarItemsProduccion((items || []).map(it => {
                const pedido = pedidoPorId[it.pedido_id];
                return {
                    ...it,
                    numero_pedido: pedido.numero_pedido,
                    numero: formatNumeroPedido(pedido.numero_pedido, lote ? lote.numero : null) || '?',
                    fotos: Array.isArray(it.fotos) ? it.fotos : []
                };
            }));
        }
```

- [ ] **Step 4: Verificar que pasa** — recargar la página, correr el script del Step 1. Expected: `"OK"`.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "Agregar logica y consulta de pijamas para los PDFs de produccion"
```

---

### Task 2: Imágenes y constructores de PDF

**Files:**
- Modify: `index.html:19` — agregar `<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>` después del script de Supabase
- Modify: `index.html` — continuar el bloque JS de Task 1

**Interfaces:**
- Consumes: Task 1 (`piezaConfeccion`, `parteArribaEstampado`, `resumenConfeccion`), `buscarColorPorCodigo`, `resolvePatronImagen`, `window.jspdf`
- Produces:
  - `prepararImagenPDF(url, maxLado=800) → Promise<{dataUrl, ancho, alto} | null>`
  - `construirPDFConfeccion(items, {loteNumero, fecha}) → Promise<Blob>` (`fecha` = `'DD/MM/YYYY'`)
  - `construirPDFEstampado(items, fotosPorItem, {loteNumero, fecha}) → Promise<Blob>` donde `fotosPorItem[item.id] = string[]` (URLs elegidas, puede ser `[]`)

- [ ] **Step 1: Escribir la prueba (falla)** — en `index.html` local:

```js
const pats = await fetch('https://zafgoegngcqsswzzxcen.supabase.co/rest/v1/patrones?select=*&activo=eq.true', { headers: { apikey: SUPABASE_KEY } }).then(r => r.json());
patterns = pats;
const gato1 = pats.find(p => p.nombre === '1' && p.tipo_mascota === 'gato');
const perro1 = pats.find(p => p.nombre === '1' && p.tipo_mascota === 'perro');
const items = [
  { id: 'i1', numero: '3-L5', variante: 'Manga corta + short', talla: 'S', corte: 'clasico', color: 'A04', patron: '1', tipo_mascota: 'gato', fotos: [gato1.imagen_url] },
  { id: 'i2', numero: '3-L5', variante: 'Manga corta + pantalón', talla: 'M', corte: 'princesa', color: 'azul oscuro', patron: 'Sin patrón', tipo_mascota: 'perro', fotos: [] },
  { id: 'i3', numero: '7-L5', variante: 'Manga larga + pantalón', talla: '12', corte: null, color: 'S04', patron: '1', tipo_mascota: 'perro', fotos: [perro1.imagen_url, gato1.imagen_url, perro1.imagen_url, gato1.imagen_url] },
  { id: 'i4', numero: '9-L5', variante: 'Manga corta + short', talla: 'XL', corte: 'clasico', color: 'G10', patron: '4', tipo_mascota: 'gato', fotos: ['https://zafgoegngcqsswzzxcen.supabase.co/storage/v1/object/public/fotos-pedidos/no-existe.jpg'] }
];
const b1 = await construirPDFConfeccion(items, { loteNumero: 5, fecha: '12/09/2026' });
const b2 = await construirPDFEstampado(items, { i1: items[0].fotos, i2: [], i3: items[2].fotos, i4: items[3].fotos }, { loteNumero: 5, fecha: '12/09/2026' });
window.__pdfs = [URL.createObjectURL(b1), URL.createObjectURL(b2)];
({ confeccion: b1.size, estampado: b2.size, tipo: b1.type, urls: window.__pdfs });
```

- [ ] **Step 2: Verificar que falla** — Expected: `ReferenceError: construirPDFConfeccion is not defined`.

- [ ] **Step 3: Implementar** — agregar el `<script>` de jsPDF en el `<head>` y, a continuación del bloque de Task 1:

```js
        const PDF_MARGEN = 15;
        const PDF_ANCHO_UTIL = 180;   // A4 (210mm) menos 2 margenes
        const PDF_LIMITE_Y = 282;     // fondo util de la pagina A4 (297mm)
        const PDF_TEXTO = [44, 24, 16];
        const PDF_TEXTO_SUAVE = [110, 95, 85];

        function cargarImagenDesdeBlob(blob) {
            return new Promise((resolve, reject) => {
                const url = URL.createObjectURL(blob);
                const img = new Image();
                img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
                img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Formato de imagen no soportado')); };
                img.src = url;
            });
        }

        // Descarga una imagen y la reduce (max ~800px, JPEG) para que el PDF quede liviano para WhatsApp.
        // Fondo blanco porque patrones y logo son PNG transparentes. Devuelve null si falla (nunca lanza).
        async function prepararImagenPDF(url, maxLado = 800) {
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const img = await cargarImagenDesdeBlob(await res.blob());
                const escala = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight));
                const ancho = Math.max(1, Math.round(img.naturalWidth * escala));
                const alto = Math.max(1, Math.round(img.naturalHeight * escala));
                const canvas = document.createElement('canvas');
                canvas.width = ancho;
                canvas.height = alto;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, ancho, alto);
                ctx.drawImage(img, 0, 0, ancho, alto);
                return { dataUrl: canvas.toDataURL('image/jpeg', 0.75), ancho, alto };
            } catch (err) {
                console.error('No se pudo preparar una imagen para el PDF:', url, err);
                return null;
            }
        }

        // Cache por PDF: el mismo patron/logo se procesa una sola vez aunque se repita en varias filas.
        function imagenPDFConCache(cache, url, maxLado) {
            if (!cache.has(url)) cache.set(url, prepararImagenPDF(url, maxLado));
            return cache.get(url);
        }

        function hexARgbPDF(hex) {
            const n = parseInt(hex.replace('#', ''), 16);
            return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
        }

        // Dibuja la imagen centrada dentro de una caja cuadrada, sin deformarla.
        function dibujarImagenEnCajaPDF(doc, imagen, x, y, lado) {
            const escala = Math.min(lado / imagen.ancho, lado / imagen.alto);
            const w = imagen.ancho * escala;
            const h = imagen.alto * escala;
            doc.addImage(imagen.dataUrl, 'JPEG', x + (lado - w) / 2, y + (lado - h) / 2, w, h);
        }

        function dibujarRecuadroVacioPDF(doc, x, y, lado, texto) {
            doc.setFillColor(238, 234, 226);
            doc.rect(x, y, lado, lado, 'F');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...PDF_TEXTO_SUAVE);
            doc.text(texto, x + lado / 2, y + lado / 2 + 1, { align: 'center', maxWidth: lado - 4 });
            doc.setTextColor(...PDF_TEXTO);
        }

        // Cuadradito del color real + codigo de pantonera. Codigo desconocido (texto libre viejo): solo texto.
        function dibujarColorPDF(doc, codigo, x, yBase) {
            const color = buscarColorPorCodigo(codigo);
            if (!color) {
                doc.text(codigo || '—', x, yBase);
                return;
            }
            doc.setFillColor(...hexARgbPDF(color.hex));
            doc.setDrawColor(180, 170, 160);
            doc.rect(x, yBase - 3.3, 4, 4, 'FD');
            doc.text(codigo, x + 6, yBase);
        }

        // Miniatura del patron (buscada por nombre Y especie) + su nombre. "Sin patron" o no encontrado: solo texto.
        async function dibujarPatronPDF(doc, item, x, yCaja, yTexto, cache) {
            if (!item.patron) { doc.text('—', x, yTexto); return; }
            const url = item.patron === 'Sin patrón' ? null : resolvePatronImagen(item.patron, item.tipo_mascota);
            const imagen = url ? await imagenPDFConCache(cache, url, 300) : null;
            if (imagen) {
                dibujarImagenEnCajaPDF(doc, imagen, x, yCaja, 12);
                doc.text(item.patron, x + 15, yTexto);
            } else {
                doc.text(item.patron, x, yTexto);
            }
        }

        async function dibujarEncabezadoProduccion(doc, { loteNumero, fecha, subtitulo, totalPrendas }, cache) {
            const logo = await imagenPDFConCache(cache, new URL('logo-icon.png', location.href).href, 200);
            const xTexto = logo ? PDF_MARGEN + 22 : PDF_MARGEN;
            if (logo) dibujarImagenEnCajaPDF(doc, logo, PDF_MARGEN, 10, 18);
            doc.setTextColor(...PDF_TEXTO);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.text(`Lote ${loteNumero} · ${fecha}`, xTexto, 18);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(11);
            doc.setTextColor(...PDF_TEXTO_SUAVE);
            doc.text(`${subtitulo} · ${totalPrendas} prenda${totalPrendas === 1 ? '' : 's'}`, xTexto, 25);
            doc.setDrawColor(232, 112, 58);
            doc.setLineWidth(0.6);
            doc.line(PDF_MARGEN, 32, PDF_MARGEN + PDF_ANCHO_UTIL, 32);
            doc.setLineWidth(0.2);
            doc.setTextColor(...PDF_TEXTO);
            return 42;
        }

        function dibujarCabeceraTablaPDF(doc, y, titulo, columnas) {
            doc.setTextColor(...PDF_TEXTO);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.text(titulo, PDF_MARGEN, y);
            y += 7;
            doc.setFontSize(9);
            doc.setTextColor(...PDF_TEXTO_SUAVE);
            columnas.forEach(([texto, x]) => doc.text(texto, x, y));
            doc.setTextColor(...PDF_TEXTO);
            return y + 3;
        }

        async function construirPDFConfeccion(items, { loteNumero, fecha }) {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ unit: 'mm', format: 'a4' });
            const cache = new Map();
            let y = await dibujarEncabezadoProduccion(doc, { loteNumero, fecha, subtitulo: 'Pantalones y shorts', totalPrendas: items.length }, cache);

            // Resumen: totales por pieza + talla + color
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.text('Resumen', PDF_MARGEN, y);
            y += 8;
            doc.setFontSize(10.5);
            for (const fila of resumenConfeccion(items)) {
                if (y > PDF_LIMITE_Y) { doc.addPage(); y = 20; }
                doc.setFont('helvetica', 'normal');
                doc.text(fila.pieza, PDF_MARGEN, y);
                doc.text(`Talla ${fila.talla || '—'}`, PDF_MARGEN + 30, y);
                dibujarColorPDF(doc, fila.color, PDF_MARGEN + 60, y);
                doc.setFont('helvetica', 'bold');
                doc.text(String(fila.cantidad), PDF_MARGEN + PDF_ANCHO_UTIL, y, { align: 'right' });
                y += 7;
            }

            // Detalle: una fila por pijama
            const cols = { numero: PDF_MARGEN, pieza: PDF_MARGEN + 25, talla: PDF_MARGEN + 55, color: PDF_MARGEN + 80, patron: PDF_MARGEN + 120 };
            const columnas = [['Pedido', cols.numero], ['Pieza', cols.pieza], ['Talla', cols.talla], ['Color', cols.color], ['Patrón', cols.patron]];
            const altoFila = 16;
            y += 6;
            if (y + 10 + altoFila > PDF_LIMITE_Y) { doc.addPage(); y = 20; }
            y = dibujarCabeceraTablaPDF(doc, y, 'Detalle', columnas);

            for (const it of items) {
                if (y + altoFila > PDF_LIMITE_Y) { doc.addPage(); y = dibujarCabeceraTablaPDF(doc, 20, 'Detalle', columnas); }
                doc.setDrawColor(225, 218, 208);
                doc.line(PDF_MARGEN, y, PDF_MARGEN + PDF_ANCHO_UTIL, y);
                const yTexto = y + altoFila / 2 + 1.5;
                doc.setFontSize(10.5);
                doc.setFont('helvetica', 'bold');
                doc.text(`#${it.numero}`, cols.numero, yTexto);
                doc.setFont('helvetica', 'normal');
                doc.text(piezaConfeccion(it.variante), cols.pieza, yTexto);
                doc.text(it.talla || '—', cols.talla, yTexto);
                dibujarColorPDF(doc, it.color, cols.color, yTexto);
                await dibujarPatronPDF(doc, it, cols.patron, y + 2, yTexto, cache);
                y += altoFila;
            }
            return doc.output('blob');
        }

        async function construirPDFEstampado(items, fotosPorItem, { loteNumero, fecha }) {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ unit: 'mm', format: 'a4' });
            const cache = new Map();
            let y = await dibujarEncabezadoProduccion(doc, { loteNumero, fecha, subtitulo: 'Polos', totalPrendas: items.length }, cache);

            const cols = { numero: PDF_MARGEN, talla: PDF_MARGEN + 25, corte: PDF_MARGEN + 42, fotos: PDF_MARGEN + 75 };
            const columnas = [['Pedido', cols.numero], ['Talla', cols.talla], ['Corte', cols.corte], ['Foto(s)', cols.fotos]];
            const ladoFoto = 32;
            const sep = 3;
            const fotosPorLinea = Math.floor((PDF_MARGEN + PDF_ANCHO_UTIL - cols.fotos + sep) / (ladoFoto + sep));
            y = dibujarCabeceraTablaPDF(doc, y, 'Detalle', columnas);

            for (const it of items) {
                const urls = fotosPorItem[it.id] || [];
                const lineas = Math.max(1, Math.ceil(urls.length / fotosPorLinea));
                const altoFila = lineas * (ladoFoto + sep) + sep;
                if (y + altoFila > PDF_LIMITE_Y) { doc.addPage(); y = dibujarCabeceraTablaPDF(doc, 20, 'Detalle', columnas); }
                doc.setDrawColor(225, 218, 208);
                doc.line(PDF_MARGEN, y, PDF_MARGEN + PDF_ANCHO_UTIL, y);
                const yTexto = y + 9;
                doc.setFontSize(10.5);
                doc.setFont('helvetica', 'bold');
                doc.text(`#${it.numero}`, cols.numero, yTexto);
                doc.setFont('helvetica', 'normal');
                doc.text(it.talla || '—', cols.talla, yTexto);
                doc.text(parteArribaEstampado(it), cols.corte, yTexto);

                if (urls.length === 0) dibujarRecuadroVacioPDF(doc, cols.fotos, y + sep, ladoFoto, 'sin foto');
                for (let i = 0; i < urls.length; i++) {
                    const x = cols.fotos + (i % fotosPorLinea) * (ladoFoto + sep);
                    const yFoto = y + sep + Math.floor(i / fotosPorLinea) * (ladoFoto + sep);
                    const imagen = await prepararImagenPDF(urls[i]);
                    if (imagen) dibujarImagenEnCajaPDF(doc, imagen, x, yFoto, ladoFoto);
                    else dibujarRecuadroVacioPDF(doc, x, yFoto, ladoFoto, 'foto no disponible');
                }
                y += altoFila;
            }
            return doc.output('blob');
        }
```

- [ ] **Step 4: Verificar que pasa** — recargar, correr el script del Step 1. Expected: `tipo: "application/pdf"`, tamaños > 0 y razonables (< 1 MB). Abrir cada URL de `window.__pdfs` en una pestaña y revisar:
  - Confección: encabezado "Lote 5 · 12/09/2026" + "Pantalones y shorts · 4 prendas"; resumen con `Pantalón · Talla 12 · S04: 1`, `Pantalón · Talla M · azul oscuro: 1`, `Short · Talla S · A04: 1`, `Short · Talla XL · G10: 1`; detalle con cuadraditos de color (no en "azul oscuro"), miniatura de gato en `#3-L5` y de perro en `#7-L5` (patrón "1" en ambas especies ⇒ imágenes distintas), "Sin patrón" como texto.
  - Estampado: `#3-L5` con 1 foto y "Clásico"; fila con "sin foto" y "Princesa"; `#7-L5` "Manga larga" con 4 fotos en 2 líneas; `#9-L5` con recuadro "foto no disponible". Ninguna imagen deformada. Ningún texto dice "confección"/"estampado".
  - (En `file://` el logo no carga — esperado; se verifica en producción.)

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "Agregar constructores de PDF de pantalones y polos con jsPDF"
```

---

### Task 3: Tarjeta del Dashboard, modal, Descargar y Compartir

**Files:**
- Modify: `index.html` — CSS antes de `/* Order Summary Modal */`; tarjeta dentro de `.dashboard-lower-grid` después de `#materiales-section`; modal después de `#listaComprasModal`; JS a continuación del bloque de Task 2

**Interfaces:**
- Consumes: Tasks 1-2, `getLoteActivo()`, `showToast`, `escapeHtml`
- Produces (llamadas desde HTML): `abrirModalProduccion(modo)`, `cerrarModalProduccion()`, `cargarProduccionFiltro()`, `toggleFotoProduccion(itemId, idx)`, `generarPDFProduccion()`, `descargarPDFProduccion()`, `compartirPDFProduccion()`

- [ ] **Step 1: Prueba manual (falla)** — en `index.html` local: `document.getElementById('produccion-section')` → Expected `null`.

- [ ] **Step 2: CSS** — insertar antes de `/* Order Summary Modal */`:

```css
        /* PDFs de produccion (Dashboard) */
        .produccion-desc {
            color: var(--text-muted);
            font-size: 0.88rem;
            margin-bottom: 1rem;
        }
        .produccion-botones {
            display: flex;
            gap: 0.75rem;
            flex-wrap: wrap;
        }
        #produccionModal [hidden] {
            display: none !important;
        }
        .produccion-estados {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem 1.1rem;
        }
        .produccion-estados label {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.9rem;
            color: var(--text-dark);
            cursor: pointer;
        }
        .produccion-estados input[type="checkbox"] {
            width: auto;
            padding: 0;
            accent-color: var(--accent);
        }
        .produccion-info {
            font-size: 0.9rem;
            color: var(--text-muted);
            margin: 0.5rem 0 1rem;
        }
        .produccion-fotos-ayuda {
            font-size: 0.85rem;
            color: var(--text-muted);
            margin-bottom: 0.6rem;
        }
        .produccion-item {
            background: var(--card-bg);
            border-radius: var(--border-radius-sm);
            box-shadow: var(--shadow-sm);
            padding: 0.75rem 0.9rem;
            margin-bottom: 0.6rem;
        }
        .produccion-item-titulo {
            font-size: 0.9rem;
            color: var(--text-dark);
        }
        .produccion-sin-foto {
            font-size: 0.85rem;
            color: var(--text-muted);
            margin-top: 0.4rem;
        }
        .produccion-fotos-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 0.5rem;
        }
        .produccion-foto {
            position: relative;
            width: 64px;
            height: 64px;
            padding: 0;
            border: 3px solid transparent;
            border-radius: 10px;
            overflow: hidden;
            background: var(--card-secondary);
            cursor: pointer;
            opacity: 0.5;
        }
        .produccion-foto img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }
        .produccion-foto .fa-check {
            display: none;
            position: absolute;
            top: 3px;
            right: 3px;
            background: var(--accent);
            color: #fff;
            border-radius: 50%;
            font-size: 9px;
            padding: 3px;
        }
        .produccion-foto.selected {
            border-color: var(--accent);
            opacity: 1;
        }
        .produccion-foto.selected .fa-check {
            display: block;
        }
```

- [ ] **Step 3: HTML** — después del `</div>` de `#materiales-section` (dentro de `.dashboard-lower-grid`):

```html
                <div class="alerts-section" id="produccion-section">
                    <h3 class="alerts-title"><i class="fa-solid fa-file-pdf"></i> Producción</h3>
                    <p class="produccion-desc">Listas en PDF de las pijamas de un lote, para mandar a producción.</p>
                    <div class="produccion-botones">
                        <button class="btn btn-secondary" onclick="abrirModalProduccion('confeccion')"><i class="fa-solid fa-scissors"></i> Confección</button>
                        <button class="btn btn-secondary" onclick="abrirModalProduccion('estampado')"><i class="fa-solid fa-shirt"></i> Estampado</button>
                    </div>
                </div>
```

Y después del modal `#listaComprasModal`:

```html
    <!-- PDFs de Produccion Modal -->
    <div id="produccionModal" class="summary-modal">
        <div class="summary-modal-content">
            <span class="modal-close summary-modal-close" onclick="cerrarModalProduccion()">&times;</span>
            <div id="produccion-body"></div>
        </div>
    </div>
```

- [ ] **Step 4: JS** — a continuación del bloque de Task 2:

```js
        let produccionModo = null;         // 'confeccion' | 'estampado' (etiqueta interna, nunca va al PDF)
        let produccionItems = [];          // pijamas del filtro actual, ya ordenadas
        let produccionFotosElegidas = {};  // item.id -> Set de indices de item.fotos
        let produccionPDF = null;          // { blob, nombre } listo para descargar/compartir
        let produccionConsulta = 0;        // descarta respuestas de filtros viejos
        let produccionVersionPDF = 0;      // descarta PDFs generados con filtros/fotos que ya cambiaron

        function soportaCompartirArchivos() {
            try {
                return !!(navigator.canShare && navigator.canShare({ files: [new File([''], 'prueba.pdf', { type: 'application/pdf' })] }));
            } catch (e) {
                return false;
            }
        }

        function abrirModalProduccion(modo) {
            if (activeLotes.length === 0) {
                showToast('No hay lotes creados todavía', true);
                return;
            }
            produccionModo = modo;
            produccionItems = [];
            produccionFotosElegidas = {};
            produccionPDF = null;
            const loteActivo = getLoteActivo();
            document.getElementById('produccion-body').innerHTML = `
                <h2 style="margin-bottom: 1.25rem;">${modo === 'confeccion' ? '✂️ Confección' : '👕 Estampado'}</h2>
                <div class="form-group">
                    <label for="produccion-lote">Lote</label>
                    <select id="produccion-lote" onchange="cargarProduccionFiltro()">
                        ${activeLotes.map(l => `<option value="${l.id}" ${loteActivo && l.id === loteActivo.id ? 'selected' : ''}>Lote ${l.numero}${l.activo ? ' — Activo' : ''}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Estados</label>
                    <div class="produccion-estados">
                        ${PRODUCCION_ESTADOS.map(e => `<label><input type="checkbox" value="${e}" ${PRODUCCION_ESTADOS_DEFAULT.includes(e) ? 'checked' : ''} onchange="cargarProduccionFiltro()"> ${e}</label>`).join('')}
                    </div>
                </div>
                <p id="produccion-info" class="produccion-info">Cargando...</p>
                <div id="produccion-fotos"></div>
                <div class="summary-actions" style="margin-top: 1.25rem;">
                    <button id="produccion-btn-generar" class="btn" onclick="generarPDFProduccion()" disabled><i class="fa-solid fa-file-pdf"></i> Generar PDF</button>
                    <button id="produccion-btn-descargar" class="btn" onclick="descargarPDFProduccion()" hidden><i class="fa-solid fa-download"></i> Descargar</button>
                    <button id="produccion-btn-compartir" class="btn btn-secondary" onclick="compartirPDFProduccion()" hidden><i class="fa-solid fa-share-from-square"></i> Compartir</button>
                </div>
            `;
            document.getElementById('produccionModal').classList.add('show');
            cargarProduccionFiltro();
        }

        function cerrarModalProduccion() {
            document.getElementById('produccionModal').classList.remove('show');
            produccionConsulta++;
            produccionVersionPDF++;
            produccionPDF = null;
        }

        // Cualquier cambio de filtro o de fotos descarta el PDF ya generado.
        function invalidarPDFProduccion() {
            produccionVersionPDF++;
            produccionPDF = null;
            const generar = document.getElementById('produccion-btn-generar');
            if (!generar) return;
            generar.hidden = false;
            generar.disabled = produccionItems.length === 0;
            generar.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Generar PDF';
            document.getElementById('produccion-btn-descargar').hidden = true;
            document.getElementById('produccion-btn-compartir').hidden = true;
        }

        async function cargarProduccionFiltro() {
            const consulta = ++produccionConsulta;
            const loteId = document.getElementById('produccion-lote').value;
            const estados = [...document.querySelectorAll('.produccion-estados input:checked')].map(i => i.value);
            const info = document.getElementById('produccion-info');
            produccionItems = [];
            produccionFotosElegidas = {};
            document.getElementById('produccion-fotos').innerHTML = '';
            invalidarPDFProduccion();

            if (estados.length === 0) {
                info.textContent = 'Marca al menos un estado.';
                return;
            }
            info.textContent = 'Cargando...';

            let items;
            try {
                items = await obtenerPijamasProduccion(loteId, estados);
            } catch (err) {
                if (consulta !== produccionConsulta) return;
                console.error('Error cargando pijamas para produccion:', err);
                info.textContent = 'No se pudieron cargar los pedidos. Intenta de nuevo.';
                return;
            }
            if (consulta !== produccionConsulta) return;

            produccionItems = items;
            if (items.length === 0) {
                info.textContent = 'No hay pijamas con esos filtros.';
            } else {
                info.textContent = `${items.length} pijama${items.length === 1 ? '' : 's'} en la lista.`;
                if (produccionModo === 'estampado') {
                    items.forEach(it => { produccionFotosElegidas[it.id] = new Set(it.fotos.length > 0 ? [0] : []); });
                    renderFotosProduccion();
                }
            }
            invalidarPDFProduccion();
        }

        function renderFotosProduccion() {
            document.getElementById('produccion-fotos').innerHTML = `
                <div class="produccion-fotos-ayuda">Toca las fotos que van en el PDF de cada pijama.</div>
                ${produccionItems.map(it => `
                    <div class="produccion-item">
                        <div class="produccion-item-titulo"><strong>#${escapeHtml(it.numero)}</strong> · Talla ${escapeHtml(it.talla || '—')} · ${escapeHtml(parteArribaEstampado(it))}</div>
                        ${it.fotos.length === 0 ? '<div class="produccion-sin-foto">sin foto</div>' : `
                        <div class="produccion-fotos-grid">
                            ${it.fotos.map((url, idx) => `
                                <button type="button" id="prodfoto-${it.id}-${idx}" class="produccion-foto ${produccionFotosElegidas[it.id].has(idx) ? 'selected' : ''}" onclick="toggleFotoProduccion('${it.id}', ${idx})">
                                    <img src="${escapeHtml(url)}" alt="Foto ${idx + 1}" loading="lazy">
                                    <i class="fa-solid fa-check"></i>
                                </button>
                            `).join('')}
                        </div>`}
                    </div>
                `).join('')}
            `;
        }

        function toggleFotoProduccion(itemId, idx) {
            const elegidas = produccionFotosElegidas[itemId];
            if (!elegidas) return;
            if (elegidas.has(idx)) elegidas.delete(idx);
            else elegidas.add(idx);
            document.getElementById(`prodfoto-${itemId}-${idx}`).classList.toggle('selected', elegidas.has(idx));
            invalidarPDFProduccion();
        }

        async function generarPDFProduccion() {
            if (produccionItems.length === 0) return;
            const boton = document.getElementById('produccion-btn-generar');
            boton.disabled = true;
            boton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';
            const version = produccionVersionPDF;
            try {
                const lote = activeLotes.find(l => l.id === document.getElementById('produccion-lote').value);
                const fecha = fechaLocalProduccion();
                const opciones = { loteNumero: lote.numero, fecha: fecha.legible };
                let blob;
                if (produccionModo === 'confeccion') {
                    blob = await construirPDFConfeccion(produccionItems, opciones);
                } else {
                    const fotosPorItem = {};
                    produccionItems.forEach(it => {
                        fotosPorItem[it.id] = [...produccionFotosElegidas[it.id]].sort((a, b) => a - b).map(i => it.fotos[i]);
                    });
                    blob = await construirPDFEstampado(produccionItems, fotosPorItem, opciones);
                }
                if (version !== produccionVersionPDF) return; // cambio algo mientras se generaba
                produccionPDF = { blob, nombre: nombreArchivoProduccion(produccionModo, lote.numero, fecha.iso) };
                boton.hidden = true;
                document.getElementById('produccion-btn-descargar').hidden = false;
                document.getElementById('produccion-btn-compartir').hidden = !soportaCompartirArchivos();
            } catch (err) {
                console.error('Error generando PDF de produccion:', err);
                showToast('No se pudo generar el PDF', true);
                if (version === produccionVersionPDF) invalidarPDFProduccion();
            }
        }

        function descargarPDFProduccion() {
            if (!produccionPDF) return;
            const url = URL.createObjectURL(produccionPDF.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = produccionPDF.nombre;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        }

        async function compartirPDFProduccion() {
            if (!produccionPDF) return;
            const archivo = new File([produccionPDF.blob], produccionPDF.nombre, { type: 'application/pdf' });
            try {
                await navigator.share({ files: [archivo] });
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error('Error compartiendo PDF:', err);
                    showToast('No se pudo compartir el PDF', true);
                }
            }
        }
```

- [ ] **Step 5: Verificar** — en `index.html` local, simular sesión sin tocar Supabase:

```js
document.getElementById('login-screen')?.remove?.();
activeLotes = [{ id: 'L5', numero: 5, activo: true }, { id: 'L4', numero: 4, activo: false }];
patterns = await fetch('https://zafgoegngcqsswzzxcen.supabase.co/rest/v1/patrones?select=*&activo=eq.true', { headers: { apikey: SUPABASE_KEY } }).then(r => r.json());
const g = patterns.find(p => p.tipo_mascota === 'gato').imagen_url, p = patterns.find(p => p.tipo_mascota === 'perro').imagen_url;
obtenerPijamasProduccion = async (loteId, estados) => loteId === 'L4' ? [] : [
  { id: 'i1', numero: '3-L5', numero_pedido: 3, variante: 'Manga corta + short', talla: 'S', corte: 'clasico', color: 'A04', patron: '1', tipo_mascota: 'gato', fotos: [g, p] },
  { id: 'i2', numero: '7-L5', numero_pedido: 7, variante: 'Manga larga + pantalón', talla: 'M', corte: null, color: 'S04', patron: 'Sin patrón', tipo_mascota: 'perro', fotos: [] }
];
abrirModalProduccion('estampado');
```

Checks (screenshots): modal con lote 5 seleccionado, 3 estados marcados, "2 pijamas en la lista.", fotos de `#3-L5` con la 1ª marcada; tocar la 2ª la marca; `#7-L5` "Manga larga" + "sin foto". Desmarcar todos los estados → "Marca al menos un estado." y Generar deshabilitado. Cambiar a Lote 4 → "No hay pijamas con esos filtros.". Volver a Lote 5, Generar → aparecen Descargar (y Compartir oculto en Chrome de escritorio). Tocar una foto → vuelve "Generar PDF". Probar modo `confeccion` (sin sección de fotos). Vista móvil (preset mobile): tarjeta y modal usables. Revertir preset a desktop.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "Agregar tarjeta Produccion en el Dashboard con modal para generar, descargar y compartir los PDFs"
```

---

### Task 4: Deploy, verificación y documentación

**Files:**
- Modify: `CLAUDE.md` (Stack: jsPDF en `index.html`; Lógica de negocio: sección "PDFs de producción"; Progreso 2026-09-12)

- [ ] **Step 1:** `git push origin main`.
- [ ] **Step 2:** Verificar deploy: `curl -s https://registro-pedidos-pf.vercel.app/ | grep -c "construirPDFEstampado\|jspdf.umd.min.js"` → Expected ≥ 2 (reintentar tras ~1 min si Vercel aún no terminó).
- [ ] **Step 3:** Actualizar `CLAUDE.md`, commit y push.
- [ ] **Step 4:** Pedir al usuario la prueba real en iPhone (PWA logueada): generar ambos PDFs del lote activo, Compartir → WhatsApp, revisar logo/fotos/colores/patrones.
