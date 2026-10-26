#!/usr/bin/env bash
# Revisa en AWS cada punto de la lista de verificación del APF2 e imprime la evidencia.
# Uso: ./scripts/verificar-apf2.sh | tee evidencias-apf2.txt
# shellcheck source=scripts/comun.sh
source "$(dirname "$0")/comun.sh"
requiere aws kubectl terraform jq curl
set +e  # es un reporte: si un punto falla se anota y se sigue con el resto
NS=ecommerce
VPC="$(tf_salida vpc_id)"
problemas=0
aviso() { printf '  \033[33mREVISAR:\033[0m %s\n' "$*"; problemas=$((problemas + 1)); }
bien() { printf '  \033[32mOK:\033[0m %s\n' "$*"; }

info "1. Red virtual"
aws ec2 describe-subnets --region "$REGION" --filters "Name=vpc-id,Values=$VPC" \
  --query "sort_by(Subnets,&CidrBlock)[].{Subred:Tags[?Key=='Name']|[0].Value,CIDR:CidrBlock,Zona:AvailabilityZone,IPPublicaAutomatica:MapPublicIpOnLaunch}" \
  --output table
aws ec2 describe-route-tables --region "$REGION" --filters "Name=vpc-id,Values=$VPC" \
  --query "RouteTables[].{Tabla:Tags[?Key=='Name']|[0].Value,Rutas:join(', ',Routes[].[DestinationCidrBlock || DestinationPrefixListId, GatewayId || NatGatewayId][])}" \
  --output table
abiertos="$(aws ec2 describe-security-groups --region "$REGION" --filters "Name=vpc-id,Values=$VPC" \
  --query "SecurityGroups[].IpPermissions[?contains(IpRanges[].CidrIp, '0.0.0.0/0') && (FromPort==\`22\` || FromPort==\`5432\` || IpProtocol=='-1')][]" --output json | jq length)"
if [ "$abiertos" = "0" ]; then bien "ningún security group abre SSH, PostgreSQL o todo el tráfico a 0.0.0.0/0"; else aviso "$abiertos reglas abiertas a internet"; fi

info "2. Cómputo y almacenamiento"
kubectl get nodes -o wide
externas="$(kubectl get nodes -o jsonpath='{.items[*].status.addresses[?(@.type=="ExternalIP")].address}')"
if [ -z "$externas" ]; then bien "los nodos no tienen IP pública"; else aviso "hay nodos con IP pública: $externas"; fi
aws rds describe-db-instances --region "$REGION" --db-instance-identifier huarango-db \
  --query "DBInstances[0].{Estado:DBInstanceStatus,Clase:DBInstanceClass,Motor:EngineVersion,AccesoPublico:PubliclyAccessible,Cifrada:StorageEncrypted}" --output table
aws dynamodb describe-table --region "$REGION" --table-name "$(tf_salida tabla_carritos)" \
  --query "Table.{Tabla:TableName,Estado:TableStatus,Items:ItemCount}" --output table
aws s3api head-bucket --bucket "$(tf_salida bucket_media)" && bien "bucket $(tf_salida bucket_media) disponible"
kubectl -n "$NS" get deploy,svc,pods

info "Conexión desde la red privada: la tienda en EKS consulta RDS"
kubectl -n "$NS" port-forward svc/web-frontend 18080:8080 >/dev/null 2>&1 &
PF=$!
trap 'kill $PF 2>/dev/null || true' EXIT
sleep 4
antes="$(curl -s localhost:18080/api/catalogo/productos | jq length)"
if [ "${antes:-0}" -gt 0 ] 2>/dev/null; then bien "svc-catalogo devolvió $antes productos desde RDS"; else aviso "el catálogo no respondió"; fi

info "Persistencia: se eliminan los pods de svc-catalogo y se vuelve a consultar"
kubectl -n "$NS" delete pod -l app=svc-catalogo --wait=false
kubectl -n "$NS" rollout status deployment/svc-catalogo --timeout=180s
sleep 3
despues="$(curl -s localhost:18080/api/catalogo/productos | jq length)"
if [ "$antes" = "$despues" ]; then bien "los $despues productos siguen disponibles tras recrear los pods"; else aviso "antes $antes, después $despues"; fi

info "3. Contenerización: imágenes en ECR"
for repo in $(tf_salida repositorios 'keys[]'); do
  aws ecr describe-images --region "$REGION" --repository-name "huarango/$repo" \
    --query "sort_by(imageDetails,&imagePushedAt)[-1].{Repositorio:repositoryName,Etiqueta:imageTags[0],Bytes:imageSizeInBytes}" --output text
done

info "Resultado"
if [ "$problemas" -eq 0 ]; then echo "Todos los puntos verificados."; else echo "$problemas puntos para revisar."; fi
