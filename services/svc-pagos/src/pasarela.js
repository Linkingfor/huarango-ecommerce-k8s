// Adaptadores de pasarela de pagos.
// - simulado: para desarrollo y la demo. Aprueba todo excepto la tarjeta de prueba terminada en 0002.
// - culqi: cobro real contra la API de Culqi con la llave secreta de pruebas (sk_test_...).
import { log } from './lib/log.js';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export function decidirSimulado(token) {
  if (typeof token !== 'string' || !token.startsWith('tkn_sim_')) {
    return { aprobado: false, motivo: 'Token de pago inválido' };
  }
  if (token.endsWith('0002')) {
    return { aprobado: false, motivo: 'Tarjeta rechazada por el banco emisor (tarjeta de prueba)' };
  }
  return { aprobado: true };
}

function simulado({ demoraMs = 400 } = {}) {
  return {
    nombre: 'simulado',
    async cobrar({ ordenId, token }) {
      await esperar(demoraMs);
      const decision = decidirSimulado(token);
      return { ...decision, referencia: decision.aprobado ? `sim_${String(ordenId).slice(0, 8)}` : null };
    },
  };
}

function culqi() {
  const llave = process.env.CULQI_SECRET_KEY;
  if (!llave) throw new Error('falta CULQI_SECRET_KEY para usar la pasarela culqi');
  return {
    nombre: 'culqi',
    async cobrar({ ordenId, monto, email, token }) {
      const r = await fetch('https://api.culqi.com/v2/charges', {
        method: 'POST',
        headers: { Authorization: `Bearer ${llave}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.round(Number(monto) * 100),
          currency_code: 'PEN',
          email,
          source_id: token,
          metadata: { ordenId },
        }),
        signal: AbortSignal.timeout(5000),
      });
      const cuerpo = await r.json().catch(() => ({}));
      if (r.ok) return { aprobado: true, referencia: cuerpo.id };
      if (r.status >= 500) throw new Error(`la pasarela respondió ${r.status}`); // se reintenta vía SQS
      log.warn('cargo rechazado por la pasarela', { orden: ordenId, codigo: cuerpo.code });
      return { aprobado: false, motivo: cuerpo.user_message || 'La pasarela rechazó el cargo' };
    },
  };
}

export function crearPasarela(modo = process.env.PASARELA_MODO || 'simulado') {
  return modo === 'culqi' ? culqi() : simulado();
}
