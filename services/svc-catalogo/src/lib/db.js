// Conexión a PostgreSQL (local en docker compose, Amazon RDS en AWS).
import fs from 'node:fs';
import pg from 'pg';

// Los NUMERIC llegan como texto; se convierten a número para los precios.
pg.types.setTypeParser(1700, (valor) => (valor === null ? null : Number(valor)));

export function crearPool() {
  const modo = process.env.DB_SSL || 'disable';
  let ssl = false;
  if (modo === 'require') ssl = { rejectUnauthorized: false };
  if (modo === 'verify-full') {
    const archivoCa = process.env.DB_CA_FILE || '/etc/ssl/rds/global-bundle.pem';
    ssl = { rejectUnauthorized: true, ca: fs.readFileSync(archivoCa, 'utf8') };
  }
  return new pg.Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl,
    max: Number(process.env.DB_POOL_MAX || 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}

// Lista para recibir tráfico solo cuando la base responde y la migración ya creó la tabla del servicio.
export async function verificarTabla(pool, tabla) {
  const { rows } = await pool.query('SELECT to_regclass($1) IS NOT NULL AS existe', [tabla]);
  if (!rows[0].existe) throw new Error(`la tabla ${tabla} todavía no existe`);
}
