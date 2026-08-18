# Formulario Público — Fase 1: Esquema, Login y RLS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poner la base de seguridad necesaria antes de construir `pedido.html`: columnas nuevas,
trigger de código+precio, login real para `index.html`, y RLS activada en todas las tablas.

**Architecture:** Cambios de esquema/RLS/trigger van vía SQL que el usuario corre en el SQL Editor
de Supabase (sin acceso DDL directo por REST). El login es una pantalla nueva dentro de `index.html`
que gatea el resto de la app hasta que haya sesión activa. No se toca `pedido.html` todavía (es la
Fase 2) — esta fase deja la base lista para que ese archivo pueda insertar de forma segura.

**Tech Stack:** Supabase (Postgres RLS + Auth), `@supabase/supabase-js@2`, HTML/CSS/JS vanilla.

## Global Constraints

- Spec completo: [docs/superpowers/specs/2026-08-18-formulario-publico-design.md](../specs/2026-08-18-formulario-publico-design.md).
- No hay acceso DDL directo — todo cambio de esquema/RLS/trigger se le da al usuario como SQL para
  correr en el SQL Editor de Supabase, nunca se ejecuta solo.
- No hay framework de tests — verificación manual vía `curl`/REST y el navegador, contra el
  Supabase real.
- 2 cuentas fijas de Supabase Auth (Cesar, Mariana), creadas a mano por el usuario en el dashboard
  — sin registro público ni recuperación de contraseña self-service en esta fase.
- El comportamiento actual de `index.html` para usuarios autenticados no debe cambiar en nada más
  que requerir login primero — ninguna otra funcionalidad se toca.
- Si se crean datos de prueba, deben quedar identificados (ej. `ZZZ PRUEBA...`) y borrarse al final,
  confirmando después que no quedó nada.

---

### Task 1: Esquema — `origen`, `codigo_pedido`, nuevo estado

**Files:**
- Ninguno en el repo (cambio de esquema en Supabase)

**Interfaces:**
- Produces: `pedidos.origen` (text, default `'interno'`), `pedidos.codigo_pedido` (text, único),
  `pedidos.estado` acepta ahora también `'Por confirmar'`. Usado por Task 2 (trigger) y por la Fase
  2 (formulario público).

- [ ] **Step 1: Dar el SQL al usuario**

```sql
ALTER TABLE pedidos ADD COLUMN origen text NOT NULL DEFAULT 'interno'
  CHECK (origen IN ('interno', 'web'));
ALTER TABLE pedidos ADD COLUMN codigo_pedido text UNIQUE;

ALTER TABLE pedidos DROP CONSTRAINT pedidos_estado_check;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_estado_check
  CHECK (estado IN ('Por confirmar', 'Pendiente', 'Diseño enviado', 'En producción', 'Listo', 'Entregado'));
```

Esperar confirmación del usuario de que lo corrió.

- [ ] **Step 2: Verificar por REST**

```bash
curl -s "https://zafgoegngcqsswzzxcen.supabase.co/rest/v1/pedidos?select=origen,codigo_pedido&limit=1" \
  -H "apikey: sb_publishable_xmTh0DSBcGFF_0ZBb2ePcQ_Ktv8gKUB" \
  -H "Authorization: Bearer sb_publishable_xmTh0DSBcGFF_0ZBb2ePcQ_Ktv8gKUB"
```

Expected: fila con `"origen":"interno"` en pedidos existentes, sin error de columna inexistente.

- [ ] **Step 3: Commit**

No hay archivos que commitear (cambio solo en Supabase). Continuar a Task 2.

---

### Task 2: Trigger — código de pedido + precio blindado

**Files:**
- Ninguno en el repo (trigger en Supabase)

**Interfaces:**
- Consumes: `pedidos.origen` (Task 1), `catalogo_productos.precio` (ya existente).
- Produces: al insertar un pedido con `origen='web'`, se llenan solos `codigo_pedido`
  (`PF-YYMM-NNN`), `estado='Por confirmar'`, `monto_pagado=0`, `estado_pago='Pendiente'`. Al
  insertar cada `items_pedido` de un pedido `web`, `precio_unitario` se sobreescribe con el precio
  real del catálogo, y `pedidos.precio_total` se recalcula como la suma de sus productos.

