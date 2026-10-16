// Pruebas del nombre de archivo de diseño. Correr con:  node --test tests/
// Datos ficticios; los HEX se pasan con un diccionario de prueba en vez de la pantonera real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { nombreArchivoDiseno, limpiarNombreArchivo, MOLDES } = require('../nombre-archivo.js');

const COLORES = { R01: '#E60000', S01: '#FFC0CB', G01: '#2b2b2b' };
const hexDeColor = codigo => COLORES[codigo] || null;
const pedido = (numero, cliente) => ({ numero_pedido: numero, numero_lote: 10, cliente_nombre: cliente });
const pijamaShort = (extra) => ({ tipo_producto: 'pijama', variante: 'Manga corta + short', ...extra });
const pijamaPantalon = (extra) => ({ tipo_producto: 'pijama', variante: 'Manga corta + pantalón', ...extra });

test('short de varón, talla L', () => {
    const r = nombreArchivoDiseno(pedido(64, 'Ana Pérez'), pijamaShort({ tipo_short: 'varon', talla: 'L', color: 'R01' }), 1, 1, hexDeColor);
    assert.deepEqual(r, { ok: true, nombre: '#64-L10 — Ana Pérez (short_varon_talla_L) [E60000]' });
});

test('short de mujer, talla S', () => {
    const r = nombreArchivoDiseno(pedido(59, 'Luis Soto'), pijamaShort({ tipo_short: 'mujer', talla: 'S', color: 'S01' }), 1, 1, hexDeColor);
    assert.deepEqual(r, { ok: true, nombre: '#59-L10 — Luis Soto (short_mujer_talla_S) [FFC0CB]' });
});

test('pantalón, talla 14 (el HEX sale en mayúsculas y sin #)', () => {
    const r = nombreArchivoDiseno(pedido(70, 'Eva Ríos'), pijamaPantalon({ talla: '14', color: 'G01' }), 1, 1, hexDeColor);
    assert.deepEqual(r, { ok: true, nombre: '#70-L10 — Eva Ríos (pantalon_talla_14) [2B2B2B]' });
});

test('polo de algodón, prenda 1 de 2: solo el nombre, sin molde ni color', () => {
    const r = nombreArchivoDiseno(pedido(61, 'Marca Ejemplo'), { tipo_producto: 'polo', variante: 'Polo de algodón', talla: 'M' }, 1, 2, hexDeColor);
    assert.deepEqual(r, { ok: true, nombre: '#61-L10 — Marca Ejemplo 1 de 2' });
});

test('producto con molde sin color guardado: aviso y no hay nombre', () => {
    const r = nombreArchivoDiseno(pedido(64, 'Ana Pérez'), pijamaShort({ tipo_short: 'varon', talla: 'L', color: null }), 1, 1, hexDeColor);
    assert.deepEqual(r, { ok: false, aviso: 'Falta color' });
});

test('color antiguo escrito a mano ("azul oscuro"): falta color', () => {
    const r = nombreArchivoDiseno(pedido(64, 'Ana Pérez'), pijamaPantalon({ talla: 'M', color: 'azul oscuro' }), 1, 1, hexDeColor);
    assert.deepEqual(r, { ok: false, aviso: 'Falta color' });
});

test('falta talla', () => {
    const r = nombreArchivoDiseno(pedido(64, 'Ana Pérez'), pijamaPantalon({ talla: '', color: 'R01' }), 1, 1, hexDeColor);
    assert.deepEqual(r, { ok: false, aviso: 'Falta talla' });
});

test('faltan talla y color a la vez', () => {
    const r = nombreArchivoDiseno(pedido(64, 'Ana Pérez'), pijamaPantalon({ talla: null, color: null }), 1, 1, hexDeColor);
    assert.deepEqual(r, { ok: false, aviso: 'Falta talla y color' });
});

test('short sin varón/mujer (pedido antiguo): falta tipo de short', () => {
    const r = nombreArchivoDiseno(pedido(64, 'Ana Pérez'), pijamaShort({ tipo_short: null, talla: 'L', color: 'R01' }), 1, 1, hexDeColor);
    assert.deepEqual(r, { ok: false, aviso: 'Falta tipo de short' });
});

test('tallas sin molde: pantalón 12, short 12 y short 14', () => {
    const casos = [
        pijamaPantalon({ talla: '12', color: 'R01' }),
        pijamaShort({ tipo_short: 'mujer', talla: '12', color: 'R01' }),
        pijamaShort({ tipo_short: 'varon', talla: '14', color: 'R01' })
    ];
    for (const item of casos) {
        const r = nombreArchivoDiseno(pedido(64, 'Ana Pérez'), item, 1, 1, hexDeColor);
        assert.equal(r.ok, false);
        assert.match(r.aviso, /sin molde/);
    }
});

test('talla escrita a mano en minúscula y con espacios cuenta igual ("l " = L)', () => {
    const r = nombreArchivoDiseno(pedido(64, 'Ana Pérez'), pijamaShort({ tipo_short: 'varon', talla: ' l ', color: 'R01' }), 1, 1, hexDeColor);
    assert.equal(r.nombre, '#64-L10 — Ana Pérez (short_varon_talla_L) [E60000]');
});

test('manga larga + pantalón usa el molde de pantalón', () => {
    const r = nombreArchivoDiseno(pedido(64, 'Ana Pérez'), { tipo_producto: 'pijama', variante: 'Manga larga + pantalón', talla: 'XL', color: 'R01' }, 1, 1, hexDeColor);
    assert.equal(r.nombre, '#64-L10 — Ana Pérez (pantalon_talla_XL) [E60000]');
});

test('pedido de 2 prendas con molde: "2 de 2" va antes del paréntesis', () => {
    const r = nombreArchivoDiseno(pedido(61, 'Bitter Glow'), pijamaPantalon({ talla: 'M', color: 'R01' }), 2, 2, hexDeColor);
    assert.equal(r.nombre, '#61-L10 — Bitter Glow 2 de 2 (pantalon_talla_M) [E60000]');
});

test('caracteres inválidos en Windows se quitan; tildes, ñ y @ se respetan', () => {
    const r = nombreArchivoDiseno(pedido(64, '@peña/ "Ñandú": <x>?|*'), { tipo_producto: 'tote_bag', variante: 'Tote bag' }, 1, 1, hexDeColor);
    assert.equal(r.nombre, '#64-L10 — @peña Ñandú x');
    assert.equal(limpiarNombreArchivo('a\\b/c:d*e?f"g<h>i|j'), 'abcdefghij');
});

test('todos los moldes de la tabla tienen el formato acordado', () => {
    for (const [prenda, tallas] of Object.entries(MOLDES)) {
        for (const [talla, molde] of Object.entries(tallas)) assert.equal(molde, `${prenda}_talla_${talla}`);
    }
});
