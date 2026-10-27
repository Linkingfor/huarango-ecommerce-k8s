// Cambia de pantalla usando el hash de la URL (#/carrito, #/pedido/<id>...).
export const ir = (ruta) => { window.location.hash = ruta; };
