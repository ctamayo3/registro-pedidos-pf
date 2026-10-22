-- Notas generales del equipo (recordatorios que no van ligados a un pedido), se ven en "Inicio".
-- Correr en el SQL Editor del proyecto cuya URL contiene zafgoegngcqsswzzxcen.
--
-- Solo las usa el panel interno (con login); el publico (anon) no puede leerlas ni escribirlas.
-- Es seguro correrlo mas de una vez.

create table if not exists notas_generales (
  id          uuid        primary key default gen_random_uuid(),
  texto       text        not null check (char_length(texto) between 1 and 500),
  autor       text,
  creada_at   timestamptz not null default now(),
  hecha       boolean     not null default false,
  hecha_at    timestamptz,
  hecha_por   text
);

create index if not exists notas_generales_creada_idx on notas_generales (creada_at desc);

alter table notas_generales enable row level security;

drop policy if exists "notas_generales acceso completo autenticados" on notas_generales;
create policy "notas_generales acceso completo autenticados"
  on notas_generales for all to authenticated
  using (true) with check (true);

revoke all on notas_generales from anon;

-- Comprobar: debe devolver 0 filas (la tabla existe y esta vacia)
select count(*) as notas_generales from notas_generales;