- [ ] **Step 1: Dar el SQL al usuario**

```sql
CREATE SEQUENCE IF NOT EXISTS pedido_codigo_seq;

CREATE OR REPLACE FUNCTION preparar_pedido_web()
RETURNS trigger AS $$
BEGIN
  IF NEW.origen = 'web' THEN
    NEW.codigo_pedido := 'PF-' || to_char(now(), 'YYMM') || '-' ||
      lpad(nextval('pedido_codigo_seq')::text, 3, '0');
    NEW.estado := 'Por confirmar';
    NEW.monto_pagado := 0;
    NEW.estado_pago := 'Pendiente';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_preparar_pedido_web
BEFORE INSERT ON pedidos
FOR EACH ROW EXECUTE FUNCTION preparar_pedido_web();

CREATE OR REPLACE FUNCTION recalcular_precio_item_web()
RETURNS trigger AS $$
DECLARE
  precio_real numeric;
  es_web boolean;
BEGIN
  SELECT (origen = 'web') INTO es_web FROM pedidos WHERE id = NEW.pedido_id;
  IF es_web THEN
    SELECT precio INTO precio_real FROM catalogo_productos
      WHERE tipo_producto = NEW.tipo_producto AND variante = NEW.variante AND activo = true;
    IF precio_real IS NOT NULL THEN
      NEW.precio_unitario := precio_real;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recalcular_precio_item_web
BEFORE INSERT ON items_pedido
FOR EACH ROW EXECUTE FUNCTION recalcular_precio_item_web();

CREATE OR REPLACE FUNCTION recalcular_total_pedido_web()
RETURNS trigger AS $$
BEGIN
  UPDATE pedidos SET precio_total = (
    SELECT COALESCE(SUM(precio_unitario), 0) FROM items_pedido WHERE pedido_id = NEW.pedido_id
  ) WHERE id = NEW.pedido_id AND origen = 'web';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recalcular_total_pedido_web
AFTER INSERT ON items_pedido
FOR EACH ROW EXECUTE FUNCTION recalcular_total_pedido_web();
```

Esperar confirmación de que lo corrió.

- [ ] **Step 2: Guardar copia de referencia en el repo**

Crear `supabase-sql/2026-08-18-formulario-publico-schema.sql` con el contenido completo de los
Steps 1 de las Tasks 1 y 2 juntos (el `ALTER TABLE` de Task 1 + este trigger), como referencia — el
mismo patrón que ya existe para `supabase-functions/send-push/index.ts`: el deploy real vive en
Supabase, esto es solo copia de respaldo en el repo.

- [ ] **Step 3: Probar el trigger con un insert real (simulando origen web)**

