# Validación específica, campos obligatorios y revisión antes de enviar (pedido.html)

**Fecha**: 2026-09-06
**Estado**: Aprobado, pendiente de plan de implementación

## Contexto

Primero de 3 grupos de mejoras de UX para `pedido.html` (formulario público), decididos tras una
auditoría completa del formulario contra mejores prácticas de UX de formularios/configuradores de
producto (ver conversación de la sesión — no hay documento separado de esa auditoría). Los otros 2
grupos ("Tarjetas colapsables + mini-preview en vivo" e "Borrador guardado en el navegador") son specs
independientes, a futuro.

Este grupo junta 3 mejoras porque comparten un mismo flujo — la revisión final solo tiene sentido una
vez que la validación ya garantiza que los datos están completos:

1. La validación hoy es genérica ("Completa el tipo y modelo de todos los productos") y no dice cuál
   producto ni qué campo falta.
2. Solo se valida Tipo + Modelo — un cliente puede enviar una Pijama sin talla, color, patrón ni foto,
   y el negocio se entera recién al revisar "Por Confirmar", teniendo que escribirle al cliente a pedir
   los datos faltantes.
3. La ficha de resumen (`renderFichaResumen`, ya existente) solo se muestra DESPUÉS de que el pedido ya
   quedó guardado en Supabase — si algo está mal (foto en el producto equivocado, color que no era), ya
   no se puede corregir sin reeditar o escribir por WhatsApp.

## Reglas de campos obligatorios por tipo de producto

Confirmadas explícitamente por el usuario — no inventar variaciones:

| Tipo | Campos obligatorios |
|---|---|
| Pijama | Talla, Color, Patrón (ver "Sin patrón" abajo — elegir explícitamente que no quiere ninguno también cuenta como completo), al menos 1 foto |
| Polo | Talla, Nombre de la mascota, al menos 1 foto |
| Tote bag | Nombre de la mascota, al menos 1 foto (sin talla, no aplica a este tipo) |

`Raza o frase` y `Año de nacimiento` siguen siendo opcionales, sin cambios. Manta no aplica — ya está
oculta del selector de tipo de producto en `pedido.html` (cambio de sesión anterior).

## Cambio 1: Opción "Sin patrón" en la galería

Hoy la galería de patrones (`renderPatternGallery`) solo lista los patrones reales cargados desde
Supabase. Como Patrón pasa a ser obligatorio para Pijama, hace falta una forma explícita de decir "no
quiero ningún patrón" — si no, un cliente que genuinamente no quiere patrón quedaría atascado sin poder
enviar su pedido.

Se agrega una tarjeta más al inicio de la galería, con el mismo lenguaje visual que las demás
(`.pattern-option`, mismo tamaño cuadrado) pero sin imagen real — un cuadrado con ícono (`fa-solid
fa-ban`, ya se usa Font Awesome en el proyecto) sobre el fondo `--card-secondary` (el mismo que ya usan
los placeholders de foto), y el texto "Sin patrón" debajo. Al elegirla, se guarda el valor literal
`"Sin patrón"` en el campo oculto (no vacío) — así queda claramente distinguible de "todavía no eligió
nada", que sigue siendo detectado como campo incompleto por la validación.

Este valor literal `"Sin patrón"` es lo que queda guardado en `items_pedido.patron` para ese producto —
consistente con cómo ya se guardan los demás valores de patrón (el nombre tal cual, sin ningún id). Las
vistas que muestran el patrón como texto (la ficha de resumen, el resumen interno) simplemente muestran
"Sin patrón" tal cual, sin necesitar ningún caso especial.

## Cambio 2: Validación específica, con scroll y aviso visual al producto con error

Nueva función `validarFormulario()` que revisa, en orden:

1. Nombre y contacto del cliente (igual que hoy).
2. Que exista al menos un producto.
3. Cada producto, uno por uno, contra sus campos obligatorios según su tipo (tabla de arriba). Al
   primer producto con un campo faltante, se detiene ahí (no se acumulan todos los errores a la vez —
   más simple de entender para el cliente, corrige uno a la vez).

Si hay un error, el mensaje debe decir el número de producto, su tipo, y qué campo específico falta —
por ejemplo: *"El Producto 2 (Pijama) todavía no tiene Color elegido — revísalo arriba."* Además:

- La página hace scroll suave hasta la tarjeta de ese producto (`scrollIntoView({ behavior: 'smooth',
  block: 'center' })`).
