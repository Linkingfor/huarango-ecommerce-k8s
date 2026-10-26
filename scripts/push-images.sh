#!/usr/bin/env bash
# Construye las 7 imágenes para linux/amd64 (los nodos t3 son x86) y las sube a Amazon ECR.
# Uso: ./scripts/push-images.sh [etiqueta]     (por defecto, el SHA corto del commit actual)
# shellcheck source=scripts/comun.sh
source "$(dirname "$0")/comun.sh"
requiere aws docker git

TAG="${1:-$(git -C "$RAIZ" rev-parse --short HEAD)}"
CUENTA="$(cuenta_aws)"
REGISTRO="$CUENTA.dkr.ecr.$REGION.amazonaws.com"

info "Inicio de sesión en $REGISTRO"
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRO"

for servicio in "${SERVICIOS[@]}"; do
  imagen="$REGISTRO/huarango/$servicio:$TAG"
  if aws ecr describe-images --region "$REGION" --repository-name "huarango/$servicio" --image-ids imageTag="$TAG" >/dev/null 2>&1; then
    echo "$servicio:$TAG ya está en ECR (las etiquetas son inmutables), se omite."
    continue
  fi
  info "Construyendo $servicio:$TAG"
  docker buildx build --platform linux/amd64 --provenance=false -t "$imagen" --push "$RAIZ/services/$servicio"
done

info "Imágenes publicadas con la etiqueta $TAG"
echo "Siguiente paso: ./scripts/deploy-k8s.sh $TAG"
