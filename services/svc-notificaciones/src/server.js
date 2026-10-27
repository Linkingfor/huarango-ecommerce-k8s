// svc-notificaciones: worker que lee q-notificaciones y envía correos al cliente.
import client from 'prom-client';
import nodemailer from 'nodemailer';
import { crearApp, manejarErrores, iniciar } from './lib/http.js';
import { log } from './lib/log.js';
import { clienteSqs, resolverCola, consumir } from './lib/sqs.js';
import { armarCorreo } from './plantillas.js';

const PUERTO = Number(process.env.PORT || 3006);

const sqs = clienteSqs();
const correo = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: Number(process.env.SMTP_PORT || 1025),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  connectionTimeout: 10000,
});
const remitente = process.env.MAIL_FROM || 'Huarango Market <pedidos@huarango.pe>';
let consumiendo = false;

const { app, registro } = crearApp({
  listo: async () => { if (!consumiendo) throw new Error('todavía no se conecta a la cola de notificaciones'); },
});
const enviados = new client.Counter({
  name: 'correos_enviados_total',
  help: 'Correos enviados por tipo de evento',
  labelNames: ['tipo'],
  registers: [registro],
});

const vistos = new Set();

async function notificar(evento) {
  if (vistos.has(evento.eventoId)) return; // SQS entrega al menos una vez
  const mensaje = armarCorreo(evento);
  if (!mensaje) return;
  await correo.sendMail({ from: remitente, to: evento.email, ...mensaje });
  vistos.add(evento.eventoId);
  if (vistos.size > 10000) vistos.clear();
  enviados.inc({ tipo: evento.tipo });
  log.info('correo enviado', { tipo: evento.tipo, orden: evento.ordenId });
}

manejarErrores(app);
iniciar(app, PUERTO);

(async function arrancar() {
  for (;;) {
    try {
      const url = await resolverCola(sqs, process.env.Q_NOTIFICACIONES_URL);
      consumir({ sqs, url, nombre: 'q-notificaciones', manejar: notificar });
      consumiendo = true;
      log.info('escuchando la cola de notificaciones');
      return;
    } catch (e) {
      log.warn('cola de notificaciones no disponible todavía, se reintenta', { error: e.message });
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
})();
