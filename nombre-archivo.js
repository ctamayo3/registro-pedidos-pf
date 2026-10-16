// Nombre del archivo de diseño de un producto, para el botón "Copiar nombre" del panel.
// Formato: "#64-L10 — Ana Pérez 1 de 2 (short_varon_talla_L) [E60000]".
// Un script de Affinity lee de ese nombre el molde (entre paréntesis) y el color (entre corchetes),
// así que el formato no se debe cambiar sin avisar.
//
// Archivo aparte (cargado por el panel con <script src>) para poder probarlo con `node --test`
// sin abrir la página. No toca la base de datos ni el DOM.
(function (root) {
    'use strict';

    // Número visible del pedido: "64-L10" (el pedido se reinicia por lote). Movida tal cual desde
    // index.html para que el título del resumen y el nombre del archivo salgan siempre iguales.
    function formatNumeroPedido(numeroPedido, numeroLote) {
        if (!numeroPedido) return null;
        return numeroLote ? `${numeroPedido}-L${numeroLote}` : `${numeroPedido}`;
    }

    // "#64-L10 — Ana Pérez": el mismo texto del título del resumen del pedido.
    function nombreBasePedido(numeroPedido, numeroLote, cliente) {
        return `#${formatNumeroPedido(numeroPedido, numeroLote) || '?'} — ${cliente || ''}`;
    }

    // Prenda de abajo según el modelo de pijama (no hay un campo propio en la base de datos).
    const PRENDA_ABAJO_POR_VARIANTE = {
        'Manga corta + short': 'short',
        'Manga corta + pantalón': 'pantalon',
        'Manga larga + pantalón': 'pantalon'
    };

    // Molde por prenda de abajo y talla. Para habilitar una talla nueva basta agregar su línea aquí
    // (por ejemplo '12': 'pantalon_talla_12'). Una talla que no está aquí da el aviso "talla sin molde".
    const MOLDES = {
        pantalon:    { S: 'pantalon_talla_S', M: 'pantalon_talla_M', L: 'pantalon_talla_L', XL: 'pantalon_talla_XL', '14': 'pantalon_talla_14' },
        short_varon: { S: 'short_varon_talla_S', M: 'short_varon_talla_M', L: 'short_varon_talla_L', XL: 'short_varon_talla_XL' },
        short_mujer: { S: 'short_mujer_talla_S', M: 'short_mujer_talla_M', L: 'short_mujer_talla_L', XL: 'short_mujer_talla_XL' }
    };

    // Quita los caracteres que Windows no acepta en un nombre de archivo (\ / : * ? " < > | y
    // caracteres de control). Tildes, ñ, "@" y "#" se respetan.
    function limpiarNombreArchivo(texto) {
        return String(texto)
            .replace(/[\\/:*?"<>|\u0000-\u001F]+/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/[ .]+$/, ''); // Windows tampoco acepta que termine en punto o espacio
    }

    // "#e60000", "E60000 " -> "E60000"; cualquier otra cosa -> null.
    function normalizarHex(hex) {
        const limpio = String(hex || '').trim().replace(/^#/, '').toUpperCase();
        return /^[0-9A-F]{6}$/.test(limpio) ? limpio : null;
    }

    // Devuelve { ok: true, nombre } o { ok: false, aviso } (aviso del tipo "Falta talla y color").
    //   pedido:     { numero_pedido, numero_lote, cliente_nombre }
    //   item:       fila de items_pedido ({ tipo_producto, variante, talla, tipo_short, color })
    //   posicion/total: lugar del producto dentro del pedido (1 de 2...). Con total 1 no se agrega nada.
    //   hexDeColor: función código de color -> hex (la pantonera de la app), o null si no lo conoce.
    function nombreArchivoDiseno(pedido, item, posicion, total, hexDeColor) {
        let base = nombreBasePedido(pedido.numero_pedido, pedido.numero_lote, pedido.cliente_nombre);
        if (total > 1) base += ` ${posicion} de ${total}`;

        const prenda = item && item.tipo_producto === 'pijama' ? PRENDA_ABAJO_POR_VARIANTE[item.variante] : null;
        if (!prenda) return { ok: true, nombre: limpiarNombreArchivo(base) }; // producto sin molde

        const faltan = [];
        let clave = prenda;
        if (prenda === 'short') {
            if (item.tipo_short === 'varon' || item.tipo_short === 'mujer') clave = `short_${item.tipo_short}`;
            else faltan.push('tipo de short');
        }

        const talla = String(item.talla || '').trim().toUpperCase();
        let molde = null;
        if (!talla) faltan.push('talla');
        else if (clave !== 'short') molde = (MOLDES[clave] || {})[talla] || null;

        const hex = item.color && typeof hexDeColor === 'function' ? normalizarHex(hexDeColor(item.color)) : null;
        if (!hex) faltan.push('color');

        if (faltan.length) {
            const lista = faltan.length === 1 ? faltan[0] : `${faltan.slice(0, -1).join(', ')} y ${faltan[faltan.length - 1]}`;
            return { ok: false, aviso: `Falta ${lista}` };
        }
        if (!molde) return { ok: false, aviso: `Talla ${talla} sin molde` };

        return { ok: true, nombre: limpiarNombreArchivo(`${base} (${molde}) [${hex}]`) };
    }

    const api = { formatNumeroPedido, nombreBasePedido, nombreArchivoDiseno, limpiarNombreArchivo, MOLDES, PRENDA_ABAJO_POR_VARIANTE };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        root.NombreArchivo = api;
        // El panel usa formatNumeroPedido en muchos lugares: queda disponible igual que antes
        root.formatNumeroPedido = formatNumeroPedido;
        root.nombreBasePedido = nombreBasePedido;
    }
})(typeof window !== 'undefined' ? window : globalThis);
