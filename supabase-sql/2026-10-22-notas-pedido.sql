-- Notas tipo post-it pegadas a un pedido (para que Cesar y Mariana no dependan de la memoria).
-- Correr en el SQL Editor del proyecto cuya URL contiene zafgoegngcqsswzzxcen.
--
-- Van pegadas al PEDIDO (no a cada producto): al editar un pedido sus productos se borran y se
-- vuelven a crear, y las notas se perderian. Si un pedido se borra, sus notas se borran con el.
-- Solo las usa el panel interno (con login); el publico (anon) no puede leerlas ni escribirlas.
-- Es seguro correrlo mas de una vez.

create table if not exists notas_pedido (
  id          uuid        primary key default gen_random_uuid(),
  pedido_id   uuid        not null references pedidos(id) on delete cascade,
  texto       text        not null check (char_length(texto) between 1 and 500),
  autor       text,
  creada_at   timestamptz not null default now(),
  hecha       boolean     not null default false,
  hecha_at    timestamptz,
  hecha_por   text
);

create index if not exists notas_pedido_pedido_idx on notas_pedido (pedido_id);
create index if not exists notas_pedido_pendientes_idx on notas_pedido (hecha) where hecha = false;

alter table notas_pedido enable row level security;

drop policy if exists "notas_pedido acceso completo autenticados" on notas_pedido;
create policy "notas_pedido acceso completo autenticados"
  on notas_pedido for all to authenticated
  using (true) with check (true);

revoke all on notas_pedido from anon;

-- Comprobar: debe devolver 0 filas (la tabla existe y esta vacia)
select count(*) as notas from notas_pedido;
