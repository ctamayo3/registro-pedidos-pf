# Formulario Público — Fase 2: `pedido.html` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir `pedido.html`, el formulario público donde el cliente arma su pedido de
principio a fin y lo guarda directo en Supabase con `origen='web'`.

**Architecture:** Archivo nuevo y 100% independiente de `index.html` (sin login, sin importar nada
del dashboard). Reutiliza los mismos patrones ya probados en `index.html` (`PANTONERA`,
`CAMPOS_POR_TIPO`, subida de fotos con paste/drag) pero adaptados: color como cuadrícula visual (no
dropdown+hex), sin campos internos (lote/estado/urgente/adelanto/observaciones generales), precio
visible pero de solo lectura (el trigger de Postgres ya lo recalcula igual, ver Fase 1).

**Tech Stack:** HTML/CSS/JS vanilla, `@supabase/supabase-js@2` vía CDN, mismo cliente `sb` con la
`anon key` pública (sin sesión — RLS ya permite `INSERT` anónimo en `pedidos`/`items_pedido` y
`SELECT` anónimo en `catalogo_productos`/`patrones`, ver Fase 1).

## Global Constraints

- Spec completo: [docs/superpowers/specs/2026-08-18-formulario-publico-design.md](../specs/2026-08-18-formulario-publico-design.md).
- `pedido.html` no debe contener ningún código que lea `recetas_materiales`, `lotes`, `gastos_lote`,
  `caja_ajustes`, ni el dashboard — es la barrera de seguridad por separación de archivos.
- Talla de Pijama: lista fija `12, 14, S, M, L, XL` (confirmado). Otros tipos mantienen talla como
  texto libre por ahora.
- Corte: select de texto por ahora (Clásico/Princesa) — el selector visual queda pendiente a que el
  usuario mande imágenes de referencia, NO se bloquea esta fase por eso.
- Color: cuadrícula de 10 tonos reales clickeables por familia, SIN botón de copiar hex ni campo de
  texto del hex (eso es solo para `index.html`). Disclaimer fijo: *"Los colores pueden variar
  ligeramente según la pantalla de tu celular o computadora 📱💻"*.
- Mensaje fijo de fotos: *"El precio incluye hasta 3 fotos por producto 📸 ¿Necesitas subir más?
  Cada foto adicional (desde la 4ta) tiene un costo extra de S/5."* — solo informativo, no se
  calcula ni se bloquea el envío por subir más de 3.
- Mensaje fijo de plazo (visible antes de enviar Y en la pantalla de éxito): *"El plazo máximo de
  producción son 7 días hábiles 🗓️ sin embargo en caso su pedido esté listo antes le enviaremos el
  mensajito para coordinar el envío ⭐️✅"*.
- Mensaje de éxito: *"¡Tu pedido fue registrado con éxito! 🎉 Para confirmarlo, coordinamos contigo
  por WhatsApp el adelanto del 50% del total y cualquier detalle final 💛"*.
- PDF y botones de WhatsApp/Instagram son la Fase 4 — esta fase NO los incluye. La pantalla de éxito
  de esta fase muestra el código de pedido y los 2 mensajes de arriba, sin más.
- No hay framework de tests — verificación manual vía navegador y REST, contra el Supabase real.
- Datos de prueba: cliente `ZZZ PRUEBA FASE2 — BORRAR`, borrar al final y confirmar.

---

### Task 1: Trigger — asignar `lote_id` automáticamente

**Files:**
- Modify: `supabase-sql/2026-08-18-formulario-publico-schema.sql` (actualizar la copia de
  referencia con la nueva versión de la función)

**Interfaces:**
- Produces: al insertar un pedido `origen='web'` sin `lote_id`, el trigger lo asigna solo al lote
  activo. Si no hay ningún lote activo, el INSERT falla con un mensaje de error que contiene el
  texto `NO_LOTE_ACTIVO` — Task 5 lo captura para mostrar el mensaje amigable.

- [ ] **Step 1: Dar el SQL al usuario (reemplaza la función ya existente de la Fase 1)**

```sql
CREATE OR REPLACE FUNCTION preparar_pedido_web()
RETURNS trigger AS $$
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
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Esperar confirmación de que lo corrió (`CREATE OR REPLACE` no rompe nada, solo actualiza la función
existente — el trigger ya creado en la Fase 1 sigue apuntando a esta función sin cambios).

- [ ] **Step 2: Verificar el caso feliz (con lote activo)**

```bash
PEDIDO=$(curl -s -X POST "https://zafgoegngcqsswzzxcen.supabase.co/rest/v1/pedidos" \
  -H "apikey: sb_publishable_xmTh0DSBcGFF_0ZBb2ePcQ_Ktv8gKUB" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"cliente_nombre":"ZZZ PRUEBA LOTEID BORRAR","canal":"otro","origen":"web","precio_total":1,"monto_pagado":0,"estado":"Pendiente"}')
