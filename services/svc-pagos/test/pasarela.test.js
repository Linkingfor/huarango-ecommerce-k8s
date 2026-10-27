import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decidirSimulado, crearPasarela } from '../src/pasarela.js';

test('la tarjeta de prueba 4111 1111 1111 1111 se aprueba', () => {
  assert.equal(decidirSimulado('tkn_sim_1111').aprobado, true);
});

test('la tarjeta de prueba terminada en 0002 se rechaza', () => {
  const r = decidirSimulado('tkn_sim_0002');
  assert.equal(r.aprobado, false);
  assert.match(r.motivo, /rechazada/);
});

test('un token con otro formato se rechaza', () => {
  assert.equal(decidirSimulado('4111111111111111').aprobado, false);
});

test('la pasarela simulada devuelve una referencia al aprobar', async () => {
  const p = crearPasarela('simulado');
  const r = await p.cobrar({ ordenId: '3f2a9c1e-0000', token: 'tkn_sim_1111' });
  assert.deepEqual(r, { aprobado: true, referencia: 'sim_3f2a9c1e' });
});
