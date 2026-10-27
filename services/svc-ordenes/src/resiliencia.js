// Reintentos con espera exponencial y circuit breaker para las llamadas a otros servicios.

export class ErrorReintentable extends Error {}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// 3 intentos en total (el original y 2 reintentos). Solo se reintentan errores marcados como reintentables.
export async function conReintentos(fn, { intentos = 3, base = 200, dormir = esperar } = {}) {
  for (let i = 0; i < intentos; i++) {
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof ErrorReintentable) || i === intentos - 1) throw e;
      await dormir(base * 2 ** i + Math.random() * base);
    }
  }
  return undefined;
}

// Se abre si en los últimos 30 s al menos la mitad de 10 o más llamadas falló, y deja pasar
// una llamada de prueba después de 15 s.
export class Interruptor {
  constructor({ ventanaMs = 30000, umbral = 0.5, minimo = 10, enfriamientoMs = 15000, ahora = () => Date.now() } = {}) {
    Object.assign(this, { ventanaMs, umbral, minimo, enfriamientoMs, ahora });
    this.llamadas = [];
    this.abiertoHasta = 0;
  }

  permite() {
    return this.ahora() >= this.abiertoHasta;
  }

  registrar(exito) {
    const t = this.ahora();
    this.llamadas = this.llamadas.filter((l) => t - l.t < this.ventanaMs);
    this.llamadas.push({ t, exito });
    const fallas = this.llamadas.filter((l) => !l.exito).length;
    if (this.llamadas.length >= this.minimo && fallas / this.llamadas.length >= this.umbral) {
      this.abiertoHasta = t + this.enfriamientoMs;
      this.llamadas = [];
    }
  }
}
