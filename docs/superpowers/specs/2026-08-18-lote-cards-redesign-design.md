# Rediseño de tarjetas de pedido — "Lote Activo"

**Fecha**: 2026-08-18
**Estado**: Aprobado, pendiente de plan de implementación

## Contexto

Las tarjetas de pedido en "Lote Activo" (`renderOrderCard` en [index.html](../../../index.html)) son la
forma en la que Cesar y Mariana reconocen un pedido a primera vista, sin tener que abrir el resumen. Hoy
la tarjeta muestra: foto (la primera que encuentre entre todos los productos del pedido), stepper de
estado, nombre del cliente, número de pedido, ícono de canal, lista de "tipo — variante" de todos los
productos concatenada, tallas distintas como badges, y saldo/pagado. Le falta: color de la prenda, corte
(clásico/princesa), patrón, e indicador de si hay observaciones que leer. El pedido es que se agregue esa
info sin agrandar la tarjeta.

## Objetivo

Reorganizar visualmente la tarjeta para mostrar más información relevante a primera vista, manteniendo el
tamaño actual, sin tocar la lógica de negocio existente (estados, pagos, numeración de lotes/pedidos, etc).

## Cambio de modelo: una tarjeta por producto, no por pedido

Hoy `renderOrderCard(p)` recibe un pedido y "aplana" todos sus productos en una sola tarjeta (primera foto
encontrada, tallas distintas concatenadas). Esto no deja espacio para mostrar color/corte/patrón por
producto cuando un pedido tiene varios.

**Nuevo comportamiento**: si un pedido tiene N productos, se renderizan N tarjetas separadas en el
tablero, una por producto, numeradas "1/N", "2/N", etc. — mostrando exclusivamente los datos de ESE
producto (foto, color, talla, corte, patrón, observación propia).

Campos que son del **pedido completo** (no del producto) — estado, saldo pendiente, monto pagado, cliente,
canal, urgente — se muestran **idénticos en todas las tarjetas hermanas** de ese pedido. Tocar el semáforo
de estado en cualquiera de las tarjetas hermanas mueve el pedido completo (`cambiarEstado`), y todas las
hermanas reflejan el nuevo estado al re-renderizar — mismo comportamiento de hoy, solo que ahora se ve
repetido en cada tarjeta del grupo.

Pedidos de un solo producto (el caso más común) se ven exactamente como una tarjeta individual, sin ningún
indicador de agrupación.

## Amarre visual entre tarjetas hermanas

Cuando un pedido tiene 2+ productos:

- Franja delgada de color (≈5px) en el borde superior de la tarjeta. El color se genera de forma
  determinística a partir del `id` del pedido, eligiendo de una paleta fija de 6-8 tonos cálidos
  (curados para no chocar con los colores semánticos ya usados: `--danger`, `--gold`, `--accent`,
  `--success`, `--estado-listo`). El mismo pedido siempre cae en el mismo color mientras no cambie su id.
- Pastilla "N/M" en la esquina superior derecha (gradiente `--accent`/`--accent-dark`, mismo lenguaje
  visual que el resto de badges de acento de la app).

Pedidos de un solo producto no muestran franja ni pastilla.

## Contenido de cada tarjeta

De arriba hacia abajo:

1. **Franja de agrupación** (solo si el pedido tiene 2+ productos, ver arriba)
2. **Stepper de estado** — igual que hoy (`renderEstadoStepper`), sin cambios de comportamiento
3. **Header**: nombre del cliente (tipografía `Fraunces`, consistente con el resto de títulos de la app) +
   ícono de ojo rojo (círculo sólido, no solo el ícono suelto) si **ese producto** tiene `observaciones`
   propias no vacías — las `observaciones_generales` del pedido NO se reflejan en la tarjeta, solo se ven
   al abrir el resumen completo. Número de pedido como badge a la derecha.
4. **Foto** del producto: `item.fotos[0]` (la foto de ESE producto específico, no la primera que se
   encuentre en cualquier producto del pedido). Si no hay foto, mismo placeholder de ícono que hoy.
5. **Tipo — variante** en texto (ej. "Pijama — Manga corta + short"). La info de manga corta/larga ya
   queda cubierta aquí, sin necesidad de un badge aparte.
