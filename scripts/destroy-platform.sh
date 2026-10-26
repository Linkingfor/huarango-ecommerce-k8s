#!/usr/bin/env bash
# Apaga lo que cobra por hora al final de cada sesión del laboratorio: clúster EKS, nodos y NAT Gateway.
# Conserva la base de datos (detenida), DynamoDB, S3, ECR, los secretos y el estado de Terraform.
# La siguiente sesión: aws rds start-db-instance ... y terraform apply (ver README).
# shellcheck source=scripts/comun.sh
source "$(dirname "$0")/comun.sh"
requiere aws kubectl terraform

CLUSTER="$(tf_salida cluster 2>/dev/null || true)"
if [ -n "$CLUSTER" ] && aws eks describe-cluster --region "$REGION" --name "$CLUSTER" >/dev/null 2>&1; then
  info "Eliminando los recursos de Kubernetes"
  aws eks update-kubeconfig --region "$REGION" --name "$CLUSTER" >/dev/null
  kubectl delete namespace ecommerce --ignore-not-found --wait=true --timeout=300s || true
fi

info "Destruyendo el clúster EKS y el NAT Gateway"
terraform -chdir="$TF_DIR" destroy -auto-approve \
  -target=module.eks \
  -target=module.network.aws_nat_gateway.this \
  -target=module.network.aws_eip.nat

info "Deteniendo la base de datos"
aws rds stop-db-instance --region "$REGION" --db-instance-identifier huarango-db >/dev/null 2>&1 \
  && echo "huarango-db se está deteniendo (AWS la vuelve a encender sola a los 7 días)." \
  || echo "huarango-db ya estaba detenida o no existe."

echo
echo "Plataforma apagada. Datos, imágenes y estado conservados."