```bash
LOTE_JSON=$(curl -s "https://zafgoegngcqsswzzxcen.supabase.co/rest/v1/lotes?select=id&activo=eq.true&limit=1" \
  -H "apikey: sb_publishable_xmTh0DSBcGFF_0ZBb2ePcQ_Ktv8gKUB" \
  -H "Authorization: Bearer sb_publishable_xmTh0DSBcGFF_0ZBb2ePcQ_Ktv8gKUB")
LOTE_ID=$(echo "$LOTE_JSON" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')

# Primero necesita un tipo_producto+variante real del catalogo — usar uno que exista, ej "pijama" / "Manga corta + short" (precio 95)
PEDIDO=$(curl -s -X POST "https://zafgoegngcqsswzzxcen.supabase.co/rest/v1/pedidos" \
  -H "apikey: sb_publishable_xmTh0DSBcGFF_0ZBb2ePcQ_Ktv8gKUB" \
  -H "Authorization: Bearer sb_publishable_xmTh0DSBcGFF_0ZBb2ePcQ_Ktv8gKUB" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d "{\"lote_id\":\"$LOTE_ID\",\"cliente_nombre\":\"ZZZ PRUEBA TRIGGER BORRAR\",\"canal\":\"otro\",\"origen\":\"web\",\"precio_total\":999,\"monto_pagado\":500,\"estado\":\"Pendiente\"}")
echo "$PEDIDO"
# Verificar en la respuesta: codigo_pedido con formato PF-YYMM-NNN, estado="Por confirmar", monto_pagado=0
# (a pesar de haber mandado 999/500/Pendiente en el insert)

PEDIDO_ID=$(echo "$PEDIDO" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')

ITEM=$(curl -s -X POST "https://zafgoegngcqsswzzxcen.supabase.co/rest/v1/items_pedido" \
  -H "apikey: sb_publishable_xmTh0DSBcGFF_0ZBb2ePcQ_Ktv8gKUB" \
  -H "Authorization: Bearer sb_publishable_xmTh0DSBcGFF_0ZBb2ePcQ_Ktv8gKUB" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d "{\"pedido_id\":\"$PEDIDO_ID\",\"tipo_producto\":\"pijama\",\"variante\":\"Manga corta + short\",\"precio_unitario\":1}")
echo "$ITEM"
# Verificar: precio_unitario en la respuesta debe ser 95 (el real del catalogo), no 1 (lo que se mando)

curl -s "https://zafgoegngcqsswzzxcen.supabase.co/rest/v1/pedidos?id=eq.$PEDIDO_ID&select=precio_total" \
  -H "apikey: sb_publishable_xmTh0DSBcGFF_0ZBb2ePcQ_Ktv8gKUB" \
  -H "Authorization: Bearer sb_publishable_xmTh0DSBcGFF_0ZBb2ePcQ_Ktv8gKUB"
# Verificar: precio_total ahora es 95 (recalculado), no 999

# Limpieza
curl -s -X DELETE "https://zafgoegngcqsswzzxcen.supabase.co/rest/v1/pedidos?id=eq.$PEDIDO_ID" \
  -H "apikey: sb_publishable_xmTh0DSBcGFF_0ZBb2ePcQ_Ktv8gKUB" \
  -H "Authorization: Bearer sb_publishable_xmTh0DSBcGFF_0ZBb2ePcQ_Ktv8gKUB"
```

Expected: `codigo_pedido` con formato `PF-2608-NNN`, `estado="Por confirmar"`, `monto_pagado=0`,
`precio_unitario` del item = 95 (no el 1 enviado), `precio_total` del pedido = 95 (no el 999
enviado). Confirmar que el DELETE final dejó todo limpio (repetir el primer GET, debe dar `[]`).

- [ ] **Step 4: Commit**

```bash
git add supabase-sql/2026-08-18-formulario-publico-schema.sql
git commit -m "Agregar SQL de referencia: esquema y trigger del formulario publico"
```

---

### Task 3: Supabase Auth — cuentas + RLS activada

**Files:**
- Ninguno en el repo (Auth + RLS en Supabase)

**Interfaces:**
- Produces: 2 usuarios en Supabase Auth (Cesar, Mariana). RLS activada en las 9 tablas del
  proyecto, con políticas para `anon` (mínimas) y `authenticated` (acceso total, igual que hoy).
  Usado por Task 5 (login screen) y por toda la Fase 2.

- [ ] **Step 1: Pedir al usuario que cree las 2 cuentas**

Instrucciones para el usuario (no ejecutable por el asistente): Supabase Dashboard →
Authentication → Users → "Add user" → crear una cuenta para Cesar (`cesartamayo660@gmail.com`) y
otra para Mariana (el correo que el usuario decida), ambas con "Auto Confirm User" activado (para
no depender de un correo de verificación). Anotar las contraseñas elegidas.

- [ ] **Step 2: Dar el SQL de RLS al usuario**

