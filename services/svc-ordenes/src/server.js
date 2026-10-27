// svc-ordenes: checkout, órdenes y su ciclo de estados.
// Reserva el stock en svc-catalogo, guarda la orden y deja el cobro en la cola de pagos (patrón outbox).
import { randomUUID } from 'node:crypto';
import { crearApp, manejarErrores, iniciar, ErrorHttp } from './lib/http.js';
import { crearPool, verificarTabla } from './lib/db.js';
import { requiereAuth } from './lib/auth.js';
import { log } from './lib/log.js';
import { clienteSqs, resolverCola, consumir, enviar } from './lib/sqs.js';
import { Interruptor, conReintentos, ErrorReintentable } from './resiliencia.js';
import { validarPedido, calcularTotal, codigoOrden, siguienteEstadoValido } from './reglas.js';

const PUERTO = Number(process.env.PORT || 3004);
const CATALOGO_URL = process.env.CATALOGO_URL || 'http://svc-catalogo:3002';
const MINUTOS_PARA_PAGAR = Number(process.env.MINUTOS_PARA_PAGAR || 15);

const pool = crearPool();
const sqs = clienteSqs();
const colas = {};
const interruptorCatalogo = new Interruptor();
const autenticado = requiereAuth();
const soloAdmin = requiereAuth({ rol: 'admin' });

const { app } = crearApp({ listo: () => verificarTabla(pool, 'ordenes.ordenes') });

