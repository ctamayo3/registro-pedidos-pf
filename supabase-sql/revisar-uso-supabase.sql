-- Cuanto espacio usa tu proyecto de Supabase. Solo LEE, no cambia nada: se puede correr cuando quieras.
-- Correr en el SQL Editor del proyecto cuya URL contiene zafgoegngcqsswzzxcen.
-- El SQL Editor muestra solo el resultado de la ULTIMA consulta: corre una por una (seleccionala y Run).

-- 1) Tamano total de la base de datos (pedidos, items, lotes, etc.)
--    Plan gratis: limite de 500 MB.
select pg_size_pretty(pg_database_size(current_database())) as tamano_base_de_datos;

-- 2) Que tablas pesan mas
select relname as tabla, pg_size_pretty(pg_total_relation_size(relid)) as tamano
from pg_catalog.pg_statio_user_tables
order by pg_total_relation_size(relid) desc
limit 10;

-- 3) Fotos guardadas en Storage (fotos de pedidos e imagenes de patrones)
--    Plan gratis: limite de 1 GB. Aqui suele estar el mayor consumo.
select count(*) as archivos,
       pg_size_pretty(coalesce(sum((metadata->>'size')::bigint), 0)) as peso_total,
       pg_size_pretty(coalesce(avg((metadata->>'size')::bigint), 0)::bigint) as peso_promedio
from storage.objects
where bucket_id = 'fotos-pedidos';

-- 4) Cuanto has registrado (para calcular cuanto crece por pedido)
select (select count(*) from pedidos) as pedidos,
       (select count(*) from items_pedido) as productos,
       (select count(*) from lotes) as lotes;
