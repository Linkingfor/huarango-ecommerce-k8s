import { useCallback, useEffect, useState } from 'react';
import { soles, ESTADOS, NOMBRES_CATEGORIA } from '../api.js';
import { useSesion } from '../sesion.jsx';
import { Aviso } from '../componentes/Aviso.jsx';

const SIGUIENTE = { PAGADA: 'PREPARANDO', PREPARANDO: 'ENVIADO', ENVIADO: 'ENTREGADO' };
const ACCION = { PREPARANDO: 'Marcar en preparación', ENVIADO: 'Marcar como enviado', ENTREGADO: 'Marcar como entregado' };

function FilaProducto({ producto, alGuardar }) {
  const { llamar } = useSesion();
  const [precio, setPrecio] = useState(producto.precio);
  const [stock, setStock] = useState(producto.stock);
  const [error, setError] = useState('');
  const cambiado = Number(precio) !== producto.precio || Number(stock) !== producto.stock;

  async function guardar(cambios) {
    setError('');
    try {
      alGuardar(await llamar(`/api/catalogo/productos/${producto.id}`, { metodo: 'PUT', cuerpo: cambios }));
    } catch (e) {
      setError(e.message);
    }
  }

  async function subirImagen(e) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    const formulario = new FormData();
    formulario.append('imagen', archivo);
    setError('');
    try {
      alGuardar(await llamar(`/api/catalogo/productos/${producto.id}/imagen`, { metodo: 'POST', formulario }));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <tr className={producto.activo ? undefined : 'inactivo'}>
      <td><span className="codigo">{producto.id}</span></td>
      <td>{producto.nombre}<Aviso>{error}</Aviso></td>
      <td>{NOMBRES_CATEGORIA[producto.categoria]}</td>
      <td><input className="corto" type="number" min="0" step="0.5" value={precio} onChange={(e) => setPrecio(e.target.value)} aria-label={`Precio de ${producto.nombre}`} /></td>
      <td><input className="corto" type="number" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)} aria-label={`Stock de ${producto.nombre}`} /></td>
      <td className="acciones-fila">
        <button type="button" className="boton boton-chico" disabled={!cambiado} onClick={() => guardar({ precio: Number(precio), stock: Number(stock) })}>Guardar</button>
        <label className="boton boton-chico boton-secundario">
          Foto<input type="file" accept="image/jpeg,image/png,image/webp" className="oculto" onChange={subirImagen} />
        </label>
        <button type="button" className="enlace" onClick={() => guardar({ activo: !producto.activo })}>
          {producto.activo ? 'Ocultar' : 'Publicar'}
        </button>
      </td>
    </tr>
  );
}