echo "$PEDIDO"
# Verificar: trae un lote_id real (no null), sin necesidad de haberlo mandado en el insert
PEDIDO_ID=$(echo "$PEDIDO" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
curl -s -X DELETE "https://zafgoegngcqsswzzxcen.supabase.co/rest/v1/pedidos?id=eq.$PEDIDO_ID" \
  -H "apikey: sb_publishable_xmTh0DSBcGFF_0ZBb2ePcQ_Ktv8gKUB"
```

Nota: para probar el caso SIN lote activo habría que desactivar el único lote activo temporalmente,
lo cual afecta la app real en uso — no se prueba ese caso contra producción en este paso; se
verifica el manejo del error del lado del cliente en la Task 5 revisando el código, no
recreando el escenario en la base de datos real.

- [ ] **Step 3: Actualizar la copia de referencia en el repo**

Reemplazar la función `preparar_pedido_web` dentro de
`supabase-sql/2026-08-18-formulario-publico-schema.sql` por la versión nueva de arriba.

- [ ] **Step 4: Commit**

```bash
git add supabase-sql/2026-08-18-formulario-publico-schema.sql
git commit -m "Trigger: asignar lote_id automatico y validar que exista un lote activo"
```

---

### Task 2: Scaffold de `pedido.html`

**Files:**
- Create: `pedido.html`

**Interfaces:**
- Produces: página que carga, con branding de marca, cliente `sb` inicializado, `catalog`/
  `patterns` cargados desde Supabase al iniciar. Usado por todas las tareas siguientes.

- [ ] **Step 1: Crear el archivo con la estructura base**

```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Peludos Factory - Arma tu Pedido</title>
    <link rel="icon" type="image/png" href="/logo-icon.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <style>
        :root {
            --bg: #FDFAF0;
            --card-bg: #FFFFFF;
            --card-secondary: #E8E0D2;
            --accent: #E8703A;
            --accent-dark: #C4522A;
            --accent-gradient: linear-gradient(135deg, #E8703A 0%, #C4522A 100%);
            --accent-soft: #FBE4D6;
            --gold: #D9A05B;
            --gold-soft: #F4E3C9;
            --text-dark: #2A1F1A;
            --text-muted: #8A7D6E;
            --text-faint: #B3A896;
            --success: #3A7D5C;
            --danger: #B5482F;
            --danger-soft: #F5E2DC;
            --border: #DDD3C0;
            --border-strong: #CBBDA3;
            --border-radius: 20px;
            --border-radius-sm: 14px;
            --border-radius-pill: 999px;
            --shadow-sm: 0 1px 2px rgba(74, 52, 32, 0.04), 0 4px 14px rgba(196, 82, 42, 0.07);
            --shadow-lifted: 0 4px 10px rgba(74, 52, 32, 0.06), 0 24px 48px rgba(74, 52, 32, 0.16);
            --font-display: 'Fraunces', serif;
            --transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Poppins', sans-serif; }
        body { background: var(--bg); color: var(--text-dark); font-size: 14px; padding: 1.5rem; }
        .wrap { max-width: 640px; margin: 0 auto; }
        .brand-header { text-align: center; margin-bottom: 1.5rem; }
        .brand-header img { width: 56px; height: 56px; border-radius: 12px; object-fit: contain; margin-bottom: 0.5rem; }
        .brand-header h1 { font-family: var(--font-display); font-size: 1.5rem; }
        .brand-header p { color: var(--text-muted); font-size: 0.85rem; margin-top: 0.25rem; }
        .card { background: var(--card-bg); border-radius: var(--border-radius); box-shadow: var(--shadow-sm); padding: 1.5rem; margin-bottom: 1.25rem; }
        .card h2 { font-family: var(--font-display); font-size: 1.1rem; margin-bottom: 1rem; }
        .form-group { margin-bottom: 1rem; }
        .form-group label { display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 0.4rem; color: var(--text-dark); }
        .form-group input[type="text"], .form-group input[type="email"], .form-group input[type="number"], .form-group select, .form-group textarea {
            width: 100%; padding: 0.65rem 0.8rem; border: 1px solid var(--border); border-radius: var(--border-radius-sm);
            font-size: 16px; background: var(--card-bg); color: var(--text-dark);
        }
        .btn { background: var(--accent-gradient); color: #fff; border: none; padding: 0.8rem 1.5rem;
            border-radius: var(--border-radius-pill); font-weight: 700; font-size: 0.95rem; cursor: pointer; transition: var(--transition); }
        .btn:hover { filter: brightness(1.05); }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-secondary { background: var(--card-secondary); color: var(--text-dark); }
        .info-banner { background: var(--accent-soft); color: var(--accent-dark); padding: 0.9rem 1rem;
            border-radius: var(--border-radius-sm); font-size: 0.85rem; margin-bottom: 1.25rem; line-height: 1.4; }
        .loader { display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.4);
            border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; vertical-align: middle; margin-left: 8px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        #toast { visibility: hidden; position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
            background: var(--text-dark); color: #fff; padding: 0.8rem 1.2rem; border-radius: var(--border-radius-sm); z-index: 999; font-size: 0.85rem; }
        #toast.show { visibility: visible; }
        #toast.error { background: var(--danger); }
    </style>
</head>
<body>
    <div class="wrap">
        <div class="brand-header">
            <img src="/logo-icon.png" alt="Peludos Factory">
            <h1>Peludos Factory</h1>
            <p>Arma tu pedido personalizado</p>
        </div>

        <div id="form-view"></div>
        <div id="success-view" style="display:none;"></div>
    </div>

    <div id="toast">Mensaje</div>

    <script>
        const SUPABASE_URL = 'https://zafgoegngcqsswzzxcen.supabase.co';
        const SUPABASE_KEY = 'sb_publishable_xmTh0DSBcGFF_0ZBb2ePcQ_Ktv8gKUB';
        const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        let catalog = [];
        let patterns = [];
        let productCounter = 0;
        let imagesFiles = {};
        let enviando = false;

        function showToast(message, isError = false) {
            const toast = document.getElementById('toast');
            toast.innerText = message;
            toast.className = 'show' + (isError ? ' error' : '');
            setTimeout(() => { toast.className = toast.className.replace('show', ''); }, 3500);
        }

        function escapeHtml(str) {
            const div = document.createElement('div');
            div.textContent = str == null ? '' : String(str);
            return div.innerHTML;
        }

        async function loadCatalog() {
            const { data, error } = await sb.from('catalogo_productos').select('*').eq('activo', true);
            if (error) throw error;
            catalog = data;
        }

        async function loadPatterns() {
            const { data, error } = await sb.from('patrones').select('*').eq('activo', true);
            if (error) throw error;
            patterns = data;
        }

        document.addEventListener('DOMContentLoaded', async () => {
            try {
                await Promise.all([loadCatalog(), loadPatterns()]);
                renderForm();
            } catch (error) {
                console.error(error);
                document.getElementById('form-view').innerHTML = `
                    <div class="card" style="text-align:center; color: var(--danger);">
                        <p>No se pudo cargar el formulario. Intenta de nuevo en unos minutos.</p>
                    </div>`;
            }
        });
    </script>
</body>
</html>
```

- [ ] **Step 2: Verificar que carga**

Abrir `pedido.html` local en el Browser tool. Confirmar: se ve el header con logo, sin errores de
consola relacionados a `loadCatalog`/`loadPatterns` (deberían traer datos reales, ya que
`catalogo_productos`/`patrones` son públicos desde la Fase 1). La página se ve vacía debajo del
header — es esperado, `renderForm()` todavía no existe (se agrega en la Task 3).

- [ ] **Step 3: Commit**

```bash
git add pedido.html
git commit -m "Scaffold de pedido.html: branding, cliente Supabase, carga de catalogo y patrones"
```

---

### Task 3: Sección "Datos del cliente"

**Files:**
- Modify: `pedido.html` (agregar `renderForm()` con la primera sección, y el mensaje de plazo)

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `renderForm()` — pinta el formulario completo en `#form-view`. Los campos de esta
  sección tienen los ids `cliente_canal`, `cliente_nombre`, `cliente_contacto`. Función
  `onCanalChange()` que actualiza el label de "Nombre" según el canal elegido.

- [ ] **Step 1: Agregar `renderForm()` y la sección de datos del cliente**

Agregar antes de `document.addEventListener('DOMContentLoaded', ...)`:

```javascript
        function renderForm() {
            document.getElementById('form-view').innerHTML = `
                <div class="card">
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
                        <label id="cliente_nombre_label">Nombre completo</label>
                        <input type="text" id="cliente_nombre" required>
                    </div>
                    <div class="form-group">
                        <label>Contacto (teléfono o usuario)</label>
                        <input type="text" id="cliente_contacto" required>
                    </div>
                </div>

                <div id="productos-container"></div>

                <div class="card" style="text-align:center;">
                    <button type="button" class="btn btn-secondary" onclick="addProductItem()">
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

                <p id="submit-error" class="login-error" style="display:none; color: var(--danger); margin-bottom: 1rem;"></p>

                <button type="button" class="btn" id="btn-enviar" onclick="enviarPedido()" style="width:100%;">
                    <span id="btn-enviar-text">Registrar pedido</span>
                    <div class="loader" id="btn-enviar-loader" style="display:none;"></div>
                </button>
            `;
            addProductItem();
        }

        function onCanalChange() {
            const canal = document.getElementById('cliente_canal').value;
            const label = document.getElementById('cliente_nombre_label');
            label.textContent = canal === 'ig' ? 'Usuario de Instagram' : 'Nombre completo';
        }
```

- [ ] **Step 2: Verificar en el navegador**

Recargar `pedido.html`. Confirmar: se ve la sección "Tus datos", el mensaje del plazo de
producción, un botón "Agregar otro producto" y "Registrar pedido" (todavía sin efecto real, se
implementa en tareas siguientes). Cambiar el select de canal a "Instagram" y confirmar que el label
de "Nombre" cambia a "Usuario de Instagram".

- [ ] **Step 3: Commit**

```bash
git add pedido.html
git commit -m "Agregar seccion de datos del cliente al formulario publico"
```

---

### Task 4: Sección "Productos" — tipo, variante, talla, corte, color visual, patrón, fotos

**Files:**
- Modify: `pedido.html`

**Interfaces:**
- Consumes: `catalog`, `patterns` (Task 2), `escapeHtml` (Task 2).
- Produces: `addProductItem()`, `removeProductItem(id)`, `onTipoProductoChange(prodId)`,
  `updateVariants(prodId)`, `updatePrice(prodId)`, `updateCamposPorTipo(prodId)`,
  `updateCorteVisibility(prodId)`, `renderColorFamilias(prodId)`, `selectColorFamilia(prodId, key)`,
  `selectColorTono(prodId, codigo, hex)`, `renderPatternGallery(prodId)`,
  `selectPattern(prodId, id)`, `handleFileSelect/handleDrop/handleGlobalPaste/addFilesToProduct/
  renderImagePreviews/removeImage` (subida de fotos), `calculateTotal()`. Usado por Task 5 (envío).

- [ ] **Step 1: Agregar la constante `PANTONERA` y `CAMPOS_POR_TIPO`**

Agregar justo después de `let enviando = false;`:

```javascript
        const CAMPOS_POR_TIPO = {
            pijama:   { talla: true,  color: true,  patron: true,  mascota_nombre: false, mascota_anio: false, mascota_raza: false, tallaFija: ['12','14','S','M','L','XL'] },
            manta:    { talla: false, color: true,  patron: true,  mascota_nombre: false, mascota_anio: false, mascota_raza: false, tallaFija: null },
            polo:     { talla: true,  color: false, patron: false, mascota_nombre: true,  mascota_anio: true,  mascota_raza: true,  tallaFija: null },
            tote_bag: { talla: false, color: false, patron: false, mascota_nombre: true,  mascota_anio: true,  mascota_raza: true,  tallaFija: null },
            otro:     { talla: true,  color: true,  patron: true,  mascota_nombre: true,  mascota_anio: true,  mascota_raza: true,  tallaFija: null }
        };
        const VARIANTES_CON_CORTE = ['Manga corta + short', 'Manga corta + pantalón'];

        const PANTONERA = {
            R: { nombre: "Rojos", colores: [
                { codigo: "R01", hex: "#820000" }, { codigo: "R02", hex: "#9A0001" }, { codigo: "R03", hex: "#B30000" },
                { codigo: "R04", hex: "#CD0000" }, { codigo: "R05", hex: "#E70000" }, { codigo: "R06", hex: "#FF0000" },
                { codigo: "R07", hex: "#FF1818" }, { codigo: "R08", hex: "#FF3232" }, { codigo: "R09", hex: "#F84848" }, { codigo: "R10", hex: "#FA5354" },
            ]},
            A: { nombre: "Azul", colores: [
                { codigo: "A01", hex: "#041037" }, { codigo: "A02", hex: "#031846" }, { codigo: "A03", hex: "#082065" },
                { codigo: "A04", hex: "#062D77" }, { codigo: "A05", hex: "#114D94" }, { codigo: "A06", hex: "#022239" },
                { codigo: "A07", hex: "#013B63" }, { codigo: "A08", hex: "#01487C" }, { codigo: "A09", hex: "#2A6F98" }, { codigo: "A10", hex: "#2D7DA0" },
            ]},
            V: { nombre: "Verde", colores: [
                { codigo: "V01", hex: "#1D2E28" }, { codigo: "V02", hex: "#1A3A2D" }, { codigo: "V03", hex: "#154630" },
                { codigo: "V04", hex: "#115234" }, { codigo: "V05", hex: "#0A5C36" }, { codigo: "V06", hex: "#07693A" },
                { codigo: "V07", hex: "#48843E" }, { codigo: "V08", hex: "#5D9F58" }, { codigo: "V09", hex: "#78B87B" }, { codigo: "V10", hex: "#9CD4A3" },
            ]},
            O: { nombre: "Rosa", colores: [
                { codigo: "S01", hex: "#FB5994" }, { codigo: "S02", hex: "#FC72A3" }, { codigo: "S03", hex: "#FC8CB4" },
                { codigo: "S04", hex: "#FDA4C4" }, { codigo: "S05", hex: "#FDBDD5" }, { codigo: "S06", hex: "#E9328C" },
                { codigo: "S07", hex: "#FF92B1" }, { codigo: "S08", hex: "#FFC3D3" }, { codigo: "S09", hex: "#FFE4ED" }, { codigo: "S10", hex: "#FC5A93" },
            ]},
            L: { nombre: "Lila", colores: [
                { codigo: "L01", hex: "#663090" }, { codigo: "L02", hex: "#823DBA" }, { codigo: "L03", hex: "#9657C9" },
                { codigo: "L04", hex: "#A774D3" }, { codigo: "L05", hex: "#C6A4E1" }, { codigo: "L06", hex: "#D9C2EB" },
                { codigo: "L07", hex: "#EDE0F5" }, { codigo: "L08", hex: "#C6ADFF" }, { codigo: "L09", hex: "#AB8BEE" }, { codigo: "L10", hex: "#926DD7" },
            ]},
            G: { nombre: "Gris", colores: [
                { codigo: "G01", hex: "#000000" }, { codigo: "G02", hex: "#1A1A1A" }, { codigo: "G03", hex: "#333333" },
                { codigo: "G04", hex: "#4D4D4D" }, { codigo: "G05", hex: "#666666" }, { codigo: "G06", hex: "#808080" },
                { codigo: "G07", hex: "#999999" }, { codigo: "G08", hex: "#CCCCCC" }, { codigo: "G09", hex: "#E6E6E6" }, { codigo: "G10", hex: "#E6E6E6" },
            ]},
            C: { nombre: "Celeste", colores: [
                { codigo: "C01", hex: "#0A3D62" }, { codigo: "C02", hex: "#155C8C" }, { codigo: "C03", hex: "#1F76A8" },
                { codigo: "C04", hex: "#3B94C4" }, { codigo: "C05", hex: "#5EB0D9" }, { codigo: "C06", hex: "#7FC5E5" },
                { codigo: "C07", hex: "#A0D6EC" }, { codigo: "C08", hex: "#C1E4F2" }, { codigo: "C09", hex: "#DDF0F8" }, { codigo: "C10", hex: "#EFF8FC" },
            ]},
            M: { nombre: "Marrón", colores: [
                { codigo: "M01", hex: "#2E1A0F" }, { codigo: "M02", hex: "#3D2415" }, { codigo: "M03", hex: "#4E301C" },
                { codigo: "M04", hex: "#603C24" }, { codigo: "M05", hex: "#754A2E" }, { codigo: "M06", hex: "#8B5A38" },
                { codigo: "M07", hex: "#A16E47" }, { codigo: "M08", hex: "#B98559" }, { codigo: "M09", hex: "#CD9E75" }, { codigo: "M10", hex: "#E0BC9C" },
            ]},
            Y: { nombre: "Amarillo", colores: [
                { codigo: "Y01", hex: "#7A6300" }, { codigo: "Y02", hex: "#9C8000" }, { codigo: "Y03", hex: "#C4A200" },
                { codigo: "Y04", hex: "#FFF86C" }, { codigo: "Y05", hex: "#FFFBA7" }, { codigo: "Y06", hex: "#F0C449" },
                { codigo: "Y07", hex: "#F3CF5F" }, { codigo: "Y08", hex: "#F6DC7D" }, { codigo: "Y09", hex: "#F9ECA8" }, { codigo: "Y10", hex: "#FDFBD4" },
            ]},
            J: { nombre: "Anaranjado", colores: [
                { codigo: "J01", hex: "#D24F01" }, { codigo: "J02", hex: "#DC6602" }, { codigo: "J03", hex: "#E17602" },
                { codigo: "J04", hex: "#E88504" }, { codigo: "J05", hex: "#EC9006" }, { codigo: "J06", hex: "#EE9F27" },
                { codigo: "J07", hex: "#F5C67E" }, { codigo: "J08", hex: "#F9DCB0" }, { codigo: "J09", hex: "#F68D4B" }, { codigo: "J10", hex: "#FFBC7D" },
            ]},
            T: { nombre: "Turquesa", colores: [
                { codigo: "T01", hex: "#004C3F" }, { codigo: "T02", hex: "#00695B" }, { codigo: "T03", hex: "#00796A" },
                { codigo: "T04", hex: "#00887A" }, { codigo: "T05", hex: "#009788" }, { codigo: "T06", hex: "#26A59A" },
                { codigo: "T07", hex: "#4CB6AC" }, { codigo: "T08", hex: "#80CBC4" }, { codigo: "T09", hex: "#B2DFDC" }, { codigo: "T10", hex: "#E0F2F2" },
            ]},
            P: { nombre: "Pasteles", colores: [
                { codigo: "P01", hex: "#FBEBEC" }, { codigo: "P02", hex: "#FFD6AA" }, { codigo: "P03", hex: "#E8D4F9" },
                { codigo: "P04", hex: "#DDECD7" }, { codigo: "P05", hex: "#FDF0AA" }, { codigo: "P06", hex: "#E9D4E7" },
                { codigo: "P07", hex: "#FDC1B7" }, { codigo: "P08", hex: "#D0EEEE" }, { codigo: "P09", hex: "#EED8AF" }, { codigo: "P10", hex: "#DEE7F6" },
            ]},
        };
```

(Nota: copiada tal cual de `index.html` — es la misma paleta oficial de marca, ver
`CLAUDE.md` sección "Selector de color".)

- [ ] **Step 2: Agregar `addProductItem`, `removeProductItem` y el CSS de las tarjetas de producto**

Agregar al `<style>`, antes del cierre `</style>`:

```css
        .product-item { border: 1px solid var(--border); border-radius: var(--border-radius-sm); padding: 1.25rem; margin-bottom: 1rem; position: relative; }
        .product-item-header { display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem; }
        .product-item-header strong { font-family: var(--font-display); }
        .remove-item-btn { background:none; border:none; color: var(--text-muted); cursor:pointer; font-size: 1rem; }
        .chip-grid { display: flex; flex-wrap: wrap; gap: 8px; }
        .chip-option { padding: 6px 14px; border-radius: var(--border-radius-pill); border: 1px solid var(--border);
            background: var(--card-bg); cursor: pointer; font-size: 0.82rem; font-weight: 600; }
        .chip-option.selected { background: var(--accent-gradient); color: #fff; border-color: transparent; }
        .color-familia-grid { display:flex; flex-wrap:wrap; gap:8px; margin-bottom: 0.75rem; }
        .color-tono-grid { display:flex; flex-wrap:wrap; gap:8px; }
        .color-swatch-btn { width: 40px; height: 40px; border-radius: 10px; cursor: pointer; border: 2px solid transparent; }
        .color-swatch-btn.selected { border-color: var(--text-dark); }
        .color-selected-info { display:flex; align-items:center; gap:8px; margin-top:0.6rem; font-size:0.82rem; color: var(--text-muted); }
        .color-selected-info .sw { width:18px; height:18px; border-radius:5px; }
        .disclaimer-small { font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem; }
        .pattern-gallery { display:grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: 8px; margin-top: 0.5rem; }
        .pattern-option { text-align:center; cursor:pointer; padding: 6px; border-radius: var(--border-radius-sm); border: 2px solid transparent; }
        .pattern-option.selected { border-color: var(--accent); background: var(--accent-soft); }
        .pattern-option img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 10px; }
        .pattern-option span { display:block; font-size: 0.68rem; margin-top: 4px; }
        .image-upload-area { border: 2px dashed var(--border-strong); border-radius: var(--border-radius-sm); padding: 1.5rem;
            text-align: center; cursor: pointer; color: var(--text-muted); }
        .image-preview-container { display:flex; flex-wrap:wrap; gap:8px; margin-top: 0.75rem; }
        .image-preview-wrapper { position:relative; width: 64px; height: 64px; }
        .image-preview { width:100%; height:100%; object-fit:cover; border-radius: 8px; }
        .remove-img-btn { position:absolute; top:-6px; right:-6px; background: var(--danger); color:#fff; border:none;
            width:20px; height:20px; border-radius:50%; cursor:pointer; font-size: 0.7rem; }
        .price-readonly { font-family: var(--font-display); font-size: 1.3rem; font-weight: 700; color: var(--accent-dark); }
```

Agregar en el JS, después de `PANTONERA`:

```javascript
        function addProductItem() {
            productCounter++;
            const id = `prod_${productCounter}`;
            imagesFiles[id] = [];

            const typeOptions = [...new Set(catalog.map(c => c.tipo_producto))]
                .map(t => `<option value="${t}">${t === 'pijama' ? 'Pijamas' : t}</option>`).join('');

            const html = `
                <div class="card product-item" id="${id}">
                    <div class="product-item-header">
                        <strong>Producto <span class="prod-num">${productCounter}</span></strong>
                        <button type="button" class="remove-item-btn" onclick="removeProductItem('${id}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
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
                    <div class="form-group" id="${id}_talla_group" style="display:none;">
                        <label>Talla</label>
                        <div id="${id}_talla_wrap"></div>
                    </div>
                    <div class="form-group" id="${id}_corte_group" style="display:none;">
                        <label>Corte</label>
                        <select id="${id}_corte">
                            <option value="clasico">Clásico</option>
                            <option value="princesa">Princesa</option>
                        </select>
                    </div>
                    <div class="form-group" id="${id}_color_group" style="display:none;">
                        <label>Color</label>
                        <div class="color-familia-grid" id="${id}_color_familias"></div>
                        <div class="color-tono-grid" id="${id}_color_tonos"></div>
                        <div class="color-selected-info" id="${id}_color_info" style="display:none;"></div>
                        <p class="disclaimer-small">Los colores pueden variar ligeramente según la pantalla de tu celular o computadora 📱💻</p>
                        <input type="hidden" id="${id}_color">
                    </div>
                    <div class="form-group" id="${id}_mascota_group" style="display:none;">
                        <label>Nombre de tu mascota</label>
                        <input type="text" id="${id}_mascota">
                    </div>
                    <div class="form-group" id="${id}_ano_group" style="display:none;">
                        <label>Año de nacimiento (opcional)</label>
                        <input type="text" id="${id}_ano">
                    </div>
                    <div class="form-group" id="${id}_raza_group" style="display:none;">
                        <label>Raza o frase (opcional)</label>
                        <input type="text" id="${id}_raza">
                    </div>
                    <div class="form-group" id="${id}_patron_group" style="display:none;">
                        <label>Patrón (elige el diseño)</label>
                        <select id="${id}_tipo_mascota" onchange="renderPatternGallery('${id}')" style="max-width:180px; margin-bottom:8px;">
                            <option value="perro">🐶 Perro</option>
                            <option value="gato">🐱 Gato</option>
                        </select>
                        <input type="hidden" id="${id}_patron">
                        <div class="pattern-gallery" id="${id}_patron_gallery"></div>
                    </div>
                    <div class="form-group">
                        <label>Precio</label>
                        <div class="price-readonly" id="${id}_precio_display">S/ 0.00</div>
                        <input type="hidden" id="${id}_precio" value="0">
                    </div>
                    <div class="form-group">
                        <label>Fotos de tu mascota</label>
                        <p class="disclaimer-small" style="margin-bottom:0.5rem;">El precio incluye hasta 3 fotos por producto 📸 ¿Necesitas subir más? Cada foto adicional (desde la 4ta) tiene un costo extra de S/5.</p>
                        <div class="image-upload-area" id="${id}_upload_area" onclick="document.getElementById('${id}_file_input').click()"
                             ondragover="event.preventDefault(); this.classList.add('dragover')"
                             ondragleave="this.classList.remove('dragover')"
                             ondrop="handleDrop(event, '${id}')">
                            <i class="fa-solid fa-cloud-arrow-up" style="font-size:1.6rem; color: var(--accent); margin-bottom: 6px;"></i>
                            <p>Toca para subir o pega (Ctrl+V) una foto</p>
                            <input type="file" id="${id}_file_input" style="display:none" multiple accept="image/*" onchange="handleFileSelect(event, '${id}')">
                        </div>
                        <div class="image-preview-container" id="${id}_previews"></div>
                    </div>
                    <div class="form-group">
                        <label>Observaciones (opcional)</label>
                        <input type="text" id="${id}_obs" placeholder="Algo que debamos saber sobre este producto">
                    </div>
                </div>
            `;
            document.getElementById('productos-container').insertAdjacentHTML('beforeend', html);

            const area = document.getElementById(`${id}_upload_area`);
            area.addEventListener('click', () => {
                document.querySelectorAll('.image-upload-area').forEach(a => a.style.borderColor = 'var(--border-strong)');
                area.style.borderColor = 'var(--accent-dark)';
                area.dataset.active = 'true';
            });
        }

        function removeProductItem(id) {
            if (!confirm('¿Quitar este producto? Se perderán las fotos que hayas subido para él.')) return;
            document.getElementById(id).remove();
            delete imagesFiles[id];
            calculateTotal();
            document.querySelectorAll('.product-item').forEach((el, idx) => {
                el.querySelector('.prod-num').textContent = idx + 1;
            });
        }
```

- [ ] **Step 3: Agregar `onTipoProductoChange`, `updateVariants`, `updatePrice`, `updateCamposPorTipo`, `updateCorteVisibility`, `renderTallaOptions`**

```javascript
        function onTipoProductoChange(prodId) {
            updateVariants(prodId);
            updateCamposPorTipo(prodId);
        }

        function updateVariants(prodId) {
            const tipo = document.getElementById(`${prodId}_tipo`).value;
            const variantes = catalog.filter(c => c.tipo_producto === tipo);
            const select = document.getElementById(`${prodId}_variante`);
            select.innerHTML = '<option value="">Selecciona...</option>' +
                variantes.map(v => `<option value="${v.variante}" data-price="${v.precio}">${v.variante} (S/ ${v.precio})</option>`).join('');
            document.getElementById(`${prodId}_precio`).value = 0;
            document.getElementById(`${prodId}_precio_display`).textContent = 'S/ 0.00';
            calculateTotal();
        }

        function updatePrice(prodId) {
            const select = document.getElementById(`${prodId}_variante`);
            const option = select.options[select.selectedIndex];
            const precio = option && option.dataset.price ? option.dataset.price : 0;
            document.getElementById(`${prodId}_precio`).value = precio;
            document.getElementById(`${prodId}_precio_display`).textContent = `S/ ${Number(precio).toFixed(2)}`;
            updateCorteVisibility(prodId);
            calculateTotal();
        }

        function updateCorteVisibility(prodId) {
            const tipo = document.getElementById(`${prodId}_tipo`).value;
            const variante = document.getElementById(`${prodId}_variante`).value;
            const grupo = document.getElementById(`${prodId}_corte_group`);
            grupo.style.display = (tipo === 'pijama' && VARIANTES_CON_CORTE.includes(variante)) ? '' : 'none';
        }

        function updateCamposPorTipo(prodId) {
            const tipo = document.getElementById(`${prodId}_tipo`).value;
            const cfg = CAMPOS_POR_TIPO[tipo] || CAMPOS_POR_TIPO['otro'];
            const setVis = (suffix, visible) => {
                const el = document.getElementById(`${prodId}_${suffix}_group`);
                if (el) el.style.display = visible ? '' : 'none';
            };
            setVis('talla', cfg.talla);
            setVis('color', cfg.color);
            setVis('patron', cfg.patron);
            setVis('mascota', cfg.mascota_nombre);
            setVis('ano', cfg.mascota_anio);
            setVis('raza', cfg.mascota_raza);

            if (cfg.talla) renderTallaOptions(prodId, cfg.tallaFija);
            if (cfg.color) renderColorFamilias(prodId);
            if (cfg.patron) renderPatternGallery(prodId);
        }

        function renderTallaOptions(prodId, tallaFija) {
            const wrap = document.getElementById(`${prodId}_talla_wrap`);
            if (tallaFija) {
                wrap.innerHTML = `<div class="chip-grid" id="${prodId}_talla_chips">` +
                    tallaFija.map(t => `<span class="chip-option" onclick="selectTalla('${prodId}', '${t}')">${t}</span>`).join('') +
                    `</div><input type="hidden" id="${prodId}_talla">`;
            } else {
                wrap.innerHTML = `<input type="text" id="${prodId}_talla" placeholder="Ej: S, M, XL">`;
            }
        }

        function selectTalla(prodId, talla) {
            document.getElementById(`${prodId}_talla`).value = talla;
            document.querySelectorAll(`#${prodId}_talla_chips .chip-option`).forEach(el => {
                el.classList.toggle('selected', el.textContent === talla);
            });
        }
