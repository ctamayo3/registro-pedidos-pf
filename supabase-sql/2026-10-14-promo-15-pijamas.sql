-- Promo 15% en pijamas (del lunes 12 al lunes 19 de octubre de 2026, hasta las 11 pm).
-- Correr en el SQL Editor del proyecto cuya URL contiene zafgoegngcqsswzzxcen.
--
-- El precio de los pedidos web lo pone la base de datos a partir de catalogo_productos,
-- por eso la promo se aplica bajando el precio del catalogo. pedido.html muestra solo
-- el precio regular tachado mientras el catalogo este por debajo de el.

-- PASO 1: precios de promocion (desde ya)
update catalogo_productos set precio = 80 where tipo_producto = 'pijama' and variante = 'Manga corta + short';
update catalogo_productos set precio = 92 where tipo_producto = 'pijama' and variante = 'Manga corta + pantalón';

-- PASO 2: volver solos a los precios regulares el lunes 19/10 a las 11 pm hora Peru (martes 20, 04:00 UTC).
-- La tarea se borra a si misma despues de correr.
select cron.schedule(
  'fin-promo-pijamas-oct',
  '0 4 20 10 *',
  $$
    update catalogo_productos set precio = 95  where tipo_producto = 'pijama' and variante = 'Manga corta + short';
    update catalogo_productos set precio = 109 where tipo_producto = 'pijama' and variante = 'Manga corta + pantalón';
    select cron.unschedule('fin-promo-pijamas-oct');
  $$
);

-- Comprobar: debe mostrar 80 y 92, y la tarea programada
select variante, precio from catalogo_productos where tipo_producto = 'pijama' and activo;
select jobname, schedule from cron.job where jobname = 'fin-promo-pijamas-oct';