// Llamada a svc-catalogo con timeout de 2 s, 2 reintentos con espera exponencial y circuit breaker.
async function llamarCatalogo(ruta, cuerpo) {
  if (!interruptorCatalogo.permite()) {
    throw new ErrorHttp(503, 'CATALOGO_NO_DISPONIBLE', 'El catálogo no responde, intenta en unos segundos');
  }
  try {
    const respuesta = await conReintentos(async () => {
      let r;
      try {
        r = await fetch(`${CATALOGO_URL}${ruta}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cuerpo || {}),
          signal: AbortSignal.timeout(2000),
        });
      } catch (e) {
        throw new ErrorReintentable(`sin respuesta del catálogo: ${e.message}`);
      }
      if (r.status >= 500) throw new ErrorReintentable(`catálogo respondió ${r.status}`);
      return { status: r.status, cuerpo: await r.json() };
    });
    interruptorCatalogo.registrar(true);
    return respuesta;
  } catch (e) {
    interruptorCatalogo.registrar(false);
    if (e instanceof ErrorReintentable) {
      throw new ErrorHttp(503, 'CATALOGO_NO_DISPONIBLE', 'El catálogo no responde, intenta en unos segundos');
    }
    throw e;
  }
}

function aRespuesta(fila) {
  return {
    id: fila.id,
    codigo: codigoOrden(fila.id),
    estado: fila.estado,
    total: fila.total,
    items: fila.items,
    entrega: fila.entrega,
    cliente: { id: fila.cliente_id, nombre: fila.cliente_nombre, email: fila.cliente_email },
    creadaEn: fila.creada_en,
    actualizadaEn: fila.actualizada_en,
  };
}

// ---------------------------------------------------------------- checkout
app.post('/api/ordenes', autenticado, async (req, res) => {
  const claveIdempotencia = req.get('Idempotency-Key');
  if (!claveIdempotencia || claveIdempotencia.length > 100) {
    throw new ErrorHttp(400, 'FALTA_IDEMPOTENCY_KEY', 'La cabecera Idempotency-Key es obligatoria');
  }
  const errores = validarPedido(req.body);
  if (errores.length) throw new ErrorHttp(400, 'DATOS_INVALIDOS', errores.join('. '));
  const { id: clienteId, email, nombre } = req.usuario;

  // Un reintento del navegador con la misma clave devuelve la misma orden, sin cobrar dos veces.
  const previa = await pool.query(
    'SELECT * FROM ordenes.ordenes WHERE cliente_id = $1 AND idempotency_key = $2',
    [clienteId, claveIdempotencia],
  );
  if (previa.rowCount) return res.status(202).json(aRespuesta(previa.rows[0]));

  const reserva = await llamarCatalogo('/internal/reservas', {
    ordenRef: `${clienteId}:${claveIdempotencia}`,
    items: req.body.items,
  });
  if (reserva.status === 409) throw new ErrorHttp(409, 'SIN_STOCK', reserva.cuerpo.mensaje);
  if (reserva.status >= 400) throw new ErrorHttp(400, 'DATOS_INVALIDOS', reserva.cuerpo.mensaje);

  const items = reserva.cuerpo.items;
  const total = calcularTotal(items);
  const ordenId = randomUUID();
  const cliente = await pool.connect();
  let fila;
  try {
    await cliente.query('BEGIN');
    const r = await cliente.query(
      `INSERT INTO ordenes.ordenes
         (id, cliente_id, cliente_email, cliente_nombre, idempotency_key, total, items, entrega, reserva_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [ordenId, clienteId, email, nombre, claveIdempotencia, total, JSON.stringify(items),
        JSON.stringify(req.body.entrega), reserva.cuerpo.reservaId],
    );
    fila = r.rows[0];
    await cliente.query(
      'INSERT INTO ordenes.outbox (destino, payload) VALUES ($1, $2)',
      ['pagos', JSON.stringify({
        eventoId: randomUUID(),
        tipo: 'OrdenCreada',
        ordenId,
        codigo: codigoOrden(ordenId),
        clienteId,
        email,
        nombre,
        total,
        pagoToken: req.body.pago.token,
        fecha: new Date().toISOString(),
      })],
    );
    await cliente.query('COMMIT');
  } catch (e) {
    await cliente.query('ROLLBACK').catch(() => {});
    if (e.code === '23505') {
      const otra = await pool.query('SELECT * FROM ordenes.ordenes WHERE cliente_id = $1 AND idempotency_key = $2', [clienteId, claveIdempotencia]);
      return res.status(202).json(aRespuesta(otra.rows[0]));
    }
    await llamarCatalogo(`/internal/reservas/${reserva.cuerpo.reservaId}/liberar`).catch(() => {});
    throw e;
  } finally {
    cliente.release();
  }
  log.info('orden creada', { orden: ordenId, total });
  res.status(202).json(aRespuesta(fila));
});

// ---------------------------------------------------------------- consultas
app.get('/api/ordenes', autenticado, async (req, res) => {
  const todas = req.query.todas === '1' && req.usuario.rol === 'admin';
  const { rows } = todas
    ? await pool.query('SELECT * FROM ordenes.ordenes ORDER BY creada_en DESC LIMIT 200')
    : await pool.query('SELECT * FROM ordenes.ordenes WHERE cliente_id = $1 ORDER BY creada_en DESC LIMIT 50', [req.usuario.id]);
  res.json(rows.map(aRespuesta));
});

app.get('/api/ordenes/:id', autenticado, async (req, res) => {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) throw new ErrorHttp(404, 'NO_ENCONTRADO', 'Orden no encontrada');
  const { rows } = await pool.query('SELECT * FROM ordenes.ordenes WHERE id = $1', [req.params.id]);
  const fila = rows[0];
  if (!fila || (fila.cliente_id !== req.usuario.id && req.usuario.rol !== 'admin')) {
    throw new ErrorHttp(404, 'NO_ENCONTRADO', 'Orden no encontrada');
  }
  res.json(aRespuesta(fila));
});

// El administrador avanza la orden: PAGADA → PREPARANDO → ENVIADO → ENTREGADO.
app.patch('/api/ordenes/:id/estado', soloAdmin, async (req, res) => {
  const nuevo = req.body?.estado;
  const cliente = await pool.connect();
  let fila;
  try {
    await cliente.query('BEGIN');
    const actual = await cliente.query('SELECT * FROM ordenes.ordenes WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!actual.rowCount) throw new ErrorHttp(404, 'NO_ENCONTRADO', 'Orden no encontrada');
    if (!siguienteEstadoValido(actual.rows[0].estado, nuevo)) {
      throw new ErrorHttp(409, 'TRANSICION_INVALIDA', `No se puede pasar de ${actual.rows[0].estado} a ${nuevo}`);
    }
    const r = await cliente.query(
      'UPDATE ordenes.ordenes SET estado = $2, actualizada_en = now() WHERE id = $1 RETURNING *',
      [req.params.id, nuevo],
    );
    fila = r.rows[0];
    await cliente.query('INSERT INTO ordenes.outbox (destino, payload) VALUES ($1, $2)', ['notificaciones', JSON.stringify({
      eventoId: randomUUID(),
      tipo: 'EstadoActualizado',
      ordenId: fila.id,
      codigo: codigoOrden(fila.id),
      estado: nuevo,
      email: fila.cliente_email,
      nombre: fila.cliente_nombre,
      total: fila.total,
      fecha: new Date().toISOString(),
    })]);
    await cliente.query('COMMIT');
  } catch (e) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    cliente.release();
  }
  res.json(aRespuesta(fila));
});

manejarErrores(app);

// ---------------------------------------------------------------- procesos en segundo plano
// Publica en SQS los mensajes pendientes del outbox. SKIP LOCKED permite varias réplicas sin duplicar envíos.
async function publicarOutbox() {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const { rows } = await cliente.query(
      'SELECT id, destino, payload FROM ordenes.outbox WHERE enviado_en IS NULL ORDER BY id LIMIT 20 FOR UPDATE SKIP LOCKED',
    );
    for (const fila of rows) {
      await enviar(sqs, colas[fila.destino], fila.payload);
      await cliente.query('UPDATE ordenes.outbox SET enviado_en = now() WHERE id = $1', [fila.id]);
    }
    await cliente.query('COMMIT');
  } catch (e) {
    await cliente.query('ROLLBACK').catch(() => {});
    log.error('no se pudo publicar el outbox', { error: e.message });
  } finally {
    cliente.release();
  }
}

// Resultado del cobro que llega desde SNS por la cola q-ordenes-estado.
async function aplicarResultadoPago(evento) {
  if (!['PagoConfirmado', 'PagoRechazado'].includes(evento.tipo)) return;
  const cliente = await pool.connect();
  let fila;
  try {
    await cliente.query('BEGIN');
    const nuevo = await cliente.query(
      'INSERT INTO ordenes.eventos_procesados (evento_id) VALUES ($1) ON CONFLICT DO NOTHING',
      [evento.eventoId],
    );
    const estado = evento.tipo === 'PagoConfirmado' ? 'PAGADA' : 'PAGO_RECHAZADO';
    if (!nuevo.rowCount) {
      // Evento repetido: la orden ya se actualizó. Se repite solo la llamada al catálogo, que es idempotente,
      // por si la vez anterior falló después de guardar.
      const r = await cliente.query('SELECT id, reserva_id FROM ordenes.ordenes WHERE id = $1 AND estado = $2', [evento.ordenId, estado]);
      await cliente.query('COMMIT');
      fila = r.rows[0];
      if (fila) await llamarCatalogo(`/internal/reservas/${fila.reserva_id}/${estado === 'PAGADA' ? 'confirmar' : 'liberar'}`);
      return;
    }
    const r = await cliente.query(
      `UPDATE ordenes.ordenes SET estado = $2, pago_ref = $3, actualizada_en = now()
       WHERE id = $1 AND estado = 'PENDIENTE_PAGO' RETURNING id, reserva_id`,
      [evento.ordenId, estado, evento.referencia || null],
    );
    fila = r.rows[0];
    await cliente.query('COMMIT');
  } catch (e) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    cliente.release();
  }
  if (fila) {
    const accion = evento.tipo === 'PagoConfirmado' ? 'confirmar' : 'liberar';
    await llamarCatalogo(`/internal/reservas/${fila.reserva_id}/${accion}`);
    log.info('estado de pago aplicado', { orden: fila.id, tipo: evento.tipo });
  }
}

