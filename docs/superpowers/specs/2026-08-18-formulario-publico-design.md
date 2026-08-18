# Formulario público de auto-registro de pedidos

**Fecha**: 2026-08-18
**Estado**: Aprobado, pendiente de plan de implementación

## Contexto

Hoy todos los pedidos se registran a mano por Cesar/Mariana desde el formulario interno
(`index.html`), transcribiendo lo que el cliente escribe por Instagram/WhatsApp/TikTok. Se agrega
un canal adicional: un formulario público (`pedido.html`) donde el cliente arma su propio pedido,
recibe un PDF de resumen, y el pedido cae en la plataforma interna para revisión antes de contar
en producción real.

El formulario interno **no cambia su comportamiento actual** salvo lo estrictamente necesario para
soportar la cola de revisión (nuevo estado `Por confirmar` y su exclusión de los cálculos).

## 1. Arquitectura — archivo separado

`pedido.html` nuevo, en la raíz del repo junto a `index.html`. Contiene únicamente: el formulario,
la lógica de guardado contra Supabase, y la generación del PDF. No importa ni referencia nada del
dashboard, costos, márgenes, ni gestión de lotes — así es físicamente imposible que ese código
llegue al navegador del cliente, sin importar qué tan bien se ofusque `index.html`.

Comparte con `index.html` (duplicado, no importado — son archivos independientes): la constante
`PANTONERA`, la lógica de `CAMPOS_POR_TIPO` para mostrar/ocultar campos por tipo de producto, y el
mismo cliente de Supabase (`@supabase/supabase-js@2` vía CDN, mismas `SUPABASE_URL`/`SUPABASE_KEY`
públicas).

## 2. Esquema de base de datos

```sql
-- pedidos: origen del pedido y codigo legible
ALTER TABLE pedidos ADD COLUMN origen text NOT NULL DEFAULT 'interno'
  CHECK (origen IN ('interno', 'web'));
ALTER TABLE pedidos ADD COLUMN codigo_pedido text UNIQUE;

-- pedidos: nuevo estado de la cola de revision
ALTER TABLE pedidos DROP CONSTRAINT pedidos_estado_check;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_estado_check
  CHECK (estado IN ('Por confirmar', 'Pendiente', 'Diseño enviado', 'En producción', 'Listo', 'Entregado'));
```

No hay cambios en `items_pedido` — ya tiene `fotos`, `color`, `patron`, `corte`, `orden`, todo lo
que necesita el formulario público. `fecha_entrega` en `pedidos` ya acepta `NULL` (verificado en
vivo, sin `NOT NULL` a nivel de tabla — el `required` de hoy es solo del `<input>` del formulario
interno), así que los pedidos web la dejan vacía hasta que Cesar la defina al confirmar.

## 3. Trigger de Postgres — código de pedido + precio blindado

Un solo trigger, activo solo para `origen = 'web'` (los pedidos internos no lo tocan):

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

Efecto: sin importar qué mande el navegador del cliente en `precio_unitario`/`precio_total`, al
terminar el guardado esos valores reflejan el catálogo real. El código `PF-YYMM-NNN` es atómico vía
`sequence` de Postgres — no hay condición de carrera aunque lleguen 2 pedidos al mismo segundo.

## 4. Seguridad — Autenticación + RLS + Storage

**Cambio de fondo**: RLS por sí sola no puede distinguir "esto lo pidió `index.html`" de "esto lo
pidió `pedido.html`" — ambos usarían la misma `anon key` pública. Para que las tablas sensibles
(`recetas_materiales`, costos, `lotes`, `gastos_lote`, `caja_ajustes`) queden **realmente**
bloqueadas para el público y no solo "escondidas", la app interna necesita login real. La app deja
de ser "sin login" (se actualiza esa descripción en `CLAUDE.md` al implementar).

**Autenticación** (Supabase Auth, email + contraseña):
- 2 cuentas fijas, creadas a mano por Cesar en el dashboard de Supabase (Authentication → Users) —
  no hay registro público ni recuperación de contraseña self-service en esta primera versión.
- `index.html` gana una pantalla de login simple (email + password) que se muestra si no hay sesión
  activa (`supabase.auth.getSession()`); el resto de la app queda oculta hasta iniciar sesión.