```sql
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogo_productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE patrones ENABLE ROW LEVEL SECURITY;
ALTER TABLE recetas_materiales ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos_lote ENABLE ROW LEVEL SECURITY;
ALTER TABLE caja_ajustes ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- pedidos / items_pedido: anon solo inserta (formulario publico), authenticated todo
CREATE POLICY "anon_insert_pedidos" ON pedidos FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "authenticated_all_pedidos" ON pedidos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "anon_insert_items" ON items_pedido FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "authenticated_all_items" ON items_pedido FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- catalogo_productos / patrones: anon solo lee, authenticated todo
CREATE POLICY "anon_select_catalogo" ON catalogo_productos FOR SELECT TO anon USING (true);
CREATE POLICY "authenticated_all_catalogo" ON catalogo_productos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "anon_select_patrones" ON patrones FOR SELECT TO anon USING (true);
CREATE POLICY "authenticated_all_patrones" ON patrones FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tablas 100% internas: nada para anon, todo para authenticated
CREATE POLICY "authenticated_all_recetas" ON recetas_materiales FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_lotes" ON lotes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_gastos" ON gastos_lote FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_caja" ON caja_ajustes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_push" ON push_subscriptions FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

Esperar confirmación de que lo corrió.

- [ ] **Step 3: Verificar que las cuentas existen y que RLS bloquea `recetas_materiales` para anon**

```bash
curl -s "https://zafgoegngcqsswzzxcen.supabase.co/rest/v1/recetas_materiales?select=*&limit=1" \
  -H "apikey: sb_publishable_xmTh0DSBcGFF_0ZBb2ePcQ_Ktv8gKUB" \
  -H "Authorization: Bearer sb_publishable_xmTh0DSBcGFF_0ZBb2ePcQ_Ktv8gKUB"
```

Expected: `[]` (vacío — RLS bloquea, no un error de conexión). **Este comando ahora romperá el
`index.html` actual (que todavía no tiene login)** — es esperado en este punto del plan, se arregla
en la Task 5. No avanzar a probar la app interna hasta completar esa tarea. **Importante**: esto
corre contra el Supabase de producción (no hay entorno de staging en este proyecto) — Tasks 3, 4 y 5
deben ejecutarse seguidas, en una sola sesión de trabajo, para minimizar el tiempo que la app
interna real queda inutilizable para Cesar/Mariana.

- [ ] **Step 4: Commit**

Sin archivos que commitear. Continuar a Task 4.

---

### Task 4: Storage — políticas del bucket `fotos-pedidos`

**Files:**
- Ninguno en el repo (políticas de Storage en Supabase)

**Interfaces:**
- Produces: `anon` puede subir fotos (`INSERT`) pero no puede listar el bucket (`SELECT` en
  `storage.objects` bloqueado para `anon`). `authenticated` mantiene acceso total.

- [ ] **Step 1: Dar el SQL al usuario**

```sql
CREATE POLICY "anon_insert_fotos" ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'fotos-pedidos');

CREATE POLICY "authenticated_all_storage" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'fotos-pedidos') WITH CHECK (bucket_id = 'fotos-pedidos');
```

Nota para el usuario: si ya existían políticas públicas de `SELECT`/`UPDATE` en `storage.objects`
de la configuración original del bucket, hay que revisarlas en Dashboard → Storage → Policies y
borrar cualquiera que permita `SELECT` (listar) a `anon` — el SQL de arriba agrega las políticas
nuevas pero no borra las viejas automáticamente.

- [ ] **Step 2: Verificar que el listado ahora falla, y que las fotos existentes se siguen viendo**

```bash
echo "--- Listado (debe fallar) ---"
curl -s -w "\nHTTP:%{http_code}" -X POST "https://zafgoegngcqsswzzxcen.supabase.co/storage/v1/object/list/fotos-pedidos" \
  -H "apikey: sb_publishable_xmTh0DSBcGFF_0ZBb2ePcQ_Ktv8gKUB" \
  -H "Authorization: Bearer sb_publishable_xmTh0DSBcGFF_0ZBb2ePcQ_Ktv8gKUB" \
  -H "Content-Type: application/json" -d '{"prefix":"","limit":5}'