// Si el pago no llega en 15 minutos la orden expira y el stock reservado vuelve al catálogo.
async function expirarOrdenes() {
  try {
    const { rows } = await pool.query(
      `UPDATE ordenes.ordenes SET estado = 'EXPIRADA', actualizada_en = now()
       WHERE estado = 'PENDIENTE_PAGO' AND creada_en < now() - make_interval(mins => $1)
       RETURNING id, reserva_id`,
      [MINUTOS_PARA_PAGAR],
    );
    for (const fila of rows) {
      await llamarCatalogo(`/internal/reservas/${fila.reserva_id}/liberar`).catch((e) => log.error('no se liberó la reserva', { error: e.message }));
      log.warn('orden expirada sin pago', { orden: fila.id });
    }
  } catch (e) {
    log.error('no se pudieron revisar las órdenes vencidas', { error: e.message });
  }
}

async function arrancarProcesos() {
  colas.pagos = await resolverCola(sqs, process.env.COLA_PAGOS_URL);
  colas.notificaciones = await resolverCola(sqs, process.env.COLA_NOTIFICACIONES_URL);
  const colaEstado = await resolverCola(sqs, process.env.Q_ORDENES_ESTADO_URL);
  setInterval(publicarOutbox, 1000).unref();
  setInterval(expirarOrdenes, 60000).unref();
  consumir({ sqs, url: colaEstado, nombre: 'q-ordenes-estado', manejar: aplicarResultadoPago });
  log.info('procesos en segundo plano iniciados');
}

iniciar(app, PUERTO, () => pool.end());
(async function arrancar() {
  for (;;) {
    try {
      await arrancarProcesos();
      return;
    } catch (e) {
      log.warn('colas no disponibles todavía, se reintenta', { error: e.message });
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
})();
