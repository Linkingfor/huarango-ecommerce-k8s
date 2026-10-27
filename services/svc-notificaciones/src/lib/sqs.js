// Lectura y envío de mensajes con Amazon SQS (ElasticMQ en local).
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, SendMessageCommand, GetQueueUrlCommand } from '@aws-sdk/client-sqs';
import { log, esperar } from './log.js';

export function clienteSqs() {
  return new SQSClient({
    region: process.env.AWS_REGION || 'us-east-1',
    ...(process.env.SQS_ENDPOINT ? { endpoint: process.env.SQS_ENDPOINT } : {}),
  });
}

// Acepta la URL completa de la cola (AWS) o solo su nombre (entorno local).
export async function resolverCola(sqs, valor) {
  if (!valor) throw new Error('falta la URL o el nombre de la cola');
  if (valor.startsWith('http')) return valor;
  const r = await sqs.send(new GetQueueUrlCommand({ QueueName: valor }));
  return r.QueueUrl;
}

export async function enviar(sqs, url, cuerpo) {
  await sqs.send(new SendMessageCommand({ QueueUrl: url, MessageBody: JSON.stringify(cuerpo) }));
}

// SNS entrega a SQS el mensaje tal cual (raw) o envuelto en una notificación; se aceptan ambos.
export function leerCuerpo(texto) {
  const cuerpo = JSON.parse(texto);
  if (cuerpo && cuerpo.Type === 'Notification' && typeof cuerpo.Message === 'string') {
    return JSON.parse(cuerpo.Message);
  }
  return cuerpo;
}

// Consume una cola con long polling. Si el manejador falla, el mensaje no se borra: vuelve a la cola
// cuando vence su visibilidad y, tras 5 intentos, SQS lo mueve a la cola de mensajes fallidos (DLQ).
export function consumir({ sqs, url, nombre, manejar }) {
  let activo = true;
  const ciclo = async () => {
    while (activo) {
      try {
        const r = await sqs.send(new ReceiveMessageCommand({
          QueueUrl: url,
          MaxNumberOfMessages: 5,
          WaitTimeSeconds: 20,
        }));
        for (const mensaje of r.Messages || []) {
          try {
            await manejar(leerCuerpo(mensaje.Body), mensaje);
            await sqs.send(new DeleteMessageCommand({ QueueUrl: url, ReceiptHandle: mensaje.ReceiptHandle }));
          } catch (e) {
            log.error(`${nombre}: no se pudo procesar el mensaje, se reintentará`, { error: e.message, id: mensaje.MessageId });
          }
        }
      } catch (e) {
        log.error(`${nombre}: error al leer la cola`, { error: e.message });
        await esperar(5000);
      }
    }
  };
  ciclo();
  return () => { activo = false; };
}