```

- [ ] **Step 4: Agregar el selector visual de color**

```javascript
        function renderColorFamilias(prodId) {
            const container = document.getElementById(`${prodId}_color_familias`);
            container.innerHTML = Object.entries(PANTONERA).map(([key, familia]) =>
                `<span class="chip-option" onclick="selectColorFamilia('${prodId}', '${key}')">${familia.nombre}</span>`
            ).join('');
        }

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
        }

        function selectColorTono(prodId, codigo, hex) {
            document.getElementById(`${prodId}_color`).value = codigo;
            document.querySelectorAll(`#${prodId}_color_tonos .color-swatch-btn`).forEach(el => {
                el.classList.toggle('selected', el.title === codigo);
            });
            const info = document.getElementById(`${prodId}_color_info`);
            info.style.display = 'flex';
            info.innerHTML = `<span class="sw" style="background:${hex}"></span> Elegiste ${codigo}`;
        }
```

- [ ] **Step 5: Agregar la galería de patrones (idéntica a `index.html`, adaptada)**

```javascript
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
                </div>
            `).join('');
        }

        function selectPattern(prodId, patternId) {
            const pattern = patterns.find(p => p.id === patternId);
            if (!pattern) return;
            document.getElementById(`${prodId}_patron`).value = pattern.nombre;
            renderPatternGallery(prodId);
        }
```

