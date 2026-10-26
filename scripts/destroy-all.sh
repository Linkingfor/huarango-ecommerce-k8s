#!/usr/bin/env bash
# Elimina TODA la infraestructura del proyecto (al cerrar el curso). Borra también los datos.
# shellcheck source=scripts/comun.sh
source "$(dirname "$0")/comun.sh"
requiere aws kubectl terraform

read -r -p "Esto borra la base de datos, las imágenes y todos los recursos. Escribe 'borrar' para continuar: " respuesta
[ "$respuesta" = "borrar" ] || { echo "Cancelado."; exit 0; }

CLUSTER="$(tf_salida cluster 2>/dev/null || true)"
if [ -n "$CLUSTER" ] && aws eks describe-cluster --region "$REGION" --name "$CLUSTER" >/dev/null 2>&1; then
  aws eks update-kubeconfig --region "$REGION" --name "$CLUSTER" >/dev/null
  kubectl delete namespace ecommerce --ignore-not-found --wait=true --timeout=300s || true
fi
aws rds start-db-instance --region "$REGION" --db-instance-identifier huarango-db >/dev/null 2>&1 || true
terraform -chdir="$TF_DIR" destroy -auto-approve

CUENTA="$(cuenta_aws)"
echo
echo "Infraestructura eliminada. Si ya no lo necesitas, borra también el bucket del estado:"
echo "  aws s3 rb s3://huarango-tfstate-$CUENTA --force"
