# Security groups con mínimo privilegio, llaves KMS y secretos en AWS Secrets Manager.

terraform {
  required_providers {
    aws    = { source = "hashicorp/aws" }
    random = { source = "hashicorp/random" }
    tls    = { source = "hashicorp/tls" }
  }
}

# ---------------------------------------------------------------- security groups
resource "aws_security_group" "alb" {
  name        = "sg-alb"
  description = "Balanceador: solo recibe trafico de CloudFront"
  vpc_id      = var.vpc_id
  tags        = { Name = "sg-alb" }
}

resource "aws_security_group" "nodos" {
  name        = "sg-nodos"
  description = "Nodos de EKS y sus pods"
  vpc_id      = var.vpc_id
  tags        = { Name = "sg-nodos" }
}

resource "aws_security_group" "cluster" {
  name        = "sg-cluster"
  description = "Interfaces del plano de control de EKS"
  vpc_id      = var.vpc_id
  tags        = { Name = "sg-cluster" }
}

resource "aws_security_group" "rds" {
  name        = "sg-rds"
  description = "PostgreSQL: solo desde los nodos"
  vpc_id      = var.vpc_id
  tags        = { Name = "sg-rds" }
}

data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

# sg-alb: entrada HTTP solo desde las IP de CloudFront; salida solo hacia los pods.
resource "aws_vpc_security_group_ingress_rule" "alb_desde_cloudfront" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTP desde CloudFront"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  prefix_list_id    = data.aws_ec2_managed_prefix_list.cloudfront.id
}

resource "aws_vpc_security_group_egress_rule" "alb_a_pods" {
  for_each                     = { frontend = [8080, 8080], apis = [3001, 3005] }
  security_group_id            = aws_security_group.alb.id
  description                  = "Hacia los pods (${each.key})"
  ip_protocol                  = "tcp"
  from_port                    = each.value[0]
  to_port                      = each.value[1]
  referenced_security_group_id = aws_security_group.nodos.id
}

# sg-nodos
resource "aws_vpc_security_group_ingress_rule" "nodos_desde_alb" {
  for_each                     = { frontend = [8080, 8080], apis = [3001, 3005] }
  security_group_id            = aws_security_group.nodos.id
  description                  = "Desde el ALB (${each.key})"
  ip_protocol                  = "tcp"
  from_port                    = each.value[0]
  to_port                      = each.value[1]
  referenced_security_group_id = aws_security_group.alb.id
}

resource "aws_vpc_security_group_ingress_rule" "nodos_entre_si" {
  security_group_id            = aws_security_group.nodos.id
  description                  = "Pods y nodos entre si (CoreDNS, llamadas internas, Prometheus)"
  ip_protocol                  = "-1"
  referenced_security_group_id = aws_security_group.nodos.id
}

resource "aws_vpc_security_group_ingress_rule" "nodos_desde_control" {
  for_each                     = { https = 443, kubelet = 10250 }
  security_group_id            = aws_security_group.nodos.id
  description                  = "Plano de control hacia ${each.key}"
  ip_protocol                  = "tcp"
  from_port                    = each.value
  to_port                      = each.value
  referenced_security_group_id = aws_security_group.cluster.id
}

# Los nodos no tienen IP pública: su salida a internet (ECR, APIs de AWS, pasarela, correo) pasa por el NAT.
resource "aws_vpc_security_group_egress_rule" "nodos_salida" {
  security_group_id = aws_security_group.nodos.id
  description       = "Salida via NAT Gateway"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

# sg-cluster
resource "aws_vpc_security_group_ingress_rule" "control_desde_nodos" {
  security_group_id            = aws_security_group.cluster.id
  description                  = "Nodos hacia la API de Kubernetes"
  ip_protocol                  = "tcp"
  from_port                    = 443
  to_port                      = 443
  referenced_security_group_id = aws_security_group.nodos.id
}

resource "aws_vpc_security_group_egress_rule" "control_a_nodos" {
  security_group_id            = aws_security_group.cluster.id
  description                  = "Plano de control hacia los nodos"
  ip_protocol                  = "-1"
  referenced_security_group_id = aws_security_group.nodos.id
}

# sg-rds: solo PostgreSQL desde los nodos. Sin reglas de salida.
resource "aws_vpc_security_group_ingress_rule" "rds_desde_nodos" {
  security_group_id            = aws_security_group.rds.id
  description                  = "PostgreSQL desde la capa de aplicacion"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.nodos.id
}

# ---------------------------------------------------------------- llaves KMS
resource "aws_kms_key" "datos" {
  description             = "Cifrado de RDS y volumenes EBS de Huarango Market"
  enable_key_rotation     = true
  deletion_window_in_days = 7
}

resource "aws_kms_alias" "datos" {
  name          = "alias/huarango-data"
  target_key_id = aws_kms_key.datos.key_id
}

resource "aws_kms_key" "eks" {
  description             = "Cifrado de los Secrets de Kubernetes en etcd"
  enable_key_rotation     = true
  deletion_window_in_days = 7
}

resource "aws_kms_alias" "eks" {
  name          = "alias/huarango-eks"
  target_key_id = aws_kms_key.eks.key_id
}

# ---------------------------------------------------------------- secretos
# recovery_window_in_days = 0 permite destruir y volver a crear el entorno del laboratorio el mismo día.
resource "tls_private_key" "jwt" {
  algorithm = "RSA"
  rsa_bits  = 2048
}

resource "random_password" "servicio" {
  for_each = toset(["usuarios", "catalogo", "ordenes"])
  length   = 24
  special  = false
}

resource "random_password" "admin_tienda" {
  length  = 16
  special = false
}

resource "random_password" "webhook" {
  length  = 32
  special = false
}

resource "random_password" "origen" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "rds_servicio" {
  for_each                = random_password.servicio
  name                    = "huarango/rds/${each.key}"
  description             = "Usuario de base de datos de svc-${each.key}"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "rds_servicio" {
  for_each  = random_password.servicio
  secret_id = aws_secretsmanager_secret.rds_servicio[each.key].id
  secret_string = jsonencode({
    username = "svc_${each.key}"
    password = each.value.result
  })
}

resource "aws_secretsmanager_secret" "jwt" {
  name                    = "huarango/jwt"
  description             = "Par de llaves RS256 para firmar y validar los JWT"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "jwt" {
  secret_id = aws_secretsmanager_secret.jwt.id
  secret_string = jsonencode({
    privada = tls_private_key.jwt.private_key_pem_pkcs8
    publica = tls_private_key.jwt.public_key_pem
  })
}

resource "aws_secretsmanager_secret" "app" {
  name                    = "huarango/app"
  description             = "Cuenta administradora de la tienda y secretos de la aplicacion"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    ADMIN_EMAIL    = var.admin_email
    ADMIN_PASSWORD = random_password.admin_tienda.result
    WEBHOOK_SECRET = random_password.webhook.result
    ORIGIN_HEADER  = random_password.origen.result
  })
}

# SMTP y pasarela: se crean vacíos y se llenan con scripts/cargar-secretos.sh (no van en el código).
resource "aws_secretsmanager_secret" "externos" {
  for_each                = toset(["smtp", "culqi"])
  name                    = "huarango/${each.key}"
  description             = "Credenciales de ${each.key}"
  recovery_window_in_days = 0
}
