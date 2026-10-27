// Base HTTP común: Express, sondas de salud, métricas para Prometheus y manejo de errores.
import express from 'express';
import client from 'prom-client';
import { log } from './log.js';

export class ErrorHttp extends Error {
  constructor(status, codigo, mensaje) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
  }
}

export function crearApp({ listo = async () => {} } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);

  const registro = new client.Registry();
  client.collectDefaultMetrics({ register: registro });
  const duracion = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duración de las peticiones HTTP',
    labelNames: ['metodo', 'ruta', 'codigo'],
    buckets: [0.01, 0.025, 0.05, 0.1, 0.2, 0.3, 0.5, 0.8, 1, 2, 5],
    registers: [registro],
  });

  app.use((req, res, next) => {
    const fin = duracion.startTimer();
    res.on('finish', () => {
      const ruta = req.route?.path ? `${req.baseUrl}${req.route.path}` : 'sin_ruta';
      fin({ metodo: req.method, ruta, codigo: res.statusCode });
      if (!req.path.startsWith('/health') && req.path !== '/metrics') {
        log.info('peticion', { metodo: req.method, url: req.originalUrl, codigo: res.statusCode });
      }
    });
    next();
  });

  // Se guarda el cuerpo original para poder verificar firmas (webhook de la pasarela).
  app.use(express.json({ limit: '1mb', verify: (req, res, buf) => { req.cuerpoOriginal = buf; } }));

  app.get('/health/live', (req, res) => res.json({ status: 'ok' }));
  app.get('/health/ready', async (req, res) => {
    try {
      await listo();
      res.json({ status: 'ok' });
    } catch (e) {
      res.status(503).json({ status: 'error', detalle: e.message });
    }
  });
  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', registro.contentType);
    res.end(await registro.metrics());
  });

  return { app, registro };
}

export function manejarErrores(app) {
  app.use((req, res) => res.status(404).json({ error: 'NO_ENCONTRADO', mensaje: 'Ruta no encontrada' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) log.error('error no controlado', { error: err.message, stack: err.stack });
    res.status(status).json({
      error: err.codigo || (status >= 500 ? 'ERROR_INTERNO' : 'SOLICITUD_INVALIDA'),
      mensaje: status >= 500 ? 'Ocurrió un error inesperado, intenta otra vez' : err.message,
    });
  });
}

// Arranca el servidor y lo apaga con orden cuando Kubernetes envía SIGTERM.
export function iniciar(app, puerto, alCerrar = async () => {}) {
  const servidor = app.listen(puerto, () => log.info(`escuchando en el puerto ${puerto}`));
  let cerrando = false;
  const cerrar = (senal) => {
    if (cerrando) return;
    cerrando = true;
    log.info('apagando', { senal });
    servidor.close(async () => {
      await alCerrar().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 10000).unref();
  };
  process.on('SIGTERM', () => cerrar('SIGTERM'));
  process.on('SIGINT', () => cerrar('SIGINT'));
  return servidor;
}
