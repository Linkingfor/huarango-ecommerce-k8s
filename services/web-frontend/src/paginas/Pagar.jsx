import { useMemo, useState } from 'react';
import { soles } from '../api.js';
import { useSesion } from '../sesion.jsx';
import { Aviso } from '../componentes/Aviso.jsx';
import { ir } from '../navegacion.js';

// Tarjetas de prueba de la pasarela simulada. Nunca se envía el número completo: solo un token
// con los últimos 4 dígitos, como haría la pasarela real después de tokenizar la tarjeta.
const TARJETAS = [
  { numero: '4111 1111 1111 1111', texto: 'Visa de prueba que se aprueba' },
  { numero: '4000 0000 0000 0002', texto: 'Tarjeta de prueba que el banco rechaza' },
];

export function Pagar() {
  const { carrito, llamar, refrescarCarrito } = useSesion();
  const [entrega, setEntrega] = useState({ direccion: '', distrito: '', ciudad: 'Ica', telefono: '' });
  const [tarjeta, setTarjeta] = useState(TARJETAS[0].numero);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  // Misma clave si el usuario reintenta: el servidor devuelve la misma orden en lugar de crear otra.
  const clave = useMemo(() => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`, []);

  const campo = (nombre) => ({
    value: entrega[nombre],
    onChange: (e) => setEntrega({ ...entrega, [nombre]: e.target.value }),
  });

  async function pagar(evento) {
    evento.preventDefault();
    setEnviando(true);
    setError('');
    try {
      const orden = await llamar('/api/ordenes', {
        metodo: 'POST',
        cabeceras: { 'Idempotency-Key': clave },
        cuerpo: {
          items: carrito.items.map((it) => ({ productoId: it.productoId, cantidad: it.cantidad })),
          entrega,
          pago: { token: `tkn_sim_${tarjeta.replace(/\D/g, '').slice(-4)}` },
        },
      });
      await llamar('/api/carrito', { metodo: 'DELETE' }).catch(() => {});
      await refrescarCarrito();
      ir(`/pedido/${orden.id}`);
    } catch (e) {
      setError(e.message);
      setEnviando(false);
    }
  }

  if (!carrito.items.length) {
    return (
      <section className="hoja">
        <h1>Pagar</h1>
        <p className="vacio">Tu carrito está vacío. <a href="#/">Ver el catálogo</a></p>
      </section>
    );
  }

  return (
    <section className="hoja pagar">
      <h1>Datos de entrega y pago</h1>
      <form onSubmit={pagar} className="formulario">
        <fieldset>
          <legend>¿Dónde entregamos tu pedido?</legend>
          <label>Dirección<input required minLength={5} autoComplete="street-address" {...campo('direccion')} /></label>
          <div className="dos-columnas">
            <label>Distrito<input required {...campo('distrito')} /></label>
            <label>Ciudad<input required autoComplete="address-level2" {...campo('ciudad')} /></label>
          </div>
          <label>Celular<input required inputMode="numeric" placeholder="9XX XXX XXX" autoComplete="tel" {...campo('telefono')} /></label>
        </fieldset>
        <fieldset>
          <legend>Tarjeta</legend>
          {TARJETAS.map((t) => (
            <label key={t.numero} className="opcion">
              <input type="radio" name="tarjeta" value={t.numero} checked={tarjeta === t.numero} onChange={() => setTarjeta(t.numero)} />
              <span><strong>{t.numero}</strong><br />{t.texto}</span>
            </label>
          ))}
          <p className="nota">Entorno de pruebas: no se realiza ningún cargo real.</p>
        </fieldset>
        <Aviso>{error}</Aviso>
        <button className="boton boton-grande" type="submit" disabled={enviando}>
          {enviando ? 'Procesando…' : `Pagar ${soles(carrito.total)}`}
        </button>
      </form>
    </section>
  );
}
