import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumirCarrito, segundosDeExpiracion } from '../src/carrito.js';

test('calcula subtotales, unidades y total sin errores de redondeo', () => {
  const r = resumirCarrito([
    { productoId: 'P-0301', nombre: 'Tejas', precio: 30, cantidad: 3 },
    { productoId: 'P-0101', nombre: 'Pisco', precio: 58.1, cantidad: 1 },
  ]);
  assert.equal(r.unidades, 4);
  assert.equal(r.total, 148.1);
  assert.equal(r.items[0].productoId, 'P-0101');
  assert.equal(r.items[1].subtotal, 90);
});

test('un carrito vacío suma cero', () => {
  assert.deepEqual(resumirCarrito([]), { items: [], unidades: 0, total: 0 });
});

test('la expiración queda 7 días después', () => {
  assert.equal(segundosDeExpiracion(0), 7 * 24 * 3600);
});
