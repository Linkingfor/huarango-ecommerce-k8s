#!/usr/bin/env bash
# Funciones compartidas por los scripts. Se carga con: source "$(dirname "$0")/comun.sh"
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGION="${AWS_REGION:-us-east-1}"
TF_DIR="$RAIZ/infra/envs/lab"
# shellcheck disable=SC2034  # la usan los scripts que cargan este archivo
SERVICIOS=(web-frontend svc-usuarios svc-catalogo svc-carrito svc-ordenes svc-pagos svc-notificaciones)

info() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
error() { printf '\033[31mError: %s\033[0m\n' "$*" >&2; exit 1; }

requiere() {
  for cmd in "$@"; do
    command -v "$cmd" >/dev/null 2>&1 || error "falta la herramienta '$cmd'. Revisa los prerrequisitos del README."
  done
}

cuenta_aws() {
  aws sts get-caller-identity --query Account --output text 2>/dev/null \
    || error "no hay credenciales de AWS válidas. Copia las credenciales de AWS Details del Learner Lab."
}

# Lee una salida de Terraform en texto plano (o un campo de un mapa con jq).
tf_salida() {
  if [ $# -eq 1 ]; then
    terraform -chdir="$TF_DIR" output -raw "$1"
  else
    terraform -chdir="$TF_DIR" output -json "$1" | jq -r "$2"
  fi
}

# Valor de un secreto de Secrets Manager (opcionalmente un campo de su JSON).
secreto() {
  local valor
  valor="$(aws secretsmanager get-secret-value --region "$REGION" --secret-id "$1" --query SecretString --output text 2>/dev/null || true)"
  if [ $# -ge 2 ]; then
    printf '%s' "$valor" | jq -r "$2 // empty" 2>/dev/null || true
  else
    printf '%s' "$valor"
  fi
}
