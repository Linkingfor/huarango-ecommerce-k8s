import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarRegistro, validarLogin, crearLimitador } from '../src/validacion.js';

test('acepta un registro válido', () => {
  assert.deepEqual(validarRegistro({ nombre: 'Ana Quispe', email: 'ana@correo.pe', password: 'pisco2026' }), []);
});

test('rechaza correo y contraseña débiles', () => {
  const errores = validarRegistro({ nombre: 'A', email: 'ana@', password: 'corta' });
  assert.equal(errores.length, 3);
});

test('exige letras y números en la contraseña', () => {
  const errores = validarRegistro({ nombre: 'Ana', email: 'ana@correo.pe', password: 'solamenteletras' });
  assert.deepEqual(errores, ['La contraseña debe combinar letras y números']);
});

test('el login requiere correo y contraseña', () => {
  assert.equal(validarLogin({}).length, 2);
  assert.equal(validarLogin({ email: 'a@b.pe', password: 'x' }).length, 0);
});

test('el limitador corta al pasar el máximo y se reinicia con la ventana', () => {
  let t = 0;
  const permite = crearLimitador(2, { ventanaMs: 1000, ahora: () => t });
  assert.equal(permite('1.1.1.1'), true);
  assert.equal(permite('1.1.1.1'), true);
  assert.equal(permite('1.1.1.1'), false);
  assert.equal(permite('2.2.2.2'), true);
  t = 1000;
  assert.equal(permite('1.1.1.1'), true);
});
