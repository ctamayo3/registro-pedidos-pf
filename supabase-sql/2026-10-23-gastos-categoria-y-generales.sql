-- Gastos mejorados: categoria por gasto y gastos "generales" (sin lote).
-- Correr en el SQL Editor del proyecto zafgoegngcqsswzzxcen ANTES de usar la version nueva.
-- No borra ni cambia ningun gasto existente.

alter table public.gastos_lote add column if not exists categoria text;
alter table public.gastos_lote alter column lote_id drop not null;

-- Verificacion: debe mostrar categoria (text) y lote_id con is_nullable = YES
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'gastos_lote'
order by ordinal_position;

-- Solo lectura: muestra como esta escrito el aviso push de gastos (para confirmar que un gasto
-- sin lote no lo rompe). Pegame el resultado de esta consulta.
select pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'notificar_gasto_registrado';
