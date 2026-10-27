// svc-catalogo: productos, búsqueda, imágenes y reservas de stock.
import multer from 'multer';
import { crearApp, manejarErrores, iniciar, ErrorHttp } from './lib/http.js';
import { crearPool, verificarTabla } from './lib/db.js';
import { requiereAuth } from './lib/auth.js';
import { log } from './lib/log.js';
import { crearAlmacen } from './almacen.js';
import { agruparItems, parsearCsvStock, validarProducto } from './reglas.js';

const PUERTO = Number(process.env.PORT || 3002);
const CAMPOS = 'id, nombre, descripcion, categoria, bodega, precio, stock, imagen, activo';
// Orden de la vitrina: primero lo que más vende la tienda.
const ORDEN = "array_position(ARRAY['piscos','vinos','tejas','chocotejas','dulces','canastas'], categoria)";

const pool = crearPool();
const almacen = crearAlmacen();
const subida = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });
const soloAdmin = requiereAuth({ rol: 'admin' });

const { app } = crearApp({ listo: () => verificarTabla(pool, 'catalogo.productos') });

app.get('/api/catalogo/health', (req, res) => res.json({ status: 'ok' }));

app.get('/api/catalogo/categorias', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT categoria, count(*)::int AS productos FROM catalogo.productos WHERE activo GROUP BY categoria ORDER BY ${ORDEN}`,
  );
  res.set('Cache-Control', 'public, max-age=60').json(rows);
});

app.get('/api/catalogo/productos', async (req, res) => {
  const { q, categoria, bodega, min, max } = req.query;
  const condiciones = ['activo'];
  const valores = [];
  const param = (valor) => { valores.push(valor); return `$${valores.length}`; };
  if (q) {
    const texto = param(`%${q}%`);
    condiciones.push(`(nombre ILIKE ${texto} OR descripcion ILIKE ${texto})`);
  }
  if (categoria) condiciones.push(`categoria = ${param(categoria)}`);
  if (bodega) condiciones.push(`bodega = ${param(bodega)}`);
  if (min && !Number.isNaN(Number(min))) condiciones.push(`precio >= ${param(Number(min))}`);
  if (max && !Number.isNaN(Number(max))) condiciones.push(`precio <= ${param(Number(max))}`);
  const { rows } = await pool.query(
    `SELECT ${CAMPOS} FROM catalogo.productos WHERE ${condiciones.join(' AND ')} ORDER BY ${ORDEN}, nombre`,
    valores,
  );
  res.set('Cache-Control', 'public, max-age=60').json(rows);
});

app.get('/api/catalogo/productos/:id', async (req, res) => {
  const { rows } = await pool.query(`SELECT ${CAMPOS} FROM catalogo.productos WHERE id = $1`, [req.params.id]);
  if (!rows[0] || !rows[0].activo) throw new ErrorHttp(404, 'NO_ENCONTRADO', 'Producto no encontrado');
  res.json(rows[0]);
});

// ---------------------------------------------------------------- administración
app.get('/api/catalogo/admin/productos', soloAdmin, async (req, res) => {
  const { rows } = await pool.query(`SELECT ${CAMPOS} FROM catalogo.productos ORDER BY ${ORDEN}, nombre`);
  res.json(rows);
});

app.post('/api/catalogo/productos', soloAdmin, async (req, res) => {
  const errores = validarProducto(req.body, { nuevo: true });
  if (errores.length) throw new ErrorHttp(400, 'DATOS_INVALIDOS', errores.join('. '));
  const p = req.body;
  const id = p.id?.trim() || `P-${Date.now().toString(36).toUpperCase()}`;
  try {
    const { rows } = await pool.query(
      `INSERT INTO catalogo.productos (id, nombre, descripcion, categoria, bodega, precio, stock)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${CAMPOS}`,
      [id, p.nombre.trim(), p.descripcion || '', p.categoria, p.bodega || '', Number(p.precio), Number(p.stock || 0)],
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') throw new ErrorHttp(409, 'ID_DUPLICADO', `Ya existe un producto con el código ${id}`);
    throw e;
  }
});

app.put('/api/catalogo/productos/:id', soloAdmin, async (req, res) => {
  const errores = validarProducto(req.body, { nuevo: false });
  if (errores.length) throw new ErrorHttp(400, 'DATOS_INVALIDOS', errores.join('. '));
  const permitidos = ['nombre', 'descripcion', 'categoria', 'bodega', 'precio', 'stock', 'activo'];
  const cambios = permitidos.filter((c) => req.body[c] !== undefined);
  if (!cambios.length) throw new ErrorHttp(400, 'SIN_CAMBIOS', 'No se envió ningún cambio');
  const sets = cambios.map((c, i) => `${c} = $${i + 2}`);
  const { rows } = await pool.query(
    `UPDATE catalogo.productos SET ${sets.join(', ')}, actualizado_en = now() WHERE id = $1 RETURNING ${CAMPOS}`,
    [req.params.id, ...cambios.map((c) => req.body[c])],
  );
  if (!rows[0]) throw new ErrorHttp(404, 'NO_ENCONTRADO', 'Producto no encontrado');
  res.json(rows[0]);
});

app.post('/api/catalogo/productos/:id/imagen', soloAdmin, subida.single('imagen'), async (req, res) => {
  const tipos = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  if (!req.file || !tipos[req.file.mimetype]) throw new ErrorHttp(400, 'IMAGEN_INVALIDA', 'Sube una imagen JPG, PNG o WEBP de hasta 2 MB');
  const existe = await pool.query('SELECT 1 FROM catalogo.productos WHERE id = $1', [req.params.id]);
  if (!existe.rowCount) throw new ErrorHttp(404, 'NO_ENCONTRADO', 'Producto no encontrado');
  const clave = `media/productos/${req.params.id.toLowerCase()}-${Date.now()}.${tipos[req.file.mimetype]}`;
  await almacen.guardar(clave, req.file.buffer, req.file.mimetype);
  const { rows } = await pool.query(
    `UPDATE catalogo.productos SET imagen = $2, actualizado_en = now() WHERE id = $1 RETURNING ${CAMPOS}`,
    [req.params.id, `/${clave}`],
  );
  res.json(rows[0]);
});

// Carga de stock desde el sistema de caja de las tiendas: un CSV con "id,stock" por línea.
app.post('/api/catalogo/stock/csv', soloAdmin, subida.single('archivo'), async (req, res) => {
  const texto = req.file ? req.file.buffer.toString('utf8') : req.body?.csv;
  if (!texto) throw new ErrorHttp(400, 'SIN_ARCHIVO', 'Adjunta el archivo CSV de stock');
  const { filas, errores } = parsearCsvStock(texto);
  const cliente = await pool.connect();
  let actualizados = 0;
  const noEncontrados = [];
  try {
    await cliente.query('BEGIN');
    for (const f of filas) {
      const r = await cliente.query('UPDATE catalogo.productos SET stock = $2, actualizado_en = now() WHERE id = $1', [f.id, f.stock]);
      if (r.rowCount) actualizados += 1; else noEncontrados.push(f.id);
    }
    await cliente.query('COMMIT');
  } catch (e) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    cliente.release();
  }
  res.json({ actualizados, noEncontrados, errores });
});

// Imágenes de productos. En AWS, CloudFront las entrega directo desde S3; esta ruta sirve en local
// y cuando se accede al clúster con port-forward.
app.get('/media/*ruta', async (req, res) => {
  const clave = `media/${[].concat(req.params.ruta).join('/')}`;
  const archivo = await almacen.leer(clave);
  if (!archivo) throw new ErrorHttp(404, 'NO_ENCONTRADO', 'Imagen no encontrada');
  res.set('Content-Type', archivo.tipo || 'application/octet-stream');
  res.set('Cache-Control', 'public, max-age=86400');
  archivo.cuerpo.pipe(res);
});

// ---------------------------------------------------------------- reservas (uso interno de svc-ordenes)
app.post('/internal/reservas', async (req, res) => {
  const { ordenRef, items } = req.body || {};
  const { lineas, errores } = agruparItems(items);
  if (!ordenRef || errores.length) throw new ErrorHttp(400, 'DATOS_INVALIDOS', errores.join('. ') || 'Falta ordenRef');

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const previa = await cliente.query('SELECT id, items FROM catalogo.reservas WHERE orden_ref = $1', [ordenRef]);
    if (previa.rowCount) {
      await cliente.query('COMMIT');
      return res.json({ reservaId: previa.rows[0].id, items: previa.rows[0].items });
    }
    const detalle = [];
    for (const linea of lineas) {
      // La condición stock >= cantidad evita vender lo que no hay, aun con compras simultáneas.
      const r = await cliente.query(
        `UPDATE catalogo.productos SET stock = stock - $2, actualizado_en = now()
         WHERE id = $1 AND activo AND stock >= $2 RETURNING id, nombre, precio`,
        [linea.productoId, linea.cantidad],
      );
      if (!r.rowCount) {
        await cliente.query('ROLLBACK');
        return res.status(409).json({ error: 'SIN_STOCK', productoId: linea.productoId, mensaje: `No hay stock suficiente de ${linea.productoId}` });
      }
      detalle.push({ productoId: r.rows[0].id, nombre: r.rows[0].nombre, precio: r.rows[0].precio, cantidad: linea.cantidad });
    }
    const nueva = await cliente.query(
      'INSERT INTO catalogo.reservas (orden_ref, items) VALUES ($1, $2) RETURNING id',
      [ordenRef, JSON.stringify(detalle)],
    );
    await cliente.query('COMMIT');
    res.status(201).json({ reservaId: nueva.rows[0].id, items: detalle });
  } catch (e) {
    await cliente.query('ROLLBACK').catch(() => {});
    if (e.code === '23505') {
      // Otra réplica creó la misma reserva al mismo tiempo: se devuelve esa.
      const previa = await pool.query('SELECT id, items FROM catalogo.reservas WHERE orden_ref = $1', [ordenRef]);
      return res.json({ reservaId: previa.rows[0].id, items: previa.rows[0].items });
    }
    throw e;
  } finally {
    cliente.release();
  }
});

async function cerrarReserva(id, estadoFinal) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const r = await cliente.query(
      `UPDATE catalogo.reservas SET estado = $2, actualizada_en = now() WHERE id = $1 AND estado = 'ACTIVA' RETURNING items`,
      [id, estadoFinal],
    );
    if (r.rowCount && estadoFinal === 'LIBERADA') {
      for (const item of r.rows[0].items) {
        await cliente.query('UPDATE catalogo.productos SET stock = stock + $2, actualizado_en = now() WHERE id = $1', [item.productoId, item.cantidad]);
      }
    }
    await cliente.query('COMMIT');
    return r.rowCount > 0;
  } catch (e) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    cliente.release();
  }
}

app.post('/internal/reservas/:id/confirmar', async (req, res) => {
  res.json({ cambiada: await cerrarReserva(req.params.id, 'CONFIRMADA') });
});

app.post('/internal/reservas/:id/liberar', async (req, res) => {
  const cambiada = await cerrarReserva(req.params.id, 'LIBERADA');
  if (cambiada) log.info('reserva liberada', { reserva: req.params.id });
  res.json({ cambiada });
});

manejarErrores(app);
iniciar(app, PUERTO, () => pool.end());
