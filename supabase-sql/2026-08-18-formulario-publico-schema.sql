-- Formulario público de auto-registro — Fase 1 (esquema, trigger, RLS, Storage)
-- Corrido en el SQL Editor de Supabase el 2026-08-18. Copia de referencia,
-- el estado real vive en Supabase — si se edita algo aquí, hay que volver
-- a correrlo manualmente ahí (no hay migraciones automáticas en este proyecto).
-- Ver docs/superpowers/specs/2026-08-18-formulario-publico-design.md

-- === Esquema ===
ALTER TABLE pedidos ADD COLUMN origen text NOT NULL DEFAULT 'interno'
  CHECK (origen IN ('interno', 'web'));
ALTER TABLE pedidos ADD COLUMN codigo_pedido text UNIQUE;

ALTER TABLE pedidos DROP CONSTRAINT pedidos_estado_check;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_estado_check
  CHECK (estado IN ('Por confirmar', 'Pendiente', 'Diseño enviado', 'En producción', 'Listo', 'Entregado'));

-- === Trigger: codigo de pedido + precio blindado (solo para origen='web') ===
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

-- === RLS ===
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogo_productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE patrones ENABLE ROW LEVEL SECURITY;
ALTER TABLE recetas_materiales ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos_lote ENABLE ROW LEVEL SECURITY;
ALTER TABLE caja_ajustes ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_pedidos" ON pedidos FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "authenticated_all_pedidos" ON pedidos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "anon_insert_items" ON items_pedido FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "authenticated_all_items" ON items_pedido FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "anon_select_catalogo" ON catalogo_productos FOR SELECT TO anon USING (true);
CREATE POLICY "authenticated_all_catalogo" ON catalogo_productos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "anon_select_patrones" ON patrones FOR SELECT TO anon USING (true);
CREATE POLICY "authenticated_all_patrones" ON patrones FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_all_recetas" ON recetas_materiales FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_lotes" ON lotes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_gastos" ON gastos_lote FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_caja" ON caja_ajustes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_push" ON push_subscriptions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- === Storage ===
CREATE POLICY "anon_insert_fotos" ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'fotos-pedidos');

CREATE POLICY "authenticated_all_storage" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'fotos-pedidos') WITH CHECK (bucket_id = 'fotos-pedidos');

-- Nota: al correr esto se encontraron 3 politicas viejas en storage.objects
-- con rol "public" (de la configuracion original del bucket) que dejaban
-- listar el bucket completo a cualquiera. Se borraron por separado:
--   DROP POLICY "public select" ON storage.objects;
--   DROP POLICY "public insert" ON storage.objects;
--   DROP POLICY "public update" ON storage.objects;
