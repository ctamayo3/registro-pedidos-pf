# Short de varón/mujer y retiro de manga larga — Diseño

**Fecha:** 2026-10-07
**Archivos afectados:** `pedido.html`, `index.html`, 2 sentencias SQL (las corre el usuario)

## Contexto

Dos correcciones de negocio pedidas por el usuario, que van solas y antes del rediseño visual del
formulario (sub-proyecto aparte):

1. **"Manga larga + pantalón" ya no se vende.** Hay que quitarlo de los dos formularios.
2. **El short de la pijama puede ser de varón o de mujer** y hoy el cliente no lo indica, así que no se
   sabe cuál confeccionar.

Restricción principal: todo funciona bien hoy; ningún pedido existente debe verse afectado y el
formulario público no puede quedar sin registrar pedidos en ningún momento del despliegue.

## Decisiones confirmadas con el usuario

- El dato varón/mujer aplica **solo** a la variante `Manga corta + short`. No aplica al pantalón.
- Varón y mujer cuestan lo mismo (S/95). No cambia el catálogo ni el cálculo de costos.
- Manga larga se oculta en `pedido.html` **y** en `index.html`.

## 1. Short de varón / mujer

### Base de datos

Columna nueva, nullable, en `items_pedido`:

```sql
ALTER TABLE items_pedido
  ADD COLUMN tipo_short text CHECK (tipo_short IN ('varon', 'mujer'));
```

`NULL` = no aplica (el producto no es pijama con short) o no definido (pedidos de short anteriores a
este cambio). No se migra data vieja. Las políticas RLS existentes (por fila) no cambian.

### Regla compartida

Aplica cuando `tipo_producto = 'pijama'` y `variante = 'Manga corta + short'` (constante
`VARIANTE_CON_SHORT` en ambos archivos). Etiquetas: `varon` → "Varón", `mujer` → "Mujer".

### `pedido.html` (formulario público)

- Campo nuevo "¿Short de varón o de mujer?" entre Modelo y Talla: 2 chips (Varón / Mujer), **sin
  ninguno preseleccionado**. Solo visible cuando aplica la regla; al dejar de aplicar se limpia el valor.
- **Obligatorio**: `validarProducto` lo exige cuando aplica, con el mismo mecanismo de error actual
  (mensaje con número de producto, scroll y borde rojo). Se marca en verde al completarse como los
  demás campos obligatorios.
- Se guarda en `items_pedido.tipo_short` (`null` cuando no aplica).
- Se muestra como chip "Short varón" / "Short mujer" en el resumen de la tarjeta colapsada y en la
  ficha de resumen (vista previa y pantalla de éxito).

### `index.html` (panel interno)

- **Formulario de pedido**: select "Short" (Sin definir / Varón / Mujer), visible solo cuando aplica.
  **No bloquea el guardado** si queda "Sin definir", para poder seguir editando pedidos de short
  anteriores al cambio. "Duplicar producto" copia el valor.
- **Tarjetas de Lote Activo** (`renderProductCard`) y **Por Confirmar** (`renderRevisionProductRow`):
  chip "Short varón" / "Short mujer". Si aplica la regla y el valor es `NULL`, chip de alerta
  "Short: sin definir" — en Lote Activo solo para pedidos que no están en `Entregado` (en entregados
  sería ruido permanente).
- **Resumen del pedido** (`verResumenPedido`): línea "Short: Varón/Mujer/sin definir" cuando aplica.
- **PDF "Pantalones y shorts"**: la pieza pasa a ser "Short varón" / "Short mujer" / "Short" (sin
  definir) / "Pantalón". El resumen de totales agrupa por pieza, así que varón y mujer se cuentan por
  separado sin más cambios.
- Las consultas con lista explícita de columnas de `items_pedido` que alimentan esas vistas agregan
  `tipo_short`.

## 2. Retiro de manga larga

### Base de datos

```sql
UPDATE catalogo_productos SET activo = false
WHERE tipo_producto = 'pijama' AND variante = 'Manga larga + pantalón';
```

Ambos formularios ya cargan el catálogo con `activo = true`, así que la variante desaparece de los dos
sin tocar código. La fila no se borra. El trigger de precios de pedidos web ya filtra por `activo`.

### Corrección necesaria en `index.html`

Hoy `updateVariants` arma el select de Variante solo con el catálogo activo. Al editar un pedido
antiguo de manga larga, la variante guardada no estaría en la lista: el select quedaría en
"Seleccione..." y `saveOrder` rechazaría el producto por incompleto.

Arreglo: si la variante guardada no está en el catálogo activo, `updateVariants` agrega una opción
extra seleccionada, `<variante> (descontinuado)`, sin precio de catálogo (se conserva el precio
guardado del producto). Vale para cualquier variante que se desactive en el futuro.

Pedidos antiguos de manga larga siguen mostrándose igual en tarjetas, resumen y PDFs
(`parteArribaEstampado` conserva "Manga larga").

## Orden de despliegue (obligatorio)

Las consultas y los `insert` nombran la columna `tipo_short`; si el código se publica antes de que
exista, fallan Lote Activo y el registro de pedidos del formulario público.

1. Usuario corre el `ALTER TABLE` (no afecta nada existente).
2. Se publica el código y se prueba en producción con un pedido de prueba (se borra después).
3. Usuario corre el `UPDATE` que desactiva manga larga.

## Pruebas

- Local (sin tocar datos): aparición/ocultamiento del campo, validación, chips y ficha en
  `pedido.html`; formulario, tarjetas, resumen y PDF en `index.html` con datos de ejemplo; edición de
  un producto con variante fuera de catálogo.
- Producción, tras el paso 1: pedido de prueba por `pedido.html` con short de mujer, verificación del
  valor guardado, borrado del pedido de prueba.

## Fuera de alcance

- Rediseño visual del formulario y mejoras del panel (sub-proyectos siguientes).
- Varón/mujer para pantalón. Renumerar o migrar pedidos antiguos.
