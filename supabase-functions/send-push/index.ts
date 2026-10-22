// Edge Function: send-push
// Envia una notificacion push a TODOS los celulares suscritos (tabla push_subscriptions).
// Se llama desde tres lugares:
//   1. Un Database Webhook de Supabase en gastos_lote (INSERT) -> Supabase manda el
//      payload estandar { type, table, record, ... } y esta funcion arma el mensaje sola.
//   2. Un cron diario (entregas proximas) -> se le manda { title, body } directo.
//   3. Dos Database Webhooks (INSERT) en notas_pedido y notas_generales -> avisa de cada nota nueva.
//
// Requiere el secreto VAPID_PRIVATE_KEY configurado en esta funcion (Supabase ya
// inyecta SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY automaticamente, no hace falta
// configurarlos a mano).

import webpush from "https://esm.sh/web-push@3.6.7";

const VAPID_PUBLIC_KEY = "BJFJh9qlGAWgnDmjgBJyke4x3B6vQHJl57A2IlDGykDz2AVafcXB09j4PCpAmXvO28IkIxxh1SquBJV0fTETGCQ";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

webpush.setVapidDetails("mailto:cesartamayo660@gmail.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

function recortar(texto: string, max = 110) {
    const t = String(texto || "").replace(/\s+/g, " ").trim();
    return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

async function construirMensaje(payload: any) {
    // Caso 1: viene de un Database Webhook sobre gastos_lote
    if (payload.table === "gastos_lote" && payload.record) {
        const g = payload.record;
        const monto = Number(g.monto || 0).toFixed(2);
        return {
            title: "Nuevo gasto registrado",
            body: `${g.insumo}: S/ ${monto}${g.nota ? " — " + g.nota : ""}`,
            url: "/",
        };
    }
    // Caso 1b: nota nueva pegada a un pedido. Se busca el cliente y el numero para decir de cual es.
    if (payload.table === "notas_pedido" && payload.type === "INSERT" && payload.record) {
        const n = payload.record;
        let donde = "un pedido";
        try {
            const r = await fetch(
                `${SUPABASE_URL}/rest/v1/pedidos?id=eq.${encodeURIComponent(n.pedido_id)}&select=cliente_nombre,numero_pedido,lotes(numero)`,
                { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } }
            );
            const p = (await r.json())[0];
            if (p) donde = `#${p.numero_pedido}${p.lotes ? `-L${p.lotes.numero}` : ""} — ${p.cliente_nombre}`;
        } catch (_) {
            // si falla la busqueda, se avisa igual, solo sin el nombre del cliente
        }
        return {
            title: `Nota de ${n.autor || "alguien"}`,
            body: `${donde}: ${recortar(n.texto)}`,
            url: "/",
        };
    }
    // Caso 1c: nota general nueva (no ligada a un pedido)
    if (payload.table === "notas_generales" && payload.type === "INSERT" && payload.record) {
        const n = payload.record;
        return {
            title: `Nota de ${n.autor || "alguien"}`,
            body: recortar(n.texto),
            url: "/",
        };
    }
    // Caso 2: mensaje directo (cron de entregas proximas, pruebas manuales, etc)
    return {
        title: payload.title || "Peludos Factory",
        body: payload.body || "",
        url: payload.url || "/",
    };
}

Deno.serve(async (req) => {
    try {
        const payload = await req.json();
        const { title, body, url } = await construirMensaje(payload);

        const subsRes = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?select=*`, {
            headers: {
                apikey: SERVICE_ROLE_KEY,
                Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            },
        });
        const subs = await subsRes.json();

        const notifPayload = JSON.stringify({ title, body, url });

        const results = await Promise.allSettled(
            (subs || []).map((s: any) =>
                webpush
                    .sendNotification(
                        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                        notifPayload
                    )
                    .catch(async (err: any) => {
                        // Suscripcion vencida/invalida (celular desinstalo, etc): la borramos
                        if (err.statusCode === 404 || err.statusCode === 410) {
                            await fetch(
                                `${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`,
                                {
                                    method: "DELETE",
                                    headers: {
                                        apikey: SERVICE_ROLE_KEY,
                                        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
                                    },
                                }
                            );
                        }
                        throw err;
                    })
            )
        );

        return new Response(JSON.stringify({ sent: results.length }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
});
