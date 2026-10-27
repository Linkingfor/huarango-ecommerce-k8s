import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarPedido, calcularTotal, codigoOrden, siguienteEstadoValido } from '../src/reglas.js';
import { conReintentos, Interruptor, ErrorReintentable } from '../src/resiliencia.js';

const pedido = {
  items: [{ productoId: 'P-0101', cantidad: 1 }],
  entrega: { direccion: 'Av. San Martín 450', distrito: 'Ica', ciudad: 'Ica', telefono: '956 123 456' },
  pago: { token: 'tkn_sim_1111' },
};

test('un pedido completo no tiene errores', () => {
  assert.deepEqual(validarPedido(pedido), []);
});

test('detecta celular inválido y carrito vacío', () => {
  const errores = validarPedido({ ...pedido, items: [], entrega: { ...pedido.entrega, telefono: '12345' } });
  assert.equal(errores.length, 2);
});

test('el total se calcula en céntimos', () => {
  assert.equal(calcularTotal([{ precio: 0.1, cantidad: 3 }, { precio: 58, cantidad: 2 }]), 116.3);
});

test('el código de orden es corto y en mayúsculas', () => {
  assert.equal(codigoOrden('3f2a9c1e-0000-4000-8000-000000000000'), 'HM-3F2A9C1E');
});

test('solo se permite avanzar el estado en orden', () => {
  assert.equal(siguienteEstadoValido('PAGADA', 'PREPARANDO'), true);
  assert.equal(siguienteEstadoValido('PAGADA', 'ENTREGADO'), false);
  assert.equal(siguienteEstadoValido('PENDIENTE_PAGO', 'PREPARANDO'), false);
});

test('reintenta errores temporales y se rinde al tercer intento', async () => {
  let llamadas = 0;
  const dormir = async () => {};
  const resultado = await conReintentos(async () => {
    llamadas += 1;
    if (llamadas < 3) throw new ErrorReintentable('temporal');
    return 'ok';
  }, { dormir });
  assert.equal(resultado, 'ok');

  llamadas = 0;
  await assert.rejects(conReintentos(async () => { llamadas += 1; throw new ErrorReintentable('caído'); }, { dormir }));
  assert.equal(llamadas, 3);
});

test('no reintenta errores definitivos', async () => {
  let llamadas = 0;
  await assert.rejects(conReintentos(async () => { llamadas += 1; throw new Error('400'); }, { dormir: async () => {} }));
  assert.equal(llamadas, 1);
});

test('el circuit breaker se abre con 50 % de fallas y se recupera', () => {
  let t = 0;
  const cb = new Interruptor({ minimo: 4, ahora: () => t });
  cb.registrar(true);
  cb.registrar(false);
  cb.registrar(true);
  assert.equal(cb.permite(), true);
  cb.registrar(false);
  assert.equal(cb.permite(), false);
  t = 15000;
  assert.equal(cb.permite(), true);
});
