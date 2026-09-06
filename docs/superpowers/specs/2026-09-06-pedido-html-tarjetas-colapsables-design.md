# Tarjetas de producto colapsables + mini-preview en vivo (pedido.html)

**Fecha**: 2026-09-06
**Estado**: Aprobado, pendiente de plan de implementación

## Contexto

Segundo de 3 grupos de mejoras de UX para `pedido.html` (formulario público), aprobados en la misma
sesión que el Grupo 1 ("Validación específica y revisión antes de enviar", ya implementado — ver
`2026-09-06-pedido-html-validacion-revision-design.md`). El Grupo 3 ("Borrador guardado en el
navegador") queda pendiente, spec aparte.

Con 2+ productos, `pedido.html` muestra todas las tarjetas completas y desplegadas a la vez —
~10 campos por producto, una debajo de otra. La investigación de UX de formularios/configuradores citada
en la auditoría de esta sesión es consistente en esto: partir un formulario largo en pasos/progressive
disclosure sube la tasa de finalización, especialmente en mobile. Este grupo junta 2 mejoras que
comparten el mismo componente visual:

1. Las tarjetas de producto ya completas se colapsan a un resumen chico, dejando solo la que se está
   editando desplegada.
2. Mientras una tarjeta está abierta, un mini-preview en vivo (foto + chips de talla/color/patrón +
   precio) se va actualizando a medida que se llenan los campos — el mismo componente que se usa para el
   resumen colapsado, solo que visible durante la edición.

## Componente compartido: `renderResumenProducto(prodId)`

Ambas mejoras se apoyan en una única función que arma el HTML de "foto + tipo/modelo + chips de
talla/color/patrón + precio" para un producto, leyendo directo del DOM (los mismos campos que ya llena
el formulario). Reglas de "gracia" ya establecidas en el resto del proyecto: cada chip solo aparece si
ese campo tiene valor; si no hay foto, un cuadrado placeholder con ícono; el color se resuelve con
`buscarColorPorCodigo()` (ya existe) para mostrar el cuadradito real — si el código no se encuentra, se
muestra el texto tal cual, sin cuadradito.

Se usa en dos lugares:
- **Mini-preview en vivo**: una franja dentro de la tarjeta abierta, justo debajo del encabezado
  "Producto N", que se recalcula cada vez que cambia tipo, modelo, talla, color, patrón o las fotos.
- **Resumen colapsado**: el contenido completo de la tarjeta cuando está colapsada — se calcula una sola
  vez, en el momento de colapsar (no necesita mantenerse "en vivo" mientras está oculta).

## Cómo colapsa una tarjeta

**Disparador**: tocar "Agregar otro producto". Antes de agregar la tarjeta nueva:

1. Se valida la tarjeta actualmente abierta (si hay alguna) con las mismas reglas del Grupo 1 — Tipo y
   Modelo siempre, más Talla/Color/Patrón/foto o Talla/Nombre de mascota/foto o
   Nombre de mascota/foto según el tipo de producto.
2. Si está incompleta: se muestra el mismo error específico (qué producto, qué campo) con scroll y
   borde rojo temporal — **no se agrega ninguna tarjeta nueva**, el cliente tiene que completar la
   actual primero.
3. Si está completa: esa tarjeta se colapsa (los campos se ocultan, no se destruyen — nada se pierde),
   se agrega la tarjeta nueva ya desplegada, y la página hace scroll suave hasta ella.

**Reabrir**: tocar en cualquier parte de una tarjeta colapsada la vuelve a desplegar, con todos sus
valores intactos (talla, color, patrón, fotos, observaciones — todo sigue ahí, colapsar solo es un
cambio visual de qué se muestra).

**Sin botón de colapsar manual**: colapsar solo ocurre como efecto de avanzar al siguiente producto. No
se agrega un control aparte para colapsar sin agregar otro producto — mantiene el flujo simple.

## Validación final (`revisarPedido`) y tarjetas colapsadas

Si al tocar "Registrar pedido" (Grupo 1) el error apunta a un producto que está colapsado, además del
scroll y el borde rojo ya existentes, **la tarjeta se abre automáticamente** — así el cliente ve de una
el campo que falta, sin tener que adivinar que hay que tocarla primero.

## Fuera de alcance

- No se agrega ningún control para colapsar manualmente sin agregar un producto nuevo.
- El campo Corte no aparece en el mini-preview ni en el resumen colapsado (ya es evidente por el
  tipo/modelo elegido — mantiene el resumen sin saturarse de chips).
- No se toca la validación en sí (reglas, mensajes) — ya quedó definida en el Grupo 1, este grupo solo
  reutiliza `validarFormulario`/`mostrarErrorValidacion`, extrayendo la validación de UN producto a una
  función nueva (`validarProducto`) para poder llamarla también al agregar un producto nuevo, no solo al
  enviar el formulario completo.
- No se toca `index.html` ni ninguna tabla/columna de Supabase — cambio 100% dentro de `pedido.html`.
- No se toca el Grupo 3 (borrador en `localStorage`) — spec aparte, a futuro.

## Verificación manual antes de dar por terminado

- Con un solo producto (caso más común): debe verse y comportarse exactamente igual que antes — nunca
  se colapsa nada porque nunca se agrega un segundo producto.
- Llenar un producto completo, tocar "Agregar otro producto": el primero se colapsa mostrando foto real,
  tipo/modelo, chips y precio; el segundo aparece desplegado, con scroll automático hacia él.
- Dejar el segundo producto incompleto (ej. sin color) y tocar "Agregar otro producto" de nuevo: debe
  fallar con el mismo mensaje específico de siempre, sin agregar un tercer producto ni colapsar el
  segundo.
- Tocar una tarjeta colapsada: debe reabrirse con todos los valores que tenía (talla, color, patrón,
  fotos, observaciones) intactos.
- Mientras se llena un producto: elegir talla, luego color, luego patrón, luego subir una foto — el
  mini-preview debajo del encabezado debe ir actualizándose en cada paso, mostrando solo los chips de
  los campos ya llenados.
- Armar 2 productos, colapsar el primero, y dejar el segundo con un campo faltante. Tocar "Registrar
  pedido": el primero (colapsado) no debe verse afectado; si el error es del segundo, debe verse el
  comportamiento normal del Grupo 1. Para probar el auto-expandir, forzar (con datos de prueba) que el
  producto con el error sea uno que ya esté colapsado, y confirmar que se abre solo al mostrar el error.
