-- Stock de polos (seccion "Stock" del panel): cuantos polos hay en el taller por talla y corte.
-- Correr en el SQL Editor del proyecto cuya URL contiene zafgoegngcqsswzzxcen.
--
-- Una fila por talla + corte. Solo la usa el panel interno (con login): el publico (anon) no puede
-- leerla ni escribirla. Es seguro correrlo mas de una vez (no pisa las cantidades ya guardadas).

create table if not exists stock_polos (
  talla       text        not null,
  corte       text        not null check (corte in ('clasico', 'princesa')),
  cantidad    integer     not null default 0 check (cantidad >= 0),
  updated_at  timestamptz not null default now(),
  primary key (talla, corte)
);

alter table stock_polos enable row level security;

drop policy if exists "stock_polos acceso completo autenticados" on stock_polos;
create policy "stock_polos acceso completo autenticados"
  on stock_polos for all to authenticated
  using (true) with check (true);

revoke all on stock_polos from anon;

-- Filas iniciales en 0 (las tallas de las pijamas x los 2 cortes). No pisa lo que ya exista.
insert into stock_polos (talla, corte)
select t, c
from unnest(array['12', '14', 'S', 'M', 'L', 'XL']) as t,
     unnest(array['clasico', 'princesa']) as c
on conflict (talla, corte) do nothing;

-- Comprobar: debe devolver 12 filas, todas en 0 la primera vez
select talla, corte, cantidad from stock_polos order by corte, talla;
