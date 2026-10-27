import { useEffect, useState } from 'react';
import { api, soles, NOMBRES_CATEGORIA } from '../api.js';
import { useSesion } from '../sesion.jsx';
import { Ilustracion } from '../componentes/Ilustracion.jsx';
import { Aviso } from '../componentes/Aviso.jsx';
import { ir } from '../navegacion.js';

function Producto({ producto }) {
  const { usuario, llamar, setCarrito } = useSesion();
  const [estado, setEstado] = useState('libre');
  const [error, setError] = useState('');

  async function agregar() {
    if (!usuario) {
      ir('/ingresar');
      return;
    }
    setEstado('agregando');
    setError('');
    try {
      setCarrito(await llamar('/api/carrito/items', { metodo: 'POST', cuerpo: { productoId: producto.id, cantidad: 1 } }));
      setEstado('agregado');
      setTimeout(() => setEstado('libre'), 1600);
    } catch (e) {
      setError(e.message);
      setEstado('libre');
    }
  }

  const agotado = producto.stock === 0;
  return (
    <article className="producto">
      <Ilustracion categoria={producto.categoria} imagen={producto.imagen} nombre={producto.nombre} />
      <div className="producto-texto">
        <h3>{producto.nombre}</h3>
        <p className="productor">{producto.bodega}</p>
        <p className="descripcion">{producto.descripcion}</p>
      </div>
      <div className="producto-pie">
        <span className="precio">{soles(producto.precio)}</span>
        <button type="button" className="boton" onClick={agregar} disabled={agotado || estado === 'agregando'}>
          {agotado ? 'Agotado' : estado === 'agregado' ? 'Agregado' : 'Agregar al carrito'}
        </button>
      </div>
      <Aviso>{error}</Aviso>
    </article>
  );
}

export function Catalogo() {
  const [categorias, setCategorias] = useState([]);
  const [categoria, setCategoria] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [productos, setProductos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/catalogo/categorias').then(setCategorias).catch(() => setCategorias([]));
  }, []);

  useEffect(() => {
    const filtros = new URLSearchParams();
    if (categoria) filtros.set('categoria', categoria);
    if (busqueda.trim()) filtros.set('q', busqueda.trim());
    const espera = setTimeout(() => {
      api(`/api/catalogo/productos?${filtros}`)
        .then((lista) => { setProductos(lista); setError(''); })
        .catch((e) => setError(e.message));
    }, busqueda ? 250 : 0);
    return () => clearTimeout(espera);
  }, [categoria, busqueda]);

  return (
    <>
      <section className="portada">
        <h1>Piscos, vinos y dulces de Ica, directo del valle a tu casa.</h1>
        <p>Compramos a bodegas y dulcerías artesanales de la región y despachamos a todo el Perú desde nuestro almacén en Ica.</p>
      </section>

      <section className="filtros" aria-label="Filtrar productos">
        <label className="buscador">
          <span className="oculto">Buscar productos</span>
          <input type="search" placeholder="Buscar pisco, tejas, canastas…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </label>
        <div className="chips" role="group" aria-label="Categorías">
          <button type="button" className={!categoria ? 'chip activa' : 'chip'} aria-pressed={!categoria} onClick={() => setCategoria('')}>Todo</button>
          {categorias.map((c) => (
            <button key={c.categoria} type="button" className={categoria === c.categoria ? 'chip activa' : 'chip'}
              aria-pressed={categoria === c.categoria} onClick={() => setCategoria(c.categoria)}>
              {NOMBRES_CATEGORIA[c.categoria] || c.categoria}
            </button>
          ))}
        </div>
      </section>

      <Aviso>{error}</Aviso>
      {productos === null && !error && <p className="cargando">Cargando productos…</p>}
      {productos?.length === 0 && <p className="vacio">No encontramos productos con esa búsqueda. Prueba con otra palabra o elige una categoría.</p>}
      <div className="rejilla">
        {productos?.map((p) => <Producto key={p.id} producto={p} />)}
      </div>
    </>
  );
}
