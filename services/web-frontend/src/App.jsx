import { useEffect, useState } from 'react';
import { useSesion } from './sesion.jsx';
import { Catalogo } from './paginas/Catalogo.jsx';
import { Carrito } from './paginas/Carrito.jsx';
import { Pagar } from './paginas/Pagar.jsx';
import { Pedido, Pedidos } from './paginas/Pedidos.jsx';
import { Ingresar } from './paginas/Ingresar.jsx';
import { Admin } from './paginas/Admin.jsx';
import { ir } from './navegacion.js';

// Navegación por hash (#/carrito): funciona igual detrás de nginx, del Ingress o de un port-forward.
function useRuta() {
  const leer = () => window.location.hash.replace(/^#/, '') || '/';
  const [ruta, setRuta] = useState(leer);
  useEffect(() => {
    const cambio = () => { setRuta(leer()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', cambio);
    return () => window.removeEventListener('hashchange', cambio);
  }, []);
  return ruta;
}


function Pagina({ ruta }) {
  const { usuario, esAdmin } = useSesion();
  const [, seccion, parametro] = ruta.split('/');
  const requiereSesion = ['carrito', 'pagar', 'pedidos', 'pedido', 'admin'].includes(seccion);
  if (requiereSesion && !usuario) return <Ingresar volverA={ruta} />;
  switch (seccion) {
    case '': return <Catalogo />;
    case 'carrito': return <Carrito />;
    case 'pagar': return <Pagar />;
    case 'pedidos': return <Pedidos />;
    case 'pedido': return <Pedido id={parametro} />;
    case 'ingresar': return <Ingresar volverA="/" />;
    case 'registro': return <Ingresar volverA="/" registro />;
    case 'admin': return esAdmin ? <Admin seccion={parametro || 'productos'} /> : <Catalogo />;
    default: return <Catalogo />;
  }
}

function Marca() {
  return (
    <a className="marca" href="#/" aria-label="Huarango Market, ir al catálogo">
      <svg viewBox="0 0 32 32" width="34" height="34" aria-hidden="true">
        <rect width="32" height="32" rx="7" fill="#23412E" />
        <path d="M16 6c-5 0-8 3.5-8 7.5 0 2.2 1.2 3.6 3 4.3-.6 1.2-.8 2.7-.6 4.2h2.2c-.3-1.7 0-3.1.9-4 .8.3 1.6.4 2.5.4s1.7-.1 2.5-.4c.9.9 1.2 2.3.9 4h2.2c.2-1.5 0-3-.6-4.2 1.8-.7 3-2.1 3-4.3C24 9.5 21 6 16 6z" fill="#B7D3A8" />
        <rect x="15" y="17" width="2" height="9" fill="#B7D3A8" />
      </svg>
      <span>Huarango<br />Market</span>
    </a>
  );
}

export function App() {
  const ruta = useRuta();
  const { usuario, esAdmin, salir, carrito } = useSesion();
  const activa = (prefijo) => (ruta === prefijo || ruta.startsWith(`${prefijo}/`) ? 'activa' : undefined);

  return (
    <>
      <header className="cabecera">
        <div className="contenedor cabecera-fila">
          <Marca />
          <nav className="menu" aria-label="Principal">
            <a href="#/" className={ruta === '/' ? 'activa' : undefined}>Catálogo</a>
            {usuario && <a href="#/pedidos" className={activa('/pedidos')}>Mis pedidos</a>}
            {esAdmin && <a href="#/admin" className={activa('/admin')}>Administración</a>}
          </nav>
          <div className="acciones">
            <a href="#/carrito" className="boton-carrito" aria-label={`Carrito, ${carrito.unidades} productos`}>
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L20.5 8H6.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><circle cx="10" cy="19.5" r="1.4" fill="currentColor" /><circle cx="17" cy="19.5" r="1.4" fill="currentColor" /></svg>
              Carrito
              {carrito.unidades > 0 && <span className="contador">{carrito.unidades}</span>}
            </a>
            {usuario
              ? <button type="button" className="enlace" onClick={() => { salir(); ir('/'); }}>Salir</button>
              : <a href="#/ingresar" className="enlace">Ingresar</a>}
          </div>
        </div>
      </header>
      <main className="contenedor principal">
        <Pagina ruta={ruta} />
      </main>
      <footer className="pie">
        <div className="contenedor">
          <p>Huarango Market S.A.C. Tiendas en Ica y Paracas, despacho a todo el Perú.</p>
          <p>Prohibida la venta de bebidas alcohólicas a menores de 18 años.</p>
        </div>
      </footer>
    </>
  );
}
