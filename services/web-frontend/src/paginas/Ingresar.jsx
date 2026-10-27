import { useState } from 'react';
import { api } from '../api.js';
import { useSesion } from '../sesion.jsx';
import { Aviso } from '../componentes/Aviso.jsx';
import { ir } from '../navegacion.js';

export function Ingresar({ volverA = '/', registro = false }) {
  const { entrar } = useSesion();
  const [datos, setDatos] = useState({ nombre: '', email: '', password: '' });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const campo = (nombre) => ({ value: datos[nombre], onChange: (e) => setDatos({ ...datos, [nombre]: e.target.value }) });

  async function enviar(evento) {
    evento.preventDefault();
    setEnviando(true);
    setError('');
    try {
      const ruta = registro ? '/api/usuarios/registro' : '/api/usuarios/login';
      const cuerpo = registro ? datos : { email: datos.email, password: datos.password };
      entrar(await api(ruta, { metodo: 'POST', cuerpo }));
      ir(volverA === '/ingresar' || volverA === '/registro' ? '/' : volverA);
    } catch (e) {
      setError(e.message);
      setEnviando(false);
    }
  }

  return (
    <section className="hoja angosta">
      <h1>{registro ? 'Crea tu cuenta' : 'Ingresa a tu cuenta'}</h1>
      <p className="productor">{registro ? 'Con tu cuenta guardamos tu carrito y puedes seguir tus pedidos.' : 'Necesitas una cuenta para comprar y ver tus pedidos.'}</p>
      <form className="formulario" onSubmit={enviar}>
        {registro && <label>Nombre y apellido<input required autoComplete="name" {...campo('nombre')} /></label>}
        <label>Correo<input type="email" required autoComplete="email" {...campo('email')} /></label>
        <label>Contraseña<input type="password" required minLength={registro ? 8 : 1} autoComplete={registro ? 'new-password' : 'current-password'} {...campo('password')} /></label>
        {registro && <p className="nota">Mínimo 8 caracteres, con letras y números.</p>}
        <Aviso>{error}</Aviso>
        <button className="boton boton-grande" type="submit" disabled={enviando}>
          {enviando ? 'Un momento…' : registro ? 'Crear cuenta' : 'Ingresar'}
        </button>
      </form>
      <p className="cambiar">
        {registro ? <>¿Ya tienes cuenta? <a href="#/ingresar">Ingresa</a></> : <>¿Primera vez? <a href="#/registro">Crea una cuenta</a></>}
      </p>
    </section>
  );
}