6. **Fila de chips**, cada uno condicional a si el campo aplica al tipo de producto:
   - **Talla** (si `item.talla`)
   - **Corte** (solo pijama manga corta con `VARIANTES_CON_CORTE`, valor "Clásico"/"Princesa")
   - **Color**: cuadradito de color (resuelto vía `buscarColorPorCodigo(item.color)`) + código corto (ej.
     "A04"). Si el código no existe en `PANTONERA` (pedidos viejos con texto libre), se muestra el texto
     tal cual sin cuadradito de color — mismo criterio de "gracia" que ya usa `buscarColorPorCodigo` en el
     resto de la app, sin forzar ni mostrar error.
   - **Patrón**: miniatura real (`imagen_url` del patrón cuyo `nombre` coincida con `item.patron`, buscado
     en el array `patterns` ya cargado en memoria) + nombre del patrón. Si `item.patron` no coincide con
     ningún patrón activo, no se muestra el chip.
   - Polo y Tote bag no tienen color ni patrón (per `CAMPOS_POR_TIPO`) — esos chips simplemente no
     aparecen para esos tipos, sin hueco vacío.
7. **Footer**: saldo pendiente / "Pagado" (dato del pedido completo, igual que hoy) + ícono de canal
   (IG/WhatsApp)

**Se quitan los botones "Ver" y "Editar"** que hoy están al final de la tarjeta. Toda la tarjeta sigue
siendo táctil (`onclick="verResumenPedido(...)"`, sin cambios) — el botón "Ver" era redundante con eso, y
"Editar" ya existe dentro del modal de resumen (`summary-actions`). Esto libera el espacio vertical
necesario para los chips nuevos sin agrandar la tarjeta.

## Alcance: dónde aplica

`renderOrderCard` se usa en dos lugares — ambos quedan cubiertos por el mismo cambio:

- Tablero de "Lote Activo" (activos + entregados)
- Acordeón "Lotes anteriores"

Ambas consultas a Supabase que traen `items_pedido` deben ampliarse — hoy solo seleccionan
`fotos, nombre_mascota, tipo_producto, variante, talla`, hace falta agregar `color, patron, corte,
observaciones, orden` (ver siguiente sección).

## Cambio de esquema: columna `orden`

`items_pedido` no tiene ningún campo que registre en qué orden se cargaron los productos al formulario
(Producto 1, Producto 2...). El orden en que Supabase devuelve las filas hoy no está garantizado a futuro.
Para que la numeración "1/N" de las tarjetas sea siempre estable y coincida con el orden real del
formulario, se agrega:

```sql
ALTER TABLE items_pedido ADD COLUMN orden integer;
```

Al guardar un pedido (`saveOrder`), cada producto se inserta con `orden` = su posición entre las tarjetas
del formulario en ese momento (1, 2, 3...). Las consultas que alimentan el tablero deben pedir los items
ordenados por esa columna. Pedidos ya existentes sin `orden` (NULL) caen al final del orden o usan el
orden que venga por defecto — no se migran datos viejos retroactivamente salvo que el usuario lo pida.

## Fuera de alcance

- No se toca la lógica de cálculo de costos, pagos automáticos al marcar "Entregado", numeración de
  lotes/pedidos, ni ningún otro comportamiento de negocio documentado en `CLAUDE.md`.
- No se modifica el modal de resumen (`verResumenPedido`) ni la interfaz/UX del formulario de
  creación/edición de pedidos — el único cambio ahí es interno, en `saveOrder`, para que cada producto se
  inserte con su columna `orden` (ver sección anterior). No cambia nada visible del formulario.
- No se migra el `orden` de pedidos ya existentes.

## Verificación manual antes de dar por terminado

- Probar en un lote real con: pedidos de 1 solo producto, pedidos de 2+ productos, un pedido con color en
  formato viejo (texto libre), un pedido sin foto, un pedido con observación en un producto y sin
  observación en otro del mismo pedido.
- Confirmar que el alto de la tarjeta no creció visiblemente respecto al diseño actual.
- Probar en viewport móvil (iPhone/Safari) — no solo escritorio.
- Confirmar que tocar cualquier cuadradito del semáforo en una tarjeta hermana actualiza el estado en
  todas las tarjetas hermanas de ese pedido al recargar la vista.
