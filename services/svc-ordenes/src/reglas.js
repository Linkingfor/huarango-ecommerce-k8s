// Reglas de negocio de las órdenes, sin dependencias externas.

const TELEFONO = /^9\d{8}$/;

export function validarPedido(cuerpo = {}) {
  const errores = [];
  const { items, entrega, pago } = cuerpo;
  if (!Array.isArray(items) || items.length === 0) errores.push('El carrito está vacío');
  if (!entrega || typeof entrega !== 'object') {
    errores.push('Faltan los datos de entrega');
  } else {
    if (!entrega.direccion || String(entrega.direccion).trim().length < 5) errores.push('Ingresa una dirección válida');
    if (!entrega.distrito || !String(entrega.distrito).trim()) errores.push('Ingresa el distrito');
    if (!entrega.ciudad || !String(entrega.ciudad).trim()) errores.push('Ingresa la ciudad');
    if (!TELEFONO.test(String(entrega.telefono || '').replace(/\s/g, ''))) errores.push('El celular debe tener 9 dígitos y empezar con 9');
  }
  if (!pago || typeof pago.token !== 'string' || !pago.token) errores.push('Falta el token de pago');
  return errores;
}

export function calcularTotal(items) {
  const centavos = items.reduce((s, it) => s + Math.round(Number(it.precio) * 100) * Number(it.cantidad), 0);
  return centavos / 100;
}

export function codigoOrden(id) {
  return `HM-${String(id).slice(0, 8).toUpperCase()}`;
}

const FLUJO = { PAGADA: 'PREPARANDO', PREPARANDO: 'ENVIADO', ENVIADO: 'ENTREGADO' };

export function siguienteEstadoValido(actual, nuevo) {
  return FLUJO[actual] === nuevo;
}
