-- Short de varon/mujer y retiro de manga larga (2026-10-07)
-- Spec: docs/superpowers/specs/2026-10-07-short-varon-mujer-quitar-manga-larga-design.md
--
-- ORDEN OBLIGATORIO:
--   1. Correr el PASO 1.
--   2. Publicar el codigo (pedido.html / index.html nombran la columna en select/insert;
--      sin ella fallan Lote Activo y el registro de pedidos del formulario publico).
--   3. Correr el PASO 2.

-- PASO 1 — columna nueva. Nullable: no afecta ningun pedido existente.
-- NULL = no aplica (no es pijama con short) o no definido (pedidos anteriores al campo).
ALTER TABLE items_pedido
  ADD COLUMN tipo_short text CHECK (tipo_short IN ('varon', 'mujer'));

-- PASO 2 — retirar "Manga larga + pantalon" de los dos formularios.
-- No borra la fila ni toca pedidos antiguos; ambos formularios cargan el catalogo con activo = true.
UPDATE catalogo_productos SET activo = false
WHERE tipo_producto = 'pijama' AND variante = 'Manga larga + pantalón';
