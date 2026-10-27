// Registro en formato JSON, una línea por evento, para que Fluent Bit y CloudWatch lo puedan filtrar.
const servicio = process.env.SERVICE_NAME || 'servicio';

function escribir(nivel, mensaje, extra = {}) {
  const linea = { t: new Date().toISOString(), nivel, servicio, mensaje, ...extra };
  const salida = nivel === 'error' ? console.error : console.log;
  salida(JSON.stringify(linea));
}

export const log = {
  info: (mensaje, extra) => escribir('info', mensaje, extra),
  warn: (mensaje, extra) => escribir('warn', mensaje, extra),
  error: (mensaje, extra) => escribir('error', mensaje, extra),
};

export const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

// Repite una función hasta que funcione. Se usa al arrancar, mientras la base de datos todavía no responde.
export async function reintentarAlInicio(nombre, fn, { intentos = 30, espera = 2000 } = {}) {
  for (let i = 1; i <= intentos; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === intentos) throw e;
      log.warn(`${nombre}: intento ${i} fallido, se reintenta`, { error: e.message });
      await esperar(espera);
    }
  }
}
