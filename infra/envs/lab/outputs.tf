output "vpc_id" {
  value = module.network.vpc_id
}

output "subredes" {
  value = {
    publicas   = module.network.subredes_publicas
    aplicacion = module.network.subredes_aplicacion
    datos      = module.network.subredes_datos
  }
}

output "security_groups" {
  value = {
    alb     = module.security.sg_alb_id
    nodos   = module.security.sg_nodos_id
    cluster = module.security.sg_cluster_id
    rds     = module.security.sg_rds_id
  }
}

output "cluster" {
  value = module.eks.nombre
}

output "db_host" {
  value = module.data.db_host
}

output "db_secreto_maestro_arn" {
  value = module.data.db_secreto_maestro_arn
}

output "tabla_carritos" {
  value = module.data.tabla_carritos
}

output "bucket_media" {
  value = module.data.bucket_media
}

output "colas" {
  value = module.messaging.colas
}

output "topico_eventos_pago" {
  value = module.messaging.topico_eventos_pago
}

output "repositorios" {
  value = module.registry.repositorios
}

output "secretos" {
  value = module.security.secretos
}