- [ ] **Step 6: Agregar la subida de fotos (idéntica a `index.html`, sin `existingImages` — siempre es un pedido nuevo)**

```javascript
        function handleFileSelect(event, prodId) {
            addFilesToProduct(event.target.files, prodId);
        }

        function handleDrop(event, prodId) {
            event.preventDefault();
            document.getElementById(`${prodId}_upload_area`).classList.remove('dragover');
            addFilesToProduct(event.dataTransfer.files, prodId);
        }

        function handleGlobalPaste(event) {
            const areas = document.querySelectorAll('.image-upload-area');
            if (areas.length === 0) return;
            let targetProdId = null;
            areas.forEach(a => { if (a.dataset.active === 'true') targetProdId = a.id.replace('_upload_area', ''); });
            if (!targetProdId) targetProdId = areas[0].id.replace('_upload_area', '');

            const items = (event.clipboardData || event.originalEvent.clipboardData).items;
            const files = [];
            for (let item of items) {
                if (item.kind === 'file' && item.type.includes('image/')) files.push(item.getAsFile());
            }
            if (files.length > 0) {
                addFilesToProduct(files, targetProdId);
                showToast('Foto pegada');
            }
        }

        function addFilesToProduct(files, prodId) {
            for (let i = 0; i < files.length; i++) {
                if (files[i].type.startsWith('image/')) imagesFiles[prodId].push(files[i]);
            }
            renderImagePreviews(prodId);
        }

        function renderImagePreviews(prodId) {
            const container = document.getElementById(`${prodId}_previews`);
            container.innerHTML = imagesFiles[prodId].map((f, idx) => `
                <div class="image-preview-wrapper">
                    <img src="${URL.createObjectURL(f)}" class="image-preview">
                    <button type="button" class="remove-img-btn" onclick="removeImage('${prodId}', ${idx})"><i class="fa-solid fa-xmark"></i></button>
                </div>
            `).join('');
        }

        function removeImage(prodId, idx) {
            imagesFiles[prodId].splice(idx, 1);
            renderImagePreviews(prodId);
        }
```

