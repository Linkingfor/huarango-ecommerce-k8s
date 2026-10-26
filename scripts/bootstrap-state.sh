#!/usr/bin/env bash
# Crea (una sola vez) el bucket S3 donde Terraform guarda su estado, y ejecuta terraform init.
# Uso: ./scripts/bootstrap-state.sh
# shellcheck source=scripts/comun.sh
source "$(dirname "$0")/comun.sh"
requiere aws terraform

CUENTA="$(cuenta_aws)"
BUCKET="huarango-tfstate-$CUENTA"

info "Bucket de estado: $BUCKET"
if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "El bucket ya existe."
else
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" >/dev/null
  else
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" --create-bucket-configuration LocationConstraint="$REGION" >/dev/null
  fi
  aws s3api put-bucket-versioning --bucket "$BUCKET" --versioning-configuration Status=Enabled
  aws s3api put-bucket-encryption --bucket "$BUCKET" \
    --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
  aws s3api put-public-access-block --bucket "$BUCKET" \
    --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
  echo "Bucket creado con versionado, cifrado y acceso público bloqueado."
fi

info "terraform init"
terraform -chdir="$TF_DIR" init -reconfigure -backend-config="bucket=$BUCKET"