echo "--- Foto existente conocida (debe seguir funcionando) ---"
# Tomar una URL real de fotos-pedidos de algun pedido existente (ej. desde el resumen de un pedido en la app)
# y confirmar que sigue cargando con un GET normal (200), sin necesitar la key.
```

Expected: el `POST /object/list/...` devuelve error/vacío distinto al listado completo de antes
(antes devolvía los nombres de carpeta reales). Una URL pública conocida de una foto ya subida
sigue devolviendo `200` y la imagen (el bucket es público para `GET` directo, eso no cambia — solo
se bloquea el listado).

- [ ] **Step 3: Commit**

Sin archivos que commitear. Continuar a Task 5.

---

### Task 5: Login screen en `index.html`

**Files:**
- Modify: `index.html` (agregar pantalla de login, gatear el bootstrap, agregar logout)

**Interfaces:**
- Consumes: `sb.auth.signInWithPassword`, `sb.auth.getSession`, `sb.auth.signOut` (API de
  `supabase-js@2`, ya cargado).
- Produces: la app completa (`.sidebar` + `.main-content`) queda oculta hasta que exista sesión
  activa; un botón "Cerrar sesión" nuevo en el sidebar.

- [ ] **Step 1: Agregar el HTML de la pantalla de login**

Ubicar en `index.html`, justo después de `<body>` (línea 1929) y antes de `<!-- Sidebar -->`:

```html
    <!-- Login Screen -->
    <div id="login-screen" class="login-screen">
        <div class="login-card">
            <img src="/logo-icon.png" alt="Peludos Factory" class="login-logo">
            <h1>Peludos Factory</h1>
            <p class="login-subtitle">Ingresa para continuar</p>
            <form id="login-form" onsubmit="return false;">
                <div class="form-group">
                    <label>Correo</label>
                    <input type="email" id="login-email" required autocomplete="username">
                </div>
                <div class="form-group">
                    <label>Contraseña</label>
                    <input type="password" id="login-password" required autocomplete="current-password">
                </div>
                <p id="login-error" class="login-error" style="display:none;"></p>
                <button class="btn" id="btn-login" onclick="iniciarSesion()" style="width:100%;">
                    <span id="login-text">Ingresar</span>
                    <div class="loader" id="login-loader" style="display:none;"></div>
                </button>
            </form>
        </div>
    </div>
```

- [ ] **Step 2: Agregar el CSS de la pantalla de login**

Ubicar el cierre del bloque `<style>` (buscar `</style>` antes de `</head>`) y agregar justo antes:

```css
        .login-screen {
            position: fixed; inset: 0; background: var(--bg);
            display: flex; align-items: center; justify-content: center;
            z-index: 1000;
        }
        .login-card {
            background: var(--card-bg); border-radius: var(--border-radius);
            box-shadow: var(--shadow-lifted); padding: 2.5rem 2rem; width: 100%; max-width: 340px;
            text-align: center;
        }
        .login-logo { width: 64px; height: 64px; border-radius: 12px; margin-bottom: 1rem; object-fit: contain; }
        .login-card h1 { font-family: var(--font-display); font-size: 1.4rem; margin-bottom: 0.25rem; }
        .login-subtitle { color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1.5rem; }
        .login-card .form-group { text-align: left; margin-bottom: 1rem; }
        .login-error { color: var(--danger); font-size: 0.8rem; margin-bottom: 1rem; }
```

- [ ] **Step 3: Agregar la lógica de login/logout y gatear el bootstrap**

Ubicar en `index.html` el bootstrap actual:

```javascript
        document.addEventListener('DOMContentLoaded', async () => {
            try {
                await Promise.all([
                    loadCatalog(),
                    loadPatterns(),
                    loadLotes(),
                    loadRecetas()
                ]);
                navigateTo('dashboard');

                // Global paste event listener for handling image pasting
                document.addEventListener('paste', handleGlobalPaste);

                actualizarBotonNotificaciones();

                // Marca el formulario de pedido como "con cambios sin guardar" ante cualquier
                // edicion real del usuario (no se dispara al poblar el formulario via JS)
                const orderFormEl = document.getElementById('order-form');
                orderFormEl.addEventListener('input', () => { formDirty = true; });
                orderFormEl.addEventListener('change', () => { formDirty = true; });
                setupObservadorTotalFlotante();
            } catch (error) {
                console.error('Initialization error:', error);
                document.body.innerHTML = `<div style="padding: 3rem; text-align: center; color: var(--danger); width: 100%;">
                    <h2>Error de Conexión</h2>
                    <p>No se pudo conectar a la base de datos o cargar los datos iniciales. Verifica tu conexión o configuración de Supabase.</p>
                    <p>Detalle: ${error.message || 'Error desconocido'}</p>
                </div>`;
            }
        });