- [ ] **Step 7: Agregar `calculateTotal` y registrar el listener global de paste**

```javascript
        function calculateTotal() {
            let total = 0;
            document.querySelectorAll('input[id$="_precio"]').forEach(input => {
                total += parseFloat(input.value) || 0;
            });
            document.getElementById('total-display').textContent = `S/ ${total.toFixed(2)}`;
        }
```

Modificar el bootstrap para agregar el listener de paste, y para llamar `calculateTotal()` tras
agregar el primer producto:

```javascript
        document.addEventListener('DOMContentLoaded', async () => {
            try {
                await Promise.all([loadCatalog(), loadPatterns()]);
                renderForm();
                calculateTotal();
                document.addEventListener('paste', handleGlobalPaste);
            } catch (error) {
                console.error(error);
                document.getElementById('form-view').innerHTML = `
                    <div class="card" style="text-align:center; color: var(--danger);">
                        <p>No se pudo cargar el formulario. Intenta de nuevo en unos minutos.</p>
                    </div>`;
            }
        });
```

- [ ] **Step 8: Verificar en el navegador**

Recargar `pedido.html`. Probar: elegir tipo "Pijamas" → aparecen variantes reales del catálogo con
precio → elegir una variante "Manga corta + short" → aparece el selector de Corte → elegir Talla
(chips fijos 12/14/S/M/L/XL) → elegir Color (familia → cuadrícula de 10 tonos reales, clic en uno
muestra "Elegiste XXX") → elegir Patrón (galería con imágenes reales) → subir una foto (clic y
pegar Ctrl+V) → el total de arriba se actualiza con el precio de la variante. Probar también tipo
"Polo" (debería pedir mascota/año/raza, sin color ni patrón) y "Tote bag" (sin talla/color/patrón).
"Agregar otro producto" debe agregar una segunda tarjeta funcional igual.

