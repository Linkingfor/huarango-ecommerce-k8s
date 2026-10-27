// Mensajes de error y de confirmación. role="alert" hace que los lectores de pantalla los anuncien.
export function Aviso({ tipo = 'error', children }) {
  if (!children) return null;
  return <p className={`aviso aviso-${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>{children}</p>;
}