- Sesión persistente vía el manejo de sesión propio de `supabase-js` (localStorage), para no pedir
  login cada vez que se abre la PWA.
- `pedido.html` **no** usa autenticación — sigue siendo 100% anónimo para el cliente público.

**RLS por tabla** (ahora sí distinguible con `anon` vs `authenticated`):

| Tabla | `anon` INSERT | `anon` SELECT | `authenticated` (Cesar/Mariana) |
|---|---|---|---|
| `pedidos` | ✅ (formulario público) | ❌ | Todo permitido |
| `items_pedido` | ✅ (formulario público) | ❌ | Todo permitido |
| `catalogo_productos` | ❌ | ✅ (precios visibles en el form público) | Todo permitido |
| `patrones` | ❌ | ✅ (galería de patrones en el form público) | Todo permitido |
| `recetas_materiales`, `lotes`, `gastos_lote`, `caja_ajustes`, `push_subscriptions` | ❌ | ❌ | Todo permitido |

Con login real, `pedidos`/`items_pedido` también quedan sin `SELECT` para `anon` — ni el propio
cliente puede releer su pedido después de enviarlo (coincide con el pedido original: "el cliente
inserta y no puede leer nada de vuelta, ni siquiera su propio pedido").

**Storage** (`fotos-pedidos`): política de `INSERT` permitida para `anon`, política de listado
(`SELECT` sobre `storage.objects`) **bloqueada** para `anon` — hoy cualquiera puede listar el bucket
completo (verificado en vivo). Se agrega validación de tipo (`image/*`) y tamaño máximo (5MB) en la
política de `INSERT`.

**Procedimiento de prueba** (a correr desde la consola del navegador, sin login, con la `anon key`
pública, contra tablas que deben rebotar):

```js
// Debe fallar (RLS bloquea SELECT para anon)
await fetch('https://zafgoegngcqsswzzxcen.supabase.co/rest/v1/recetas_materiales?select=*',
  { headers: { apikey: 'sb_publishable_...', Authorization: 'Bearer sb_publishable_...' }})
  .then(r => r.json()); // Esperado: [] o error de política, NUNCA datos reales

// Debe fallar (listado de bucket bloqueado)
await fetch('https://zafgoegngcqsswzzxcen.supabase.co/storage/v1/object/list/fotos-pedidos',
  { method: 'POST', headers: {...}, body: JSON.stringify({prefix:''}) }); // Esperado: 403/error

// Debe funcionar (insert de pedido publico)
// Debe fallar (select de pedidos desde pedido.html, si se probara ahi)
```

Se entrega la lista completa y exacta de comandos al momento de implementar, con el resultado
esperado de cada uno documentado, para que Cesar los corra y confirme antes de publicar.

## 5. Cola de revisión

Pedidos `origen = 'web'` entran con `estado = 'Por confirmar'` (vía trigger). Se excluyen
explícitamente de:

- `calcularMaterialesLote` ([index.html:3184](../../../index.html)) — agregar `&& p.origen !== 'web'`... en
  realidad más simple: excluir por `estado !== 'Por confirmar'` además de `!== 'Entregado'`.
- Hero "Por cobrar" y conteos del dashboard ([index.html:3062-3066](../../../index.html)).
- "Alertas y Entregas Próximas" ([index.html:3135-3138](../../../index.html)).
- Grid de tarjetas de "Lote Activo" ([index.html:3362](../../../index.html)).

Viven en una **vista nueva y separada** dentro de `index.html` ("Pedidos por confirmar"),
accesible desde una card de alerta en el Dashboard ("N pedidos nuevos por revisar"). Ahí Cesar
puede: editar cualquier campo (reutilizando el formulario existente), **confirmar** (pasa a
`Pendiente`, recién ahí entra a todos los cálculos), o **rechazar/eliminar** sin dejar rastro.

## 6. Formulario público — contenido

**Datos del cliente**: Canal (WhatsApp/Instagram/TikTok→se guarda como `otro`), Nombre (su label
cambia a "Usuario de Instagram" si elige ese canal), Contacto (mismo campo, sirve para ambos usos).

**Por producto** (repetible, "+ agregar otro producto"): Tipo, Variante, Talla (para Pijama: lista
fija `12, 14, S, M, L, XL`; otros tipos mantienen el campo tal como está en el interno por ahora),
Corte (select por ahora, se reemplaza por selector visual cuando Cesar mande las imágenes de
referencia), Color (pantonera visual: familia → cuadrícula de 10 tonos reales clickeables, sin
botón de copiar hex, con el disclaimer *"Los colores pueden variar ligeramente según la pantalla de
tu celular o computadora 📱💻"*), Patrón (galería visual ya existente, sin cambios), Mascota/Año/Raza,
Precio (visible, mostrado desde `catalogo_productos` público — recalculado server-side al guardar,
ver sección 3), Fotos (por producto, con el mensaje *"El precio incluye hasta 3 fotos por producto
📸 ¿Necesitas subir más? Cada foto adicional (desde la 4ta) tiene un costo extra de S/5"* — no se
calcula solo, Cesar lo ajusta al revisar), Observaciones del producto.

**Excluido del formulario público**: Lote, Estado, ¡Urgente!, Adelanto/Monto pagado, Observaciones
generales del pedido (redundante con las de producto), Fecha de entrega (reemplazada por el
mensaje fijo).

**Mensaje fijo de plazo** (visible antes de enviar y en el PDF):

> "El plazo máximo de producción son 7 días hábiles 🗓️ sin embargo en caso su pedido esté listo
> antes le enviaremos el mensajito para coordinar el envío ⭐️✅"

## 7. Envío, errores y PDF

- Botón "Registrar pedido" se bloquea al primer clic + estado de carga, evita duplicados.
- Sin lote activo: mensaje amigable ("Estamos actualizando pedidos, intenta en unos minutos 🙏"),
  no se guarda nada.
- Error de guardado (sin internet, error de Supabase): mensaje claro, nunca un error técnico crudo,
  y los datos ya escritos en el formulario no se pierden (no se limpia el form en caso de error).
- PDF (jsPDF desde CDN, paleta de marca `#E8721C` acento / `#F5F0E8` fondo / `#2C1810` texto):
  código de pedido + logo, detalle de cada producto (con su cuadrito de color), precio total,
  mensaje de plazo. Sin fotos (se generan solo después de confirmar guardado exitoso en Supabase,
  nunca antes).
- Pantalla de éxito: el PDF para descargar, el mensaje *"¡Tu pedido fue registrado con éxito! 🎉
  Para confirmarlo, coordinamos contigo por WhatsApp el adelanto del 50% del total y cualquier
  detalle final 💛"*, y un botón de contacto según el canal que eligió el cliente al inicio:
  - `wpp` u `otro`/TikTok → botón WhatsApp (`wa.me/...?text=...`) con mensaje pre-armado que
    incluye el código de pedido.
  - `ig` → botón "Copiar mensaje y abrir Instagram" (copia el mensaje al portapapeles y abre
    `ig.me/m/<usuario>`) — Instagram no permite precargar texto en el DM desde un link externo, es
    una limitación de la plataforma, no del código.

## Fuera de alcance

- Registro público de cuentas o recuperación de contraseña self-service para el login interno (2
  cuentas fijas, creadas a mano por Cesar).
- Migrar pedidos internos existentes a tener `codigo_pedido` (queda `NULL`, el trigger solo aplica
  a `origen = 'web'`).
- Envíos a provincia / campos de dirección (no se piden en el formulario, se coordina por WhatsApp).
- Selector visual de corte (clásico/princesa) — pendiente a que Cesar envíe las imágenes.

## Verificación antes de dar por terminado

- Confirmar que Cesar y Mariana pueden iniciar sesión en `index.html` con sus cuentas, y que sin
  sesión activa la app no muestra nada (ni siquiera brevemente antes del redirect al login).
- Correr el procedimiento de prueba de seguridad (sección 4) y confirmar cada resultado esperado.
- Crear un pedido de prueba real desde `pedido.html`, confirmar que llega con `estado='Por
  confirmar'`, `origen='web'`, `codigo_pedido` con formato correcto, y que NO aparece en ningún
  cálculo del dashboard ni en el grid de "Lote Activo" hasta confirmarlo.
- Confirmar el pedido de prueba desde la cola de revisión y verificar que a partir de ahí sí cuenta
  en todos los cálculos.
- Probar el flujo completo en iPhone/Safari (subida de fotos desde cámara/galería, PDF, botones de
  WhatsApp/Instagram).
- Borrar el pedido de prueba al final y confirmar que no quedó nada.
