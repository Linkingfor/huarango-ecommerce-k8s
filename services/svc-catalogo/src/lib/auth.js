// Verificación de JWT firmados con RS256 por svc-usuarios.
// La clave pública llega por variable de entorno (Kubernetes) o se pide a svc-usuarios (docker compose).
import jwt from 'jsonwebtoken';
import { log } from './log.js';

const desdeEntorno = process.env.JWT_PUBLIC_KEY ? process.env.JWT_PUBLIC_KEY.replace(/\\n/g, '\n') : null;
let clavePublica = desdeEntorno;

async function obtenerClave({ renovar = false } = {}) {
  if (clavePublica && !renovar) return clavePublica;
  const url = `${process.env.USUARIOS_URL || 'http://svc-usuarios:3001'}/internal/clave-publica`;
  const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
  if (!r.ok) throw new Error(`clave pública no disponible (${r.status})`);
  clavePublica = await r.text();
  return clavePublica;
}

function verificar(token, clave) {
  return jwt.verify(token, clave, { algorithms: ['RS256'], issuer: 'huarango-market' });
}

export function requiereAuth({ rol } = {}) {
  return async (req, res, next) => {
    const cabecera = req.get('authorization') || '';
    const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'NO_AUTENTICADO', mensaje: 'Inicia sesión para continuar' });
    }
    let datos;
    try {
      datos = verificar(token, await obtenerClave());
    } catch (e) {
      // Si svc-usuarios se reinició en local, su clave temporal cambió: se pide de nuevo una sola vez.
      if (!desdeEntorno && e.name === 'JsonWebTokenError') {
        try {
          datos = verificar(token, await obtenerClave({ renovar: true }));
        } catch {
          datos = null;
        }
      } else if (!(e.name === 'JsonWebTokenError' || e.name === 'TokenExpiredError')) {
        log.error('no se pudo validar el token', { error: e.message });
        return res.status(503).json({ error: 'AUTENTICACION_NO_DISPONIBLE', mensaje: 'Intenta en unos segundos' });
      }
    }
    if (!datos) {
      return res.status(401).json({ error: 'TOKEN_INVALIDO', mensaje: 'Tu sesión expiró, vuelve a ingresar' });
    }
    if (rol && datos.rol !== rol) {
      return res.status(403).json({ error: 'SIN_PERMISO', mensaje: 'No tienes permiso para esta acción' });
    }
    req.usuario = { id: datos.sub, email: datos.email, nombre: datos.nombre, rol: datos.rol };
    next();
  };
}
