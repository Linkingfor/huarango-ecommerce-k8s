output "sg_alb_id" {
  value = aws_security_group.alb.id
}

output "sg_nodos_id" {
  value = aws_security_group.nodos.id
}

output "sg_cluster_id" {
  value = aws_security_group.cluster.id
}

output "sg_rds_id" {
  value = aws_security_group.rds.id
}

output "kms_datos_arn" {
  value = aws_kms_key.datos.arn
}

output "kms_eks_arn" {
  value = aws_kms_key.eks.arn
}

output "secretos" {
  description = "Nombres de los secretos en Secrets Manager"
  value = {
    rds_usuarios = aws_secretsmanager_secret.rds_servicio["usuarios"].name
    rds_catalogo = aws_secretsmanager_secret.rds_servicio["catalogo"].name
    rds_ordenes  = aws_secretsmanager_secret.rds_servicio["ordenes"].name
    jwt          = aws_secretsmanager_secret.jwt.name
    app          = aws_secretsmanager_secret.app.name
    smtp         = aws_secretsmanager_secret.externos["smtp"].name
    culqi        = aws_secretsmanager_secret.externos["culqi"].name
  }
}
