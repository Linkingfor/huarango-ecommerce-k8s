import { useState } from 'react';
import { soles } from '../api.js';
import { useSesion } from '../sesion.jsx';
import { Ilustracion } from '../componentes/Ilustracion.jsx';
import { Aviso } from '../componentes/Aviso.jsx';

export function Carrito() {
  const { carrito, setCarrito, llamar } = useSesion();
  const [error, setError] = useState('');

  async function cambiar(productoId, cantidad) {
    setError('');
    try {
      setCarrito(await llamar(`/api/carrito/items/${productoId}`, { metodo: 'PUT', cuerpo: { cantidad } }));
    } catch (e) {
      setError(e.message);
    }
  }

  if (!carrito.items.length) {
    return (
      <section className="hoja">
        <h1>Tu carrito</h1>
        <p className="vacio">Todavía no agregaste productos. <a href="#/">Ver el catálogo</a></p>
      </section>
    );
  }

  return (
    <section className="hoja">
      <h1>Tu carrito</h1>
      <Aviso>{error}</Aviso>
      <ul className="lineas">
        {carrito.items.map((it) => (
          <li key={it.productoId} className="linea">
            <Ilustracion categoria={it.categoria} imagen={it.imagen} nombre={it.nombre} />
            <div>
              <p className="linea-nombre">{it.nombre}</p>
              <p className="productor">{soles(it.precio)} c/u</p>
            </div>
            <div className="cantidad" role="group" aria-label={`Cantidad de ${it.nombre}`}>
              <button type="button" onClick={() => cambiar(it.productoId, it.cantidad - 1)} aria-label="Quitar uno">−</button>
              <span aria-live="polite">{it.cantidad}</span>
              <button type="button" onClick={() => cambiar(it.productoId, it.cantidad + 1)} aria-label="Agregar uno">+</button>
            </div>
            <span className="linea-subtotal">{soles(it.subtotal)}</span>
          </li>
        ))}
      </ul>
      <div className="resumen">
        <p>Total <strong>{soles(carrito.total)}</strong></p>
        <p className="nota">El envío a Lima y provincias se coordina por WhatsApp después de la compra.</p>
        <a className="boton boton-grande" href="#/pagar">Ir a pagar</a>
      </div>
    </section>
  );
}
