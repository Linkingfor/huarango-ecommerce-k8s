// Textos de los correos que recibe el cliente.

const soles = (n) => `S/ ${Number(n).toFixed(2)}`;

const ESTADOS = {
  PREPARANDO: { asunto: 'se está preparando', texto: 'Ya estamos preparando tu pedido en nuestro almacén de Ica.' },
  ENVIADO: { asunto: 'va en camino', texto: 'Tu pedido salió del almacén y va en camino a la dirección de entrega.' },
  ENTREGADO: { asunto: 'fue entregado', texto: 'Tu pedido fue entregado. ¡Gracias por comprar en Huarango Market!' },
};

function html(nombre, parrafos) {
  const cuerpo = parrafos.map((p) => `<p style="margin:0 0 12px">${p}</p>`).join('');
  return `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1d2a33;max-width:520px">
<p style="margin:0 0 12px">Hola ${nombre},</p>${cuerpo}
<p style="margin:24px 0 0;color:#6b7280;font-size:13px">Huarango Market · Ica, Perú</p></div>`;
}

export function armarCorreo(evento) {
  const nombre = (evento.nombre || 'cliente').split(' ')[0];
  const codigo = evento.codigo || '';
  let asunto;
  let parrafos;

  if (evento.tipo === 'PagoConfirmado') {
    asunto = `Pedido ${codigo} confirmado`;
    parrafos = [
      `Recibimos el pago de tu pedido <b>${codigo}</b> por <b>${soles(evento.total)}</b>.`,
      'Te avisaremos cuando salga de nuestro almacén.',
    ];
  } else if (evento.tipo === 'PagoRechazado') {
    asunto = `No pudimos procesar el pago del pedido ${codigo}`;
    parrafos = [
      `El pago de tu pedido <b>${codigo}</b> no fue aprobado${evento.motivo ? `: ${evento.motivo}` : ''}.`,
      'Los productos volvieron a estar disponibles. Puedes intentarlo de nuevo con otra tarjeta.',
    ];
  } else if (evento.tipo === 'EstadoActualizado' && ESTADOS[evento.estado]) {
    asunto = `Tu pedido ${codigo} ${ESTADOS[evento.estado].asunto}`;
    parrafos = [ESTADOS[evento.estado].texto];
  } else {
    return null;
  }

  const texto = [`Hola ${nombre},`, ...parrafos.map((p) => p.replace(/<[^>]+>/g, '')), 'Huarango Market · Ica, Perú'].join('\n\n');
  return { subject: asunto, text: texto, html: html(nombre, parrafos) };
}