```

Reemplazarlo completo por:

```javascript
        async function iniciarSesion() {
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            const btn = document.getElementById('btn-login');
            const loginText = document.getElementById('login-text');
            const loader = document.getElementById('login-loader');
            const errorEl = document.getElementById('login-error');
            errorEl.style.display = 'none';

            btn.disabled = true;
            loginText.style.display = 'none';
            loader.style.display = 'inline-block';

            const { error } = await sb.auth.signInWithPassword({ email, password });

            btn.disabled = false;
            loginText.style.display = '';
            loader.style.display = 'none';

            if (error) {
                errorEl.textContent = 'Correo o contraseña incorrectos.';
                errorEl.style.display = 'block';
                return;
            }
            await mostrarApp();
        }

        async function cerrarSesion() {
            if (!confirm('¿Cerrar sesión?')) return;
            await sb.auth.signOut();
            document.getElementById('login-screen').style.display = 'flex';
            document.querySelector('.sidebar').style.display = 'none';
            document.querySelector('.main-content').style.display = 'none';
        }

        async function mostrarApp() {
            document.getElementById('login-screen').style.display = 'none';
            document.querySelector('.sidebar').style.display = '';
            document.querySelector('.main-content').style.display = '';

            try {
                await Promise.all([
                    loadCatalog(),
                    loadPatterns(),
                    loadLotes(),
                    loadRecetas()
                ]);
                navigateTo('dashboard');

                document.addEventListener('paste', handleGlobalPaste);
                actualizarBotonNotificaciones();

                const orderFormEl = document.getElementById('order-form');
                orderFormEl.addEventListener('input', () => { formDirty = true; });
                orderFormEl.addEventListener('change', () => { formDirty = true; });
                setupObservadorTotalFlotante();
            } catch (error) {
                console.error('Initialization error:', error);
                document.body.innerHTML = `<div style="padding: 3rem; text-align: center; color: var(--danger); width: 100%;">
                    <h2>Error de Conexión</h2>
                    <p>No se pudo conectar a la base de datos o cargar los datos iniciales. Verifica tu conexión o configuración de Supabase.</p>
                    <p>Detalle: ${error.message || 'Error desconocido'}</p>
                </div>`;
            }
        }

        document.addEventListener('DOMContentLoaded', async () => {
            document.querySelector('.sidebar').style.display = 'none';
            document.querySelector('.main-content').style.display = 'none';

            const { data: { session } } = await sb.auth.getSession();
            if (session) {
                await mostrarApp();
            } else {
                document.getElementById('login-screen').style.display = 'flex';
            }
        });
```

- [ ] **Step 4: Agregar el botón de "Cerrar sesión" en el sidebar**

Ubicar en `index.html`:

```html
        <div class="sidebar-bottom">
            <button class="btn btn-secondary sidebar-notif-btn" id="btn-notificaciones" onclick="activarNotificaciones()"><i class="fa-solid fa-bell"></i> <span class="logo-text" id="btn-notificaciones-text">Activar notificaciones</span></button>
            <button class="btn sidebar-cta" onclick="crearNuevoPedido()"><i class="fa-solid fa-plus"></i> <span class="logo-text">Nuevo Pedido</span></button>
        </div>
