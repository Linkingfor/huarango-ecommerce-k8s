// Cliente HTTP de la tienda. Todas las rutas son relativas: el proxy (nginx o el Ingress) las envía
// al microservicio que corresponde según el prefijo /api/<servicio>.

export class ErrorApi extends Error {
  constructor(status, cuerpo) {
    super(cuerpo?.mensaje || 'No se pudo completar la acción. Revisa tu conexión e intenta de nuevo.');
    this.status = status;
    this.codigo = cuerpo?.error;
  }
}

export async function api(ruta, { metodo = 'GET', cuerpo, token, cabeceras = {}, formulario } = {}) {
  const headers = { ...cabeceras };
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (formulario) {
    body = formulario;
  } else if (cuerpo !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(cuerpo);
  }
  let respuesta;
  try {
    respuesta = await fetch(ruta, { method: metodo, headers, body });
  } catch {
    throw new ErrorApi(0, null);
  }
  const texto = await respuesta.text();
  let datos = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = null;
  }
  if (!respuesta.ok) throw new ErrorApi(respuesta.status, datos);
  return datos;
}

export const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

export const NOMBRES_CATEGORIA = {
  piscos: 'Piscos',
  vinos: 'Vinos',
  tejas: 'Tejas',
  chocotejas: 'Chocotejas',
  dulces: 'Dulces y pecanas',
  canastas: 'Canastas',
};

export const ESTADOS = {
  PENDIENTE_PAGO: 'Pago en proceso',
  PAGADA: 'Pagado',
  PAGO_RECHAZADO: 'Pago rechazado',
  EXPIRADA: 'Venció sin pago',
  PREPARANDO: 'En preparación',
  ENVIADO: 'En camino',
  ENTREGADO: 'Entregado',
};
