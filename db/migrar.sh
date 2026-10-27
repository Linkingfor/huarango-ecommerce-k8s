#!/bin/sh
# Aplica las migraciones de la base de datos en orden.
# Se usa en dos lugares:
#   - docker compose: el contenedor de PostgreSQL lo ejecuta al crear la base (docker-entrypoint-initdb.d)
#   - Kubernetes: el Job k8s/jobs/migraciones.yaml lo ejecuta contra Amazon RDS
# Las contraseñas de cada servicio llegan como variables de entorno, nunca escritas en el código.
set -e

SQL_DIR="${SQL_DIR:-/docker-entrypoint-initdb.d}"
USUARIO="${PGUSER:-${POSTGRES_USER:-postgres}}"
BASE="${PGDATABASE:-${POSTGRES_DB:-postgres}}"

for archivo in "$SQL_DIR"/*.psql; do
  echo "Aplicando $(basename "$archivo")"
  psql -v ON_ERROR_STOP=1 --username "$USUARIO" --dbname "$BASE" \
    -v pw_usuarios="$DB_PW_USUARIOS" \
    -v pw_catalogo="$DB_PW_CATALOGO" \
    -v pw_ordenes="$DB_PW_ORDENES" \
    -f "$archivo"
done
echo "Migraciones aplicadas"