- [ ] **Step 9: Commit**

```bash
git add pedido.html
git commit -m "Agregar seccion de productos al formulario publico (tipo, talla, corte, color visual, patron, fotos)"
```

---

### Task 5: Envío del pedido

**Files:**
- Modify: `pedido.html`

**Interfaces:**
- Consumes: todo lo de las Tasks 2-4 (`catalog`, `imagesFiles`, ids de campos por producto).
- Produces: `enviarPedido()` — valida, sube fotos, inserta `pedidos`+`items_pedido` con
  `origen:'web'`, maneja errores (incluido `NO_LOTE_ACTIVO` de la Task 1), y muestra la pantalla de
  éxito con el código de pedido.

- [ ] **Step 1: Agregar `enviarPedido()` y la pantalla de éxito**

```javascript
        async function enviarPedido() {
            if (enviando) return;

            const clienteNombre = document.getElementById('cliente_nombre').value.trim();
            const clienteContacto = document.getElementById('cliente_contacto').value.trim();
            const canal = document.getElementById('cliente_canal').value;
            const errorEl = document.getElementById('submit-error');
            errorEl.style.display = 'none';

            if (!clienteNombre || !clienteContacto) {
                errorEl.textContent = 'Completa tu nombre y contacto antes de continuar.';
                errorEl.style.display = 'block';
                return;
            }

            const productDivs = document.querySelectorAll('.product-item');
            if (productDivs.length === 0) {
                errorEl.textContent = 'Agrega al menos un producto.';
                errorEl.style.display = 'block';
                return;
            }

            for (const div of productDivs) {
                const prodId = div.id;
                const tipo = document.getElementById(`${prodId}_tipo`).value;
                const variante = document.getElementById(`${prodId}_variante`).value;
                if (!tipo || !variante) {
                    errorEl.textContent = 'Completa el tipo y modelo de todos los productos.';
                    errorEl.style.display = 'block';
                    return;
                }
            }

            enviando = true;
            const btn = document.getElementById('btn-enviar');
            const btnText = document.getElementById('btn-enviar-text');
            const loader = document.getElementById('btn-enviar-loader');
            btn.disabled = true;
            btnText.textContent = 'Enviando...';
            loader.style.display = 'inline-block';

            try {
                const { data: pedidoData, error: pedidoError } = await sb.from('pedidos').insert([{
                    cliente_nombre: clienteNombre,
                    cliente_contacto: clienteContacto,
                    canal: canal,
                    origen: 'web',
                    precio_total: 0,
                    monto_pagado: 0,
                    estado: 'Pendiente'
                }]).select().single();

                if (pedidoError) throw pedidoError;
                const pedidoId = pedidoData.id;

                let i = 0;
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

                const { data: pedidoFinal } = await sb.from('pedidos').select('codigo_pedido').eq('id', pedidoId).single();
                mostrarExito(pedidoFinal ? pedidoFinal.codigo_pedido : null);
            } catch (error) {
                console.error(error);
                btn.disabled = false;
                btnText.textContent = 'Registrar pedido';
                loader.style.display = 'none';
                enviando = false;

                if (error.message && error.message.includes('NO_LOTE_ACTIVO')) {
                    errorEl.textContent = 'Estamos actualizando pedidos, intenta en unos minutos 🙏';
                } else {
                    errorEl.textContent = 'No se pudo registrar tu pedido. Revisa tu conexión e intenta de nuevo — tus datos siguen aquí, no se perdieron.';
                }
                errorEl.style.display = 'block';
            }
        }

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

Nota: no incluye todavía el PDF ni los botones de WhatsApp/Instagram — eso es la Fase 4.

- [ ] **Step 2: Verificar con un pedido de prueba real**

Abrir `pedido.html` local en el Browser tool. Llenar: canal WhatsApp, nombre `ZZZ PRUEBA FASE2 —
BORRAR`, contacto cualquiera, un producto Pijama con variante/talla/corte/color/patrón, subir o
pegar una foto de prueba. Tocar "Registrar pedido". Confirmar: el botón se deshabilita y muestra
"Enviando...", aparece la pantalla de éxito con un código `PF-2608-NNN` real, los 2 mensajes
correctos.

Verificar por REST que el pedido quedó bien armado:

```bash
curl -s "https://zafgoegngcqsswzzxcen.supabase.co/rest/v1/pedidos?cliente_nombre=eq.ZZZ%20PRUEBA%20FASE2%20%E2%80%94%20BORRAR&select=*,items_pedido(*)" \
  -H "apikey: sb_publishable_xmTh0DSBcGFF_0ZBb2ePcQ_Ktv8gKUB" \
  -H "Authorization: Bearer sb_publishable_xmTh0DSBcGFF_0ZBb2ePcQ_Ktv8gKUB"
