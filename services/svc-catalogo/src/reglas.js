// Reglas del catálogo sin dependencias externas, para poder probarlas con node --test.

export const CATEGORIAS = ['piscos', 'vinos', 'tejas', 'chocotejas', 'dulces', 'canastas'];
const MAX_POR_PRODUCTO = 50;

// Une líneas repetidas del mismo producto y las ordena por código. El orden fijo evita bloqueos
// cruzados entre dos compras que reservan los mismos productos al mismo tiempo.
export function agruparItems(items) {
  const errores = [];
  if (!Array.isArray(items) || items.length === 0) return { lineas: [], errores: ['La orden no tiene productos'] };
  const mapa = new Map();
  for (const item of items) {
    const id = typeof item?.productoId === 'string' ? item.productoId.trim() : '';
    const cantidad = Number(item?.cantidad);
    if (!id) { errores.push('Hay un producto sin código'); continue; }
    if (!Number.isInteger(cantidad) || cantidad < 1) { errores.push(`Cantidad inválida para ${id}`); continue; }
    mapa.set(id, (mapa.get(id) || 0) + cantidad);
  }
  for (const [id, cantidad] of mapa) {
    if (cantidad > MAX_POR_PRODUCTO) errores.push(`Máximo ${MAX_POR_PRODUCTO} unidades de ${id} por pedido`);
  }
  const lineas = [...mapa.entries()]
    .map(([productoId, cantidad]) => ({ productoId, cantidad }))
    .sort((a, b) => a.productoId.localeCompare(b.productoId));
  return { lineas, errores };
}

// Lee un CSV "id,stock" (con o sin encabezado). Devuelve las filas válidas y los errores por línea.
export function parsearCsvStock(texto) {
  const filas = [];
  const errores = [];
  texto.split(/\r?\n/).forEach((linea, i) => {
    const limpia = linea.trim();
    if (!limpia) return;
    const [id, stock] = limpia.split(/[;,]/).map((c) => c?.trim());
    if (i === 0 && /^id$/i.test(id)) return;
    const numero = Number(stock);
    if (!id || stock === undefined || !Number.isInteger(numero) || numero < 0) {
      errores.push(`Línea ${i + 1}: "${limpia}" no es válida`);
      return;
    }
    filas.push({ id, stock: numero });
  });
  return { filas, errores };
}

export function validarProducto(p = {}, { nuevo }) {
  const errores = [];
  if (nuevo || p.nombre !== undefined) {
    if (typeof p.nombre !== 'string' || p.nombre.trim().length < 3) errores.push('El nombre debe tener al menos 3 caracteres');
  }
  if (nuevo || p.categoria !== undefined) {
    if (!CATEGORIAS.includes(p.categoria)) errores.push(`La categoría debe ser una de: ${CATEGORIAS.join(', ')}`);
  }
  if (nuevo || p.precio !== undefined) {
    const precio = Number(p.precio);
    if (!Number.isFinite(precio) || precio < 0) errores.push('El precio debe ser un número positivo');
  }
  if (p.stock !== undefined) {
    const stock = Number(p.stock);
    if (!Number.isInteger(stock) || stock < 0) errores.push('El stock debe ser un número entero positivo');
  }
  if (p.activo !== undefined && typeof p.activo !== 'boolean') errores.push('El campo activo debe ser verdadero o falso');
  if (p.id !== undefined && p.id !== '' && !/^[A-Z0-9-]{3,20}$/.test(String(p.id))) {
    errores.push('El código solo admite mayúsculas, números y guiones');
  }
  return errores;
}
