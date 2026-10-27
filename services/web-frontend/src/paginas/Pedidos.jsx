import { useEffect, useState } from 'react';
import { soles, ESTADOS } from '../api.js';
import { useSesion } from '../sesion.jsx';
import { Aviso } from '../componentes/Aviso.jsx';

const fecha = (iso) => new Date(iso).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' });
const PASOS = [
  ['RECIBIDO', 'Pedido recibido'],
  ['PAGADA', 'Pagado'],
  ['PREPARANDO', 'En preparación'],
  ['ENVIADO', 'En camino'],
  ['ENTREGADO', 'Entregado'],
];

export function Pedido({ id }) {
  const { llamar } = useSesion();
  const [orden, setOrden] = useState(null);
  const [error, setError] = useState('');

  // El pago se procesa en segundo plano: se consulta el estado cada 2 s mientras siga pendiente.
  useEffect(() => {
    let activo = true;
    let espera;
    const consultar = async () => {
      try {
        const o = await llamar(`/api/ordenes/${id}`);
        if (!activo) return;
        setOrden(o);
        if (o.estado === 'PENDIENTE_PAGO') espera = setTimeout(consultar, 2000);
      } catch (e) {
        if (activo) setError(e.message);
      }
    };
    consultar();
    return () => { activo = false; clearTimeout(espera); };
  }, [id, llamar]);

  if (error) return <section className="hoja"><Aviso>{error}</Aviso></section>;
  if (!orden) return <section className="hoja"><p className="cargando">Cargando pedido…</p></section>;

  const fallida = ['PAGO_RECHAZADO', 'EXPIRADA'].includes(orden.estado);
  const pendiente = orden.estado === 'PENDIENTE_PAGO';
  // Pasos completados: mientras se confirma el pago solo está hecho "Pedido recibido".
  const hechos = pendiente ? 1 : PASOS.findIndex(([estado]) => estado === orden.estado) + 1;

  return (
    <section className="hoja">
      <h1>Pedido {orden.codigo}</h1>
      <p className="productor">Realizado el {fecha(orden.creadaEn)}</p>
      {fallida ? (
        <Aviso>{orden.estado === 'PAGO_RECHAZADO'
          ? 'El banco no aprobó el pago. Los productos volvieron al catálogo y puedes intentarlo con otra tarjeta.'
          : 'El pedido venció porque el pago no se confirmó a tiempo.'}</Aviso>
      ) : (
        <ol className="pasos" aria-label="Estado del pedido">
          {PASOS.map(([estado, texto], i) => {
            const actual = pendiente && i === hechos;
            return (
              <li key={estado} className={i < hechos ? 'hecho' : actual ? 'actual' : undefined} aria-current={actual ? 'step' : undefined}>
                {actual ? 'Confirmando pago' : texto}
              </li>
            );
          })}
        </ol>
      )}
      {orden.estado === 'PENDIENTE_PAGO' && <p className="nota" aria-live="polite">Estamos confirmando el pago con el banco. Esta página se actualiza sola.</p>}
      {orden.estado === 'PAGADA' && <Aviso tipo="ok">Pago confirmado. Te enviamos un correo con el resumen.</Aviso>}
      <ul className="lineas compactas">
        {orden.items.map((it) => (
          <li key={it.productoId} className="linea">
            <span className="linea-nombre">{it.cantidad} × {it.nombre}</span>
            <span className="linea-subtotal">{soles(it.precio * it.cantidad)}</span>
          </li>
        ))}
      </ul>
      <div className="resumen">
        <p>Total <strong>{soles(orden.total)}</strong></p>
        <p className="nota">Entrega en {orden.entrega.direccion}, {orden.entrega.distrito}, {orden.entrega.ciudad}.</p>
      </div>
    </section>
  );
}

export function Pedidos() {
  const { llamar } = useSesion();
  const [ordenes, setOrdenes] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    llamar('/api/ordenes').then(setOrdenes).catch((e) => setError(e.message));
  }, [llamar]);

  return (
    <section className="hoja">
      <h1>Mis pedidos</h1>
      <Aviso>{error}</Aviso>
      {ordenes?.length === 0 && <p className="vacio">Aún no tienes pedidos. <a href="#/">Ver el catálogo</a></p>}
      <ul className="lineas">
        {ordenes?.map((o) => (
          <li key={o.id} className="linea">
            <a href={`#/pedido/${o.id}`} className="linea-nombre">{o.codigo}</a>
            <span className="productor">{fecha(o.creadaEn)}</span>
            <span className={`etiqueta estado-${o.estado.toLowerCase()}`}>{ESTADOS[o.estado]}</span>
            <span className="linea-subtotal">{soles(o.total)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