function NuevoProducto({ alCrear }) {
  const { llamar } = useSesion();
  const vacio = { id: '', nombre: '', categoria: 'piscos', bodega: '', precio: '', stock: '', descripcion: '' };
  const [datos, setDatos] = useState(vacio);
  const [error, setError] = useState('');
  const campo = (n) => ({ value: datos[n], onChange: (e) => setDatos({ ...datos, [n]: e.target.value }) });

  async function crear(e) {
    e.preventDefault();
    setError('');
    try {
      alCrear(await llamar('/api/catalogo/productos', {
        metodo: 'POST',
        cuerpo: { ...datos, id: datos.id.trim().toUpperCase(), precio: Number(datos.precio), stock: Number(datos.stock || 0) },
      }));
      setDatos(vacio);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="formulario tarjeta-formulario" onSubmit={crear}>
      <h2>Nuevo producto</h2>
      <div className="dos-columnas">
        <label>Código (opcional)<input placeholder="P-0701" {...campo('id')} /></label>
        <label>Categoría
          <select {...campo('categoria')}>
            {Object.entries(NOMBRES_CATEGORIA).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>
      </div>
      <label>Nombre<input required minLength={3} {...campo('nombre')} /></label>
      <label>Productor<input {...campo('bodega')} /></label>
      <div className="dos-columnas">
        <label>Precio (S/)<input required type="number" min="0" step="0.5" {...campo('precio')} /></label>
        <label>Stock<input type="number" min="0" step="1" {...campo('stock')} /></label>
      </div>
      <label>Descripción<textarea rows="2" {...campo('descripcion')} /></label>
      <Aviso>{error}</Aviso>
      <button className="boton" type="submit">Crear producto</button>
    </form>
  );
}

function Productos() {
  const { llamar } = useSesion();
  const [productos, setProductos] = useState(null);
  const [error, setError] = useState('');
  const [csv, setCsv] = useState(null);

  const cargar = useCallback(() => {
    llamar('/api/catalogo/admin/productos').then(setProductos).catch((e) => setError(e.message));
  }, [llamar]);
  useEffect(cargar, [cargar]);

  const reemplazar = (p) => setProductos((lista) => lista.map((x) => (x.id === p.id ? p : x)));

  async function subirCsv(e) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    const formulario = new FormData();
    formulario.append('archivo', archivo);
    setCsv(null);
    try {
      setCsv(await llamar('/api/catalogo/stock/csv', { metodo: 'POST', formulario }));
      cargar();
    } catch (err) {
      setError(err.message);
    }
    e.target.value = '';
  }

  return (
    <div className="admin-productos">
      <div>
        <div className="barra">
          <p>{productos ? `${productos.length} productos` : 'Cargando…'}</p>
          <label className="boton boton-secundario">
            Cargar stock desde CSV<input type="file" accept=".csv,text/csv" className="oculto" onChange={subirCsv} />
          </label>
        </div>
        {csv && (
          <Aviso tipo="ok">
            Stock actualizado en {csv.actualizados} productos.
            {csv.noEncontrados.length > 0 && ` No existen: ${csv.noEncontrados.join(', ')}.`}
            {csv.errores.length > 0 && ` Líneas con error: ${csv.errores.length}.`}
          </Aviso>
        )}
        <Aviso>{error}</Aviso>
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead><tr><th>Código</th><th>Producto</th><th>Categoría</th><th>Precio</th><th>Stock</th><th><span className="oculto">Acciones</span></th></tr></thead>
            <tbody>{productos?.map((p) => <FilaProducto key={`${p.id}-${p.precio}-${p.stock}-${p.activo}`} producto={p} alGuardar={reemplazar} />)}</tbody>
          </table>
        </div>
      </div>
      <NuevoProducto alCrear={(p) => setProductos((lista) => [p, ...lista])} />
    </div>
  );
}

function PedidosAdmin() {
  const { llamar } = useSesion();
  const [ordenes, setOrdenes] = useState(null);
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    llamar('/api/ordenes?todas=1').then(setOrdenes).catch((e) => setError(e.message));
  }, [llamar]);
  useEffect(cargar, [cargar]);

  async function avanzar(orden) {
    setError('');
    try {
      const nueva = await llamar(`/api/ordenes/${orden.id}/estado`, { metodo: 'PATCH', cuerpo: { estado: SIGUIENTE[orden.estado] } });
      setOrdenes((lista) => lista.map((o) => (o.id === nueva.id ? nueva : o)));
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <>
      <Aviso>{error}</Aviso>
      {ordenes?.length === 0 && <p className="vacio">Todavía no hay pedidos.</p>}
      <div className="tabla-envoltura">
        <table className="tabla">
          <thead><tr><th>Pedido</th><th>Cliente</th><th>Entrega</th><th>Total</th><th>Estado</th><th><span className="oculto">Acción</span></th></tr></thead>
          <tbody>
            {ordenes?.map((o) => (
              <tr key={o.id}>
                <td><a href={`#/pedido/${o.id}`} className="codigo">{o.codigo}</a></td>
                <td>{o.cliente.nombre}<br /><span className="productor">{o.cliente.email}</span></td>
                <td>{o.entrega.distrito}, {o.entrega.ciudad}<br /><span className="productor">{o.entrega.telefono}</span></td>
                <td>{soles(o.total)}</td>
                <td><span className={`etiqueta estado-${o.estado.toLowerCase()}`}>{ESTADOS[o.estado]}</span></td>
                <td>{SIGUIENTE[o.estado] && <button type="button" className="boton boton-chico" onClick={() => avanzar(o)}>{ACCION[SIGUIENTE[o.estado]]}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function Admin({ seccion }) {
  return (
    <section>
      <h1>Administración de la tienda</h1>
      <nav className="pestanas" aria-label="Secciones de administración">
        <a href="#/admin/productos" className={seccion === 'productos' ? 'activa' : undefined}>Productos y stock</a>
        <a href="#/admin/pedidos" className={seccion === 'pedidos' ? 'activa' : undefined}>Pedidos</a>
      </nav>
      {seccion === 'pedidos' ? <PedidosAdmin /> : <Productos />}
    </section>
  );
}
