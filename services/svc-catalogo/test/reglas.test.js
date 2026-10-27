import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agruparItems, parsearCsvStock, validarProducto } from '../src/reglas.js';

test('agrupa productos repetidos y ordena por código', () => {
  const { lineas, errores } = agruparItems([
    { productoId: 'P-0301', cantidad: 2 },
    { productoId: 'P-0101', cantidad: 1 },
    { productoId: 'P-0301', cantidad: 3 },
  ]);
  assert.deepEqual(errores, []);
  assert.deepEqual(lineas, [
    { productoId: 'P-0101', cantidad: 1 },
    { productoId: 'P-0301', cantidad: 5 },
  ]);
});

test('rechaza cantidades inválidas y pedidos vacíos', () => {
  assert.equal(agruparItems([]).errores.length, 1);
  assert.equal(agruparItems([{ productoId: 'P-0101', cantidad: 0 }]).errores.length, 1);
  assert.equal(agruparItems([{ productoId: 'P-0101', cantidad: 51 }]).errores.length, 1);
});

test('lee el CSV de stock con encabezado y reporta líneas malas', () => {
  const { filas, errores } = parsearCsvStock('id,stock\nP-0101,40\nP-0102;12\n\nP-0103,-1\n');
  assert.deepEqual(filas, [{ id: 'P-0101', stock: 40 }, { id: 'P-0102', stock: 12 }]);
  assert.equal(errores.length, 1);
});

test('valida productos nuevos y cambios parciales', () => {
  assert.deepEqual(validarProducto({ nombre: 'Pisco Italia', categoria: 'piscos', precio: 60 }, { nuevo: true }), []);
  assert.equal(validarProducto({ nombre: 'X', categoria: 'otros', precio: -1 }, { nuevo: true }).length, 3);
  assert.deepEqual(validarProducto({ stock: 10 }, { nuevo: false }), []);
  assert.equal(validarProducto({ stock: 1.5 }, { nuevo: false }).length, 1);
});
