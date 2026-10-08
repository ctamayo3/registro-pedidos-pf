# Formulario público v2 (`pedido-v2.html`) — Diseño

**Fecha:** 2026-10-07
**Archivo:** `pedido-v2.html` (nuevo, independiente). `pedido.html` sigue siendo el formulario vigente
hasta que el usuario pruebe v2 en su iPhone y pida el reemplazo.

## Cómo se llegó a este diseño

La auditoría de `pedido.html` (ver CLAUDE.md, Progreso 2026-10-07) encontró problemas de experiencia
y de robustez. Se le mostraron al usuario 3 direcciones visuales en teléfonos de muestra y **las
rechazó** ("prefiero la versión actual"; la oscura, "no me gusta nada"). El diseño aprobado mantiene
la identidad actual (crema, terracota, Fraunces + Poppins) y cambia la experiencia. Se validó con
un prototipo navegable publicado; este documento describe lo que el usuario aprobó sobre ese
prototipo, más sus ajustes.

## Flujo

1. **Tus datos** — canal en 3 tarjetas (WhatsApp / Instagram / TikTok u otro → `wpp`/`ig`/`otro`),
   sin preselección; nombre (o usuario de Instagram) y contacto.
2. **¿Qué quieres pedir?** — una tarjeta por cada fila activa del catálogo (hoy 4: Pijama con short,
   Pijama con pantalón, Polo de algodón, Tote bag), con ilustración, precio y, en pijama y polo, la
   etiqueta "Incluye tote bag de regalo". Decisión del usuario: las dos pijamas van separadas desde
   el inicio (3 tarjetas se veían vacías) y así el armado no tiene paso "Modelo". Manta sigue oculta.
3. **Armar el producto** — secciones tipo acordeón; al elegir, la sección se cierra mostrando su
   resumen y se abre la siguiente pendiente. Por tipo:
   - Pijama: short varón/mujer (solo con short) → talla (12, 14, S, M, L, XL) → corte (fotos reales) →
     color (12 familias, 10 tonos) → patrón (perro/gato, "Sin patrón") → fotos → observaciones.
   - Polo: talla (texto) → mascota (nombre obligatorio, año y raza/frase opcionales) → fotos → observaciones.
   - Tote bag: mascota → fotos → observaciones.
   Nada viene preseleccionado (incluido el corte, que antes venía en "Clásico"). Barra inferior fija
   con el precio y "Agregar al pedido"; si falta algo, abre esa sección y la señala.
4. **Tu pedido** — lista con editar / quitar / agregar otro producto, datos del cliente, aviso de
   plazo y "Confirmar y enviar".
5. **Confirmado** — confeti, código real, aviso del adelanto del 50%, resumen y botón de contacto
   (WhatsApp con mensaje prearmado; Instagram copia el mensaje y abre el chat).

## Fotos

- **Guía como recomendación, no requisito** (pedido del usuario: hay clientes con fotos antiguas o de
  recuerdo): "Lo ideal: de frente y con buena luz" con check; las otras dos como "De preferencia, que
  no esté…", sin marcas de error; y la línea "¿Solo tienes fotos antiguas o de recuerdo? Súbelas
  igual, también nos sirven".
- **El aviso "incluye hasta 3 fotos; desde la cuarta S/5" aparece recién al llegar a la tercera
  foto** (pedido del usuario: anunciarlo desde el inicio hacía que todos subieran tres). Desde la
  cuarta, cada miniatura lleva "+ S/5". El cargo sigue siendo informativo, no se suma al total.
- Antes de subir, cada foto de más de 900 KB se reduce a un lado máximo de 2400 px en JPEG (calidad
  0.9). Si el navegador no puede leer el formato o no se gana peso, se sube el original.

## Envío (misma data que `pedido.html`, más segura)

Se escriben las mismas tablas y columnas que hoy (`pedidos`, `items_pedido` incluido `tipo_short`,
bucket `fotos-pedidos`, `obtener_codigo_pedido`). Cambia el orden, para cerrar 2 fallas de la versión
anterior:

1. **Primero todas las fotos**, con hasta 3 intentos cada una y avance visible ("Subiendo foto 2 de
   5"). Si alguna falla, **no se registra el pedido** (antes la foto fallida se omitía en silencio).
2. Luego el pedido; luego **todos los productos en un solo `insert`**.
3. El `id` del pedido se conserva entre reintentos (`S.envio`): si el pedido ya se creó, el
   reintento solo completa lo que faltó (antes quedaba un pedido huérfano y el reintento creaba otro).
   Un error `23505` al crear el pedido se toma como "ya existe". Las fotos ya subidas no se re-suben.

`tipo_mascota` solo se guarda cuando el producto lleva patrón (antes polo y tote bag guardaban
"perro" por defecto).

## Borrador automático

Se guarda en `localStorage` (clave `pf_pedido_borrador_v1`) todo menos las fotos, en cada cambio;
dura 24 horas. Al volver, una hoja pregunta "¿Seguimos con tu pedido?" (Continuar / Empezar de
nuevo). Solo se restauran productos que sigan en el catálogo, con su precio actual. Un producto
restaurado queda marcado "Falta la foto" y al enviar se abre su sección de fotos.

## Modo demostración

Con `?demo` en la URL se recorre todo sin escribir nada (etiqueta "Vista previa", código
`PF-DEMO-001`, sin borrador). Sirve para mostrar o probar cambios de diseño.

## Pruebas hechas

- En producción con Supabase simulado: compresión (39 MB → 3.6 MB, 2400 px), envío correcto, falla de
  foto (0 pedidos creados), falla al guardar productos seguida de reintento (1 solo pedido, 0 fotos
  re-subidas), borrador (guardar, recargar, continuar, producto sin foto).
- Pedido real de prueba por `pedido-v2.html` (ver Progreso).
- Pendiente: prueba del usuario en iPhone (galería de fotos, WhatsApp/Instagram).

## Reemplazo del formulario actual (hecho el 2026-10-07)

El usuario lo probó en su iPhone y pidió el cambio. El `pedido.html` anterior pasó a
`pedido-anterior.html` (respaldo, `noindex`) y `pedido-v2.html` pasó a ser `pedido.html`, para que
el enlace que ya comparte no cambie. `pedido-v2.html` quedó como redirección a `pedido.html`.
