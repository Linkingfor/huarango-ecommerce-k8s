// Validaciones y límite de intentos por IP. Funciones puras para poder probarlas sin base de datos.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validarRegistro(datos = {}) {
  const errores = [];
  const { nombre, email, password } = datos;
  if (typeof nombre !== 'string' || nombre.trim().length < 2) errores.push('El nombre debe tener al menos 2 caracteres');
  if (typeof email !== 'string' || !EMAIL.test(email.trim())) errores.push('El correo no es válido');
  if (typeof password !== 'string' || password.length < 8) {
    errores.push('La contraseña debe tener al menos 8 caracteres');
  } else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    errores.push('La contraseña debe combinar letras y números');
  }
  return errores;
}

export function validarLogin(datos = {}) {
  const errores = [];
  if (typeof datos.email !== 'string' || !datos.email.trim()) errores.push('Ingresa tu correo');
  if (typeof datos.password !== 'string' || !datos.password) errores.push('Ingresa tu contraseña');
  return errores;
}

// Ventana fija de un minuto por IP. Suficiente para frenar fuerza bruta en el inicio de sesión;
// en producción se movería a reglas de tasa de AWS WAF.
export function crearLimitador(maximo, { ventanaMs = 60000, ahora = () => Date.now() } = {}) {
  const contadores = new Map();
  return (clave) => {
    const t = ahora();
    const actual = contadores.get(clave);
    if (!actual || t - actual.inicio >= ventanaMs) {
      contadores.set(clave, { inicio: t, cuenta: 1 });
      if (contadores.size > 10000) contadores.clear();
      return true;
    }
    actual.cuenta += 1;
    return actual.cuenta <= maximo;
  };
}

export function limitarPorIp(maximo) {
  const permite = crearLimitador(maximo);
  return (req, res, next) => {
    if (permite(req.ip)) return next();
    res.status(429).json({ error: 'DEMASIADOS_INTENTOS', mensaje: 'Demasiados intentos, espera un minuto' });
  };
}
