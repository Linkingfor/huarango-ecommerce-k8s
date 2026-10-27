import { test } from 'node:test';
import assert from 'node:assert/strict';
import { armarCorreo } from '../src/plantillas.js';

test('arma el correo de pago confirmado con el monto', () => {
  const c = armarCorreo({ tipo: 'PagoConfirmado', codigo: 'HM-1A2B3C4D', total: 159, nombre: 'Ana Quispe' });
  assert.equal(c.subject, 'Pedido HM-1A2B3C4D confirmado');
  assert.match(c.text, /Hola Ana/);
  assert.match(c.text, /S\/ 159\.00/);
  assert.doesNotMatch(c.text, /<b>/);
});

test('incluye el motivo cuando el pago se rechaza', () => {
  const c = armarCorreo({ tipo: 'PagoRechazado', codigo: 'HM-1', total: 10, motivo: 'Fondos insuficientes' });
  assert.match(c.text, /Fondos insuficientes/);
});

test('avisa los cambios de estado conocidos y omite los demás', () => {
  assert.match(armarCorreo({ tipo: 'EstadoActualizado', estado: 'ENVIADO', codigo: 'HM-1' }).subject, /va en camino/);
  assert.equal(armarCorreo({ tipo: 'EstadoActualizado', estado: 'OTRO' }), null);
  assert.equal(armarCorreo({ tipo: 'Desconocido' }), null);
});
