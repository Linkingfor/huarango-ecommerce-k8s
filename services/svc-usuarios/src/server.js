// svc-usuarios: registro, inicio de sesión y emisión de JWT (RS256).
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { crearApp, manejarErrores, iniciar, ErrorHttp } from './lib/http.js';
import { crearPool, verificarTabla } from './lib/db.js';
import { log, reintentarAlInicio } from './lib/log.js';
import { validarRegistro, validarLogin, limitarPorIp } from './validacion.js';

const PUERTO = Number(process.env.PORT || 3001);
const DURACION_TOKEN = process.env.JWT_DURACION || '2h';

const pool = crearPool();
const claves = cargarClaves();

function cargarClaves() {
  const privada = process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (privada) {
    const publica = crypto.createPublicKey(privada).export({ type: 'spki', format: 'pem' });
    return { privada, publica };
  }
  log.warn('JWT_PRIVATE_KEY no está definida: se genera un par de claves temporal (solo para desarrollo local)');
  const par = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { privada: par.privateKey, publica: par.publicKey };
}

function emitirToken(usuario) {
  return jwt.sign(
    { email: usuario.email, nombre: usuario.nombre, rol: usuario.rol },
    claves.privada,
    { algorithm: 'RS256', subject: usuario.id, issuer: 'huarango-market', expiresIn: DURACION_TOKEN },
  );
}

function autenticar(req, res, next) {
  const cabecera = req.get('authorization') || '';
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : null;
  try {
    const datos = jwt.verify(token, claves.publica, { algorithms: ['RS256'], issuer: 'huarango-market' });
    req.usuarioId = datos.sub;
    next();
  } catch {
    res.status(401).json({ error: 'TOKEN_INVALIDO', mensaje: 'Tu sesión expiró, vuelve a ingresar' });
  }
}

const { app } = crearApp({ listo: () => verificarTabla(pool, 'usuarios.usuarios') });

app.post('/api/usuarios/registro', limitarPorIp(20), async (req, res) => {
  const errores = validarRegistro(req.body);
  if (errores.length) throw new ErrorHttp(400, 'DATOS_INVALIDOS', errores.join('. '));
  const email = req.body.email.trim().toLowerCase();
  const hash = await bcrypt.hash(req.body.password, 10);
  try {
    const { rows } = await pool.query(
      'INSERT INTO usuarios.usuarios (email, nombre, hash) VALUES ($1, $2, $3) RETURNING id, email, nombre, rol',
      [email, req.body.nombre.trim(), hash],
    );
    const usuario = rows[0];
    res.status(201).json({ token: emitirToken(usuario), usuario });
  } catch (e) {
    if (e.code === '23505') throw new ErrorHttp(409, 'EMAIL_REGISTRADO', 'Ya existe una cuenta con ese correo');
    throw e;
  }
});

app.post('/api/usuarios/login', limitarPorIp(10), async (req, res) => {
  const errores = validarLogin(req.body);
  if (errores.length) throw new ErrorHttp(400, 'DATOS_INVALIDOS', errores.join('. '));
  const { rows } = await pool.query(
    'SELECT id, email, nombre, rol, hash FROM usuarios.usuarios WHERE email = $1',
    [req.body.email.trim().toLowerCase()],
  );
  const encontrado = rows[0];
  const valido = encontrado && (await bcrypt.compare(req.body.password, encontrado.hash));
  if (!valido) throw new ErrorHttp(401, 'CREDENCIALES_INVALIDAS', 'Correo o contraseña incorrectos');
  const { hash, ...usuario } = encontrado;
  res.json({ token: emitirToken(usuario), usuario });
});

app.get('/api/usuarios/me', autenticar, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, email, nombre, rol, creado_en FROM usuarios.usuarios WHERE id = $1',
    [req.usuarioId],
  );
  if (!rows[0]) throw new ErrorHttp(404, 'NO_ENCONTRADO', 'Usuario no encontrado');
  res.json(rows[0]);
});

// Ruta interna: no pasa por el Ingress ni por el proxy del frontend.
app.get('/internal/clave-publica', (req, res) => res.type('text/plain').send(claves.publica));

manejarErrores(app);

// Crea la cuenta de administrador de la tienda si se configuró y todavía no existe.
async function crearAdministrador() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  const hash = await bcrypt.hash(password, 10);
  const r = await pool.query(
    `INSERT INTO usuarios.usuarios (email, nombre, hash, rol) VALUES ($1, 'Administrador', $2, 'admin')
     ON CONFLICT (email) DO NOTHING`,
    [email.trim().toLowerCase(), hash],
  );
  if (r.rowCount) log.info('cuenta de administrador creada', { email });
}

iniciar(app, PUERTO, () => pool.end());
reintentarAlInicio('crear administrador', crearAdministrador).catch((e) => log.error('no se creó el administrador', { error: e.message }));