```

Expected: `[]` (RLS bloquea el `SELECT` para `anon`, incluso para verificar el propio pedido —
comportamiento correcto y esperado). Para verificar el contenido real, pedir al usuario que lo
revise logueado en `index.html` (por ahora en el grid de "Lote Activo" normal, ya que la cola de
revisión separada es la Fase 3) o consultarlo usando sus credenciales desde la consola, igual que
se hizo en la Fase 1. Confirmar: `estado='Por confirmar'`, `origen='web'`, `codigo_pedido` con
formato correcto, `precio_unitario`/`precio_total` coinciden con el catálogo real (no lo que se
mandó, aunque en este caso el formulario ya manda el precio correcto — la garantía real es del
trigger).

- [ ] **Step 3: Borrar el pedido de prueba**

Pedir al usuario que lo elimine (logueado, desde `index.html`, buscándolo en "Buscar Pedidos" o en
el grid si ya lo ve) y confirmar después que ya no existe.

- [ ] **Step 4: Commit**

```bash
git add pedido.html
git commit -m "Agregar envio del pedido publico: validacion, guardado, manejo de errores y pantalla de exito"
```

---

### Task 6: Verificación final de Fase 2 y actualización de `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Checklist manual completo**

- Probar en viewport móvil (el dispositivo real de la mayoría de clientes).
- Confirmar que tocar "Registrar pedido" dos veces rápido no crea 2 pedidos (botón se deshabilita al
  primer clic).
