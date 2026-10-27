// svc-pagos: worker que toma las órdenes de la cola de pagos, cobra en la pasarela y publica el resultado.
import crypto, { randomUUID } from 'node:crypto';
import client from 'prom-client';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { crearApp, manejarErrores, iniciar } from './lib/http.js';
import { log } from './lib/log.js';
import { clienteSqs, resolverCola, consumir, enviar } from './lib/sqs.js';
import { crearPasarela } from './pasarela.js';

const PUERTO = Number(process.env.PORT || 3005);
const MODO_EVENTOS = process.env.MODO_EVENTOS || 'directo'; // sns en AWS, directo en local

const sqs = clienteSqs();
const sns = new SNSClient({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(process.env.SNS_ENDPOINT ? { endpoint: process.env.SNS_ENDPOINT } : {}),
});
const pasarela = crearPasarela();
const colas = {};
let consumiendo = false;

const { app, registro } = crearApp({
  listo: async () => { if (!consumiendo) throw new Error('todavía no se conecta a la cola de pagos'); },
});
const pagos = new client.Counter({
  name: 'pagos_procesados_total',
  help: 'Pagos procesados por resultado',
  labelNames: ['resultado'],
  registers: [registro],
});

// En AWS se publica una vez en SNS y el tópico lo reparte a las dos colas suscritas.
// En local no hay SNS: se envía directamente a cada cola.
async function publicar(evento) {
  if (MODO_EVENTOS === 'sns') {
    await sns.send(new PublishCommand({
      TopicArn: process.env.SNS_TOPIC_ARN,
      Message: JSON.stringify(evento),
      MessageAttributes: { tipo: { DataType: 'String', StringValue: evento.tipo } },
    }));
  } else {
    await enviar(sqs, colas.ordenesEstado, evento);
    await enviar(sqs, colas.notificaciones, evento);
  }
}

const procesadas = new Map();

async function procesarOrden(evento) {
  if (evento.tipo !== 'OrdenCreada') return;
  const previo = procesadas.get(evento.ordenId);
  const resultado = previo || await pasarela.cobrar({
    ordenId: evento.ordenId,
    monto: evento.total,
    email: evento.email,
    token: evento.pagoToken,
  });
  // Si el mensaje llega repetido no se cobra otra vez: se vuelve a publicar el mismo resultado
  // con el mismo eventoId, y los consumidores lo descartan.
  if (!resultado.eventoId) resultado.eventoId = randomUUID();
  procesadas.set(evento.ordenId, resultado);
  if (procesadas.size > 5000) procesadas.delete(procesadas.keys().next().value);

  await publicar({
    eventoId: resultado.eventoId,
    tipo: resultado.aprobado ? 'PagoConfirmado' : 'PagoRechazado',
    ordenId: evento.ordenId,
    codigo: evento.codigo,
    clienteId: evento.clienteId,
    email: evento.email,
    nombre: evento.nombre,
    total: evento.total,
    referencia: resultado.referencia || null,
    motivo: resultado.motivo || null,
    fecha: new Date().toISOString(),
  });
  pagos.inc({ resultado: resultado.aprobado ? 'aprobado' : 'rechazado' });
  log.info('pago procesado', { orden: evento.ordenId, aprobado: resultado.aprobado });
}

// Webhook de la pasarela: se acepta solo si la firma HMAC coincide con el secreto compartido.
app.post('/api/pagos/webhook', (req, res) => {
  const secreto = process.env.WEBHOOK_SECRET;
  const firma = req.get('x-firma') || '';
  const esperada = secreto && req.cuerpoOriginal
    ? crypto.createHmac('sha256', secreto).update(req.cuerpoOriginal).digest('hex')
    : '';
  const valida = esperada && firma.length === esperada.length
    && crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(esperada));
  if (!valida) return res.status(401).json({ error: 'FIRMA_INVALIDA' });
  log.info('webhook de la pasarela recibido', { tipo: req.body?.type });
  res.json({ recibido: true });
});

manejarErrores(app);
iniciar(app, PUERTO);

(async function arrancar() {
  for (;;) {
    try {
      const colaPagos = await resolverCola(sqs, process.env.COLA_PAGOS_URL);
      if (MODO_EVENTOS !== 'sns') {
        colas.ordenesEstado = await resolverCola(sqs, process.env.Q_ORDENES_ESTADO_URL);
        colas.notificaciones = await resolverCola(sqs, process.env.Q_NOTIFICACIONES_URL);
      }
      consumir({ sqs, url: colaPagos, nombre: 'cola-pagos', manejar: procesarOrden });
      consumiendo = true;
      log.info('escuchando la cola de pagos', { modo: MODO_EVENTOS, pasarela: pasarela.nombre });
      return;
    } catch (e) {
      log.warn('cola de pagos no disponible todavía, se reintenta', { error: e.message });
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
})();
