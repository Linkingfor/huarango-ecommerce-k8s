// Cálculos del carrito sin dependencias externas.

export const MAX_UNIDADES = 50;
export const DIAS_DE_VIDA = 7;

// DynamoDB borra solo los ítems cuyo atributo expiraEn (segundos epoch) ya pasó.
export function segundosDeExpiracion(ahora = Date.now(), dias = DIAS_DE_VIDA) {
  return Math.floor(ahora / 1000) + dias * 24 * 60 * 60;
}

const redondear = (n) => Math.round(n * 100) / 100;

export function resumirCarrito(items) {
  const lineas = items
    .map((it) => ({
      productoId: it.productoId,
      nombre: it.nombre,
      precio: Number(it.precio),
      categoria: it.categoria,
      imagen: it.imagen || null,
      cantidad: Number(it.cantidad),
      subtotal: redondear(Number(it.precio) * Number(it.cantidad)),
    }))
    .sort((a, b) => a.productoId.localeCompare(b.productoId));
  return {
    items: lineas,
    unidades: lineas.reduce((s, l) => s + l.cantidad, 0),
    total: redondear(lineas.reduce((s, l) => s + l.subtotal, 0)),
  };
}
