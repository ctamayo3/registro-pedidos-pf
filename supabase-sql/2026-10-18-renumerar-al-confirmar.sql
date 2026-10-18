-- Renumerar un pedido del formulario publico cuando, al CONFIRMARLO, se manda a otro lote.
-- Correr en el SQL Editor del proyecto cuya URL contiene zafgoegngcqsswzzxcen.
--
-- Por que: numero_pedido se reinicia por lote (#12-L9 y #12-L10 son pedidos distintos). Un pedido
-- web entra con el lote activo del momento en que llego; si al confirmarlo se manda a otro lote,
-- tiene que tomar el siguiente numero libre de ESE lote, o podria repetir un numero que ya existe.
-- El numero nunca se calcula en el navegador (ver CLAUDE.md, "Gotchas"): lo hace la base de datos.
--
-- Alcance: solo actua cuando el pedido estaba "Por confirmar" y su lote cambia. No toca el resto de
-- ediciones (el formulario de editar sigue exactamente igual) ni los pedidos que no cambian de lote.
-- Es seguro correrlo mas de una vez.

create or replace function renumerar_pedido_al_confirmar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.estado = 'Por confirmar' and new.lote_id is distinct from old.lote_id then
    -- Se bloquea la fila del lote para que dos confirmaciones al mismo lote no calculen el mismo numero
    perform 1 from lotes where id = new.lote_id for update;
    select coalesce(max(numero_pedido), 0) + 1
      into new.numero_pedido
      from pedidos
      where lote_id = new.lote_id and id <> new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_renumerar_pedido_al_confirmar on pedidos;
create trigger trg_renumerar_pedido_al_confirmar
  before update of lote_id on pedidos
  for each row execute function renumerar_pedido_al_confirmar();

-- Comprobar: debe devolver 1 fila con tgenabled = 'O' (activo)
select tgname, tgenabled from pg_trigger where tgname = 'trg_renumerar_pedido_al_confirmar';