```

Reemplazar por (agrega el botón de cerrar sesión arriba del de notificaciones):

```html
        <div class="sidebar-bottom">
            <button class="btn btn-secondary sidebar-notif-btn" onclick="cerrarSesion()"><i class="fa-solid fa-right-from-bracket"></i> <span class="logo-text">Cerrar sesión</span></button>
            <button class="btn btn-secondary sidebar-notif-btn" id="btn-notificaciones" onclick="activarNotificaciones()"><i class="fa-solid fa-bell"></i> <span class="logo-text" id="btn-notificaciones-text">Activar notificaciones</span></button>
            <button class="btn sidebar-cta" onclick="crearNuevoPedido()"><i class="fa-solid fa-plus"></i> <span class="logo-text">Nuevo Pedido</span></button>
        </div>
```

- [ ] **Step 5: Verificar en el navegador**

Abrir `index.html` local. Confirmar: (1) sin sesión, se ve solo la pantalla de login, nada del
sidebar/dashboard; (2) con credenciales incorrectas, muestra "Correo o contraseña incorrectos" sin
romper nada; (3) con las credenciales reales de Cesar (creadas en Task 3), entra y la app funciona
exactamente igual que antes (Dashboard, Lote Activo, crear/editar pedidos, etc.); (4) "Cerrar
sesión" vuelve a la pantalla de login; (5) recargar la página estando logueado NO vuelve a pedir
login (sesión persistida).

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "Agregar login real a la app interna (Supabase Auth)"
```

---

### Task 6: Verificación final de Fase 1 y actualización de `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Repetir el procedimiento de prueba de seguridad completo**

```bash
echo "--- recetas_materiales (debe fallar/vacio para anon) ---"
curl -s "https://zafgoegngcqsswzzxcen.supabase.co/rest/v1/recetas_materiales?select=*&limit=1" \
  -H "apikey: sb_publishable_xmTh0DSBcGFF_0ZBb2ePcQ_Ktv8gKUB" \
  -H "Authorization: Bearer sb_publishable_xmTh0DSBcGFF_0ZBb2ePcQ_Ktv8gKUB"

echo "--- catalogo_productos (debe funcionar, es publico) ---"
curl -s "https://zafgoegngcqsswzzxcen.supabase.co/rest/v1/catalogo_productos?select=*&limit=1" \
  -H "apikey: sb_publishable_xmTh0DSBcGFF_0ZBb2ePcQ_Ktv8gKUB" \
  -H "Authorization: Bearer sb_publishable_xmTh0DSBcGFF_0ZBb2ePcQ_Ktv8gKUB"

echo "--- lotes (debe fallar/vacio para anon) ---"
curl -s "https://zafgoegngcqsswzzxcen.supabase.co/rest/v1/lotes?select=*&limit=1" \
  -H "apikey: sb_publishable_xmTh0DSBcGFF_0ZBb2ePcQ_Ktv8gKUB" \
  -H "Authorization: Bearer sb_publishable_xmTh0DSBcGFF_0ZBb2ePcQ_Ktv8gKUB"
```

Expected: `recetas_materiales` y `lotes` devuelven `[]`, `catalogo_productos` devuelve datos reales.

- [ ] **Step 2: Verificar la app interna completa, logueado, en el navegador**

Recorrer al menos: Dashboard carga bien, Lote Activo muestra las tarjetas, crear un pedido de
prueba y borrarlo, Patrones carga, Gastos carga. Confirmar que nada quedó roto por RLS.

- [ ] **Step 3: Actualizar `CLAUDE.md`**

Cambiar la primera línea del documento (hoy dice "App interna (sin login)") para reflejar que ahora
sí tiene login, y agregar una entrada en `## Progreso` describiendo: login real con Supabase Auth,
RLS activada en todas las tablas, columnas `origen`/`codigo_pedido`, trigger de código+precio para
pedidos `web`. Mencionar que esta es la Fase 1 de 4 del formulario público (spec en
`docs/superpowers/specs/2026-08-18-formulario-publico-design.md`).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "Actualizar CLAUDE.md: login real y RLS activada (Fase 1 formulario publico)"
```

- [ ] **Step 5: Confirmar despliegue con el usuario antes de push**

Antes de pushear, preguntar explícitamente si quiere desplegar ahora — a partir de este push,
`index.html` en producción pedirá login, así que Cesar y Mariana deben tener sus credenciales listas
antes de que se despliegue.
