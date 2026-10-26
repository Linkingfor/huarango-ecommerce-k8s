#!/usr/bin/env bash
# Despliega la tienda en el clúster EKS:
#   1. genera la configuración del overlay con las salidas de Terraform,
#   2. copia los secretos de Secrets Manager a Secrets de Kubernetes,
#   3. aplica los manifiestos, corre las migraciones en RDS y espera a que todo quede listo.
# Uso: ./scripts/deploy-k8s.sh [etiqueta]     (la misma etiqueta usada en push-images.sh)
# shellcheck source=scripts/comun.sh
source "$(dirname "$0")/comun.sh"
requiere aws kubectl terraform jq git

TAG="${1:-$(git -C "$RAIZ" rev-parse --short HEAD)}"
CUENTA="$(cuenta_aws)"
REGISTRO="$CUENTA.dkr.ecr.$REGION.amazonaws.com"
CLUSTER="$(tf_salida cluster)"
OVERLAY="$RAIZ/k8s/overlays/lab"
NS=ecommerce

info "Conectando kubectl con el clúster $CLUSTER"
aws eks update-kubeconfig --region "$REGION" --name "$CLUSTER" >/dev/null
kubectl apply -f "$RAIZ/k8s/base/namespace.yaml"

info "Generando la configuración del overlay (imágenes con la etiqueta $TAG)"
cat > "$OVERLAY/config-aws.env" <<EOF
AWS_REGION=$REGION
DB_HOST=$(tf_salida db_host)
DB_PORT=5432
DB_NAME=huarango
DB_SSL=verify-full
USUARIOS_URL=http://svc-usuarios:3001
CATALOGO_URL=http://svc-catalogo:3002
CARRITO_TABLE=$(tf_salida tabla_carritos)
STORAGE_MODE=s3
MEDIA_BUCKET=$(tf_salida bucket_media)
COLA_PAGOS_URL=$(tf_salida colas '.["cola-pagos"]')
Q_ORDENES_ESTADO_URL=$(tf_salida colas '.["q-ordenes-estado"]')
Q_NOTIFICACIONES_URL=$(tf_salida colas '.["q-notificaciones"]')
COLA_NOTIFICACIONES_URL=$(tf_salida colas '.["q-notificaciones"]')
SNS_TOPIC_ARN=$(tf_salida topico_eventos_pago)
MODO_EVENTOS=sns
PASARELA_MODO=simulado
SMTP_HOST=mailpit
SMTP_PORT=1025
MAIL_FROM=Huarango Market <pedidos@huarango.pe>
EOF
sed -e "s|__REGISTRO__|$REGISTRO|g" -e "s|__TAG__|$TAG|g" "$OVERLAY/kustomization.tpl.yaml" > "$OVERLAY/kustomization.yaml"

info "Copiando secretos de Secrets Manager a Kubernetes"
# Los valores pasan de AWS a Kubernetes sin escribirse en disco ni en el repositorio.
aplicar_secreto() {
  local nombre="$1"; shift
  local args=()
  for par in "$@"; do args+=("--from-literal=$par"); done
  kubectl -n "$NS" create secret generic "$nombre" "${args[@]}" --dry-run=client -o yaml | kubectl apply -f - >/dev/null
  echo "  secreto $nombre"
}
MAESTRO="$(tf_salida db_secreto_maestro_arn)"
aplicar_secreto db-admin "username=$(secreto "$MAESTRO" .username)" "password=$(secreto "$MAESTRO" .password)"
for s in usuarios catalogo ordenes; do
  aplicar_secreto "db-$s" "DB_USER=$(secreto "huarango/rds/$s" .username)" "DB_PASSWORD=$(secreto "huarango/rds/$s" .password)"
done
aplicar_secreto jwt-publica "JWT_PUBLIC_KEY=$(secreto huarango/jwt .publica)"
aplicar_secreto jwt-privada "JWT_PRIVATE_KEY=$(secreto huarango/jwt .privada)"
aplicar_secreto tienda-admin "ADMIN_EMAIL=$(secreto huarango/app .ADMIN_EMAIL)" "ADMIN_PASSWORD=$(secreto huarango/app .ADMIN_PASSWORD)"

pagos=("WEBHOOK_SECRET=$(secreto huarango/app .WEBHOOK_SECRET)")
CULQI="$(secreto huarango/culqi .CULQI_SECRET_KEY)"
[ -n "$CULQI" ] && pagos+=("CULQI_SECRET_KEY=$CULQI" "PASARELA_MODO=culqi")
aplicar_secreto pagos "${pagos[@]}"

SMTP_HOST_REAL="$(secreto huarango/smtp .SMTP_HOST)"
if [ -n "$SMTP_HOST_REAL" ]; then
  aplicar_secreto smtp "SMTP_HOST=$SMTP_HOST_REAL" "SMTP_PORT=$(secreto huarango/smtp .SMTP_PORT)" \
    "SMTP_USER=$(secreto huarango/smtp .SMTP_USER)" "SMTP_PASS=$(secreto huarango/smtp .SMTP_PASS)" \
    "SMTP_SECURE=$(secreto huarango/smtp .SMTP_SECURE)"
else
  echo "  sin SMTP propio: los correos se ven en Mailpit (kubectl -n $NS port-forward svc/mailpit 8025:8025)"
fi

kubectl -n "$NS" create configmap sql-migraciones --from-file="$RAIZ/db" --dry-run=client -o yaml | kubectl apply -f - >/dev/null

info "Aplicando los manifiestos"
kubectl apply -k "$OVERLAY"

info "Migraciones en Amazon RDS"
kubectl -n "$NS" delete job migraciones --ignore-not-found >/dev/null
kubectl apply -f "$RAIZ/k8s/jobs/migraciones.yaml"
if ! kubectl -n "$NS" wait --for=condition=complete job/migraciones --timeout=300s; then
  kubectl -n "$NS" logs job/migraciones || true
  error "las migraciones no terminaron. Revisa los logs de arriba."
fi
kubectl -n "$NS" logs job/migraciones | tail -n 4

info "Reiniciando los servicios para que tomen la configuración y los secretos"
kubectl -n "$NS" rollout restart deployment >/dev/null
for servicio in "${SERVICIOS[@]}"; do
  kubectl -n "$NS" rollout status "deployment/$servicio" --timeout=300s
done

info "Listo"
kubectl -n "$NS" get pods -o wide
cat <<EOF

Para abrir la tienda desde tu computadora:
  kubectl -n $NS port-forward svc/web-frontend 8080:8080      → http://localhost:8080
Correos de prueba:
  kubectl -n $NS port-forward svc/mailpit 8025:8025           → http://localhost:8025
Cuenta de administrador: $(secreto huarango/app .ADMIN_EMAIL)
  contraseña: aws secretsmanager get-secret-value --secret-id huarango/app --query SecretString --output text | jq -r .ADMIN_PASSWORD
EOF
