#!/usr/bin/env bash
# Carga en Secrets Manager las credenciales externas que no van en el código (opcional).
# Sin SMTP configurado, los correos se ven en Mailpit dentro del clúster.
# Uso:
#   SMTP_HOST=... SMTP_PORT=587 SMTP_USER=... SMTP_PASS=... ./scripts/cargar-secretos.sh smtp
#   CULQI_SECRET_KEY=sk_test_... ./scripts/cargar-secretos.sh culqi
# shellcheck source=scripts/comun.sh
source "$(dirname "$0")/comun.sh"
requiere aws jq

case "${1:-}" in
  smtp)
    : "${SMTP_HOST:?define SMTP_HOST}" "${SMTP_USER:?define SMTP_USER}" "${SMTP_PASS:?define SMTP_PASS}"
    valor="$(jq -n --arg h "$SMTP_HOST" --arg p "${SMTP_PORT:-587}" --arg u "$SMTP_USER" --arg w "$SMTP_PASS" \
      '{SMTP_HOST:$h, SMTP_PORT:$p, SMTP_USER:$u, SMTP_PASS:$w, SMTP_SECURE:"false"}')"
    aws secretsmanager put-secret-value --region "$REGION" --secret-id huarango/smtp --secret-string "$valor" >/dev/null
    echo "Secreto huarango/smtp actualizado."
    ;;
  culqi)
    : "${CULQI_SECRET_KEY:?define CULQI_SECRET_KEY}"
    valor="$(jq -n --arg k "$CULQI_SECRET_KEY" '{CULQI_SECRET_KEY:$k, PASARELA_MODO:"culqi"}')"
    aws secretsmanager put-secret-value --region "$REGION" --secret-id huarango/culqi --secret-string "$valor" >/dev/null
    echo "Secreto huarango/culqi actualizado."
    ;;
  *)
    echo "Uso: $0 smtp|culqi"; exit 1 ;;
esac
echo "Vuelve a ejecutar ./scripts/deploy-k8s.sh para que los pods lo tomen."