- Esa tarjeta recibe una clase CSS temporal (ej. `.error-highlight`, borde rojo con una transición breve)
  que se quita sola después de ~2 segundos (`setTimeout` + `classList.remove`).

Si todo está completo, no se envía nada todavía — se pasa al Cambio 3.

## Cambio 3: Pantalla de revisión antes de enviar

**Flujo actual** (`enviarPedido()`): valida → inserta el pedido en Supabase → sube fotos a Storage →
inserta cada producto → muestra la pantalla de éxito.

**Flujo nuevo**:

1. El botón "Registrar pedido" ahora llama a `revisarPedido()` en vez de `enviarPedido()` directamente.
2. `revisarPedido()` corre `validarFormulario()` (Cambio 2). Si pasa, arma un objeto `resumen` igual de
   forma que hoy arma `itemsResumen` (mismo shape que ya consume `renderFichaResumen`), con una
   diferencia clave: **las fotos se muestran con una vista previa local del navegador
   (`URL.createObjectURL(file)`), no se suben a Supabase Storage todavía**. Esto evita subir archivos
   que después el cliente podría cambiar si vuelve a "Editar", y evita dejar fotos huérfanas en Storage
   por pedidos que nunca se terminan de confirmar.
3. Se oculta `form-view` y se muestra una vista nueva `review-view` (mismo patrón de
   `display:none`/`display:block` que ya usan `form-view`/`success-view`), con la ficha
   (`renderFichaResumen(resumen)`) y dos botones:
   - **"Editar"** (`volverAEditar()`): oculta `review-view`, vuelve a mostrar `form-view`. El formulario
     no se toca ni se limpia — sigue con todo lo que el cliente ya llenó.
   - **"Confirmar y enviar"** (`confirmarYEnviarPedido()`): ejecuta exactamente la misma lógica que hoy
     tiene `enviarPedido()` después de la validación (crear el pedido, subir fotos reales a Storage,
     insertar cada producto, mostrar la pantalla de éxito) — sin cambios en esa parte, solo se dispara
     desde este botón en vez del botón principal del formulario.

No se guarda ningún estado intermedio en Supabase durante la revisión — si el cliente cierra la pestaña
en la pantalla de revisión, no queda ningún rastro en la base de datos (ni pedido, ni fotos).

## Fuera de alcance

- No se tocan las tarjetas colapsables ni el mini-preview en vivo (Grupo 2, spec aparte).
- No se toca el guardado de borrador en el navegador (Grupo 3, spec aparte).
- No se le da nombre descriptivo a los patrones (siguen siendo "1", "2", "3"... en Supabase) — quedó
  fuera de esta ronda de mejoras, el usuario no la incluyó al aprobar las 6 ideas.
- No cambia nada de `index.html` ni de la base de datos — todo el cambio vive dentro de `pedido.html`.
- Talla/Color no aplican a Polo/Tote bag por diseño ya existente (`CAMPOS_POR_TIPO`) — no se agregan
  campos nuevos, solo se exige que los que ya se muestran no queden vacíos.

## Verificación manual antes de dar por terminado

- Enviar un formulario con el nombre del cliente vacío — debe fallar con el mensaje de siempre, sin
  llegar a la pantalla de revisión.
- Armar una Pijama sin Color — debe fallar con un mensaje que mencione el número de producto, "Pijama" y
  "Color", y hacer scroll hasta esa tarjeta con el borde rojo temporal.
- Armar una Pijama y elegir explícitamente "Sin patrón" — debe pasar la validación (no debe pedir
  patrón) y en la revisión mostrarse el chip de patrón con el texto "Sin patrón".
- Armar un Polo sin nombre de mascota — debe fallar mencionando "Nombre de la mascota".
- Armar un Tote bag sin foto — debe fallar mencionando la foto, sin pedir talla (Tote bag no tiene).
- Completar todo correctamente — debe mostrar la pantalla de revisión con la ficha, fotos visibles
  (vista previa local), y el total correcto.
- Tocar "Editar" desde la revisión — debe volver al formulario con todos los campos y fotos tal como
  estaban, sin perder nada.
- Tocar "Confirmar y enviar" — debe completar el registro real (pedido + fotos subidas a Storage +
  items) y mostrar la pantalla de éxito de siempre, con el código de pedido real.
- Confirmar en Supabase que un pedido que se quedó a medio camino en la pantalla de revisión (cerrando
  la pestaña ahí) no dejó ningún registro en `pedidos` ni archivos sueltos en el bucket
  `fotos-pedidos`.