- Confirmar que un producto tipo Manta no pide talla ni corte, pero sí color y patrón.
- Confirmar que un producto tipo Tote bag no pide color/patrón/talla, pero sí mascota/año/raza.
- Revisar la consola del navegador en todo el flujo — sin errores.

- [ ] **Step 2: Actualizar `CLAUDE.md`**

Agregar entrada en `## Progreso`: `pedido.html` construido (Fase 2 de 4), con su contenido completo
(secciones, selector visual de color, galería de patrones, subida de fotos, envío con manejo de
errores). Agregar `pedido.html` a la sección `## Stack` como el formulario público. Mencionar que
faltan las Fases 3 (cola de revisión en `index.html`) y 4 (PDF + WhatsApp/Instagram).

- [ ] **Step 3: Commit y confirmar despliegue**

```bash
git add CLAUDE.md
git commit -m "Actualizar CLAUDE.md: pedido.html construido (Fase 2 formulario publico)"
```

Antes de pushear, confirmar con el usuario que quiere desplegar `pedido.html` a producción ahora —
a partir de ese momento, cualquiera con el link puede usarlo (aunque los pedidos quedan en "Por
confirmar" y no afectan nada hasta que él los revise, así que el riesgo real es bajo, pero igual es
la primera vez que ese archivo queda público).
