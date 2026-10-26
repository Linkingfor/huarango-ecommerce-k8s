# Entorno del laboratorio (AWS Academy, us-east-1): compone los módulos de la infraestructura base.

locals {
  servicios = [
    "web-frontend", "svc-usuarios", "svc-catalogo", "svc-carrito",
    "svc-ordenes", "svc-pagos", "svc-notificaciones",
  ]
}

module "network" {
  source          = "../../modules/network"
  nombre          = "huarango-vpc"
  region          = var.region
  nombre_cluster  = var.nombre_cluster
  cidr            = "10.20.0.0/16"
  zonas           = ["${var.region}a", "${var.region}b"]
  cidr_publicas   = ["10.20.0.0/24", "10.20.1.0/24"]
  cidr_aplicacion = ["10.20.16.0/20", "10.20.32.0/20"]
  cidr_datos      = ["10.20.64.0/24", "10.20.65.0/24"]
}

module "security" {
  source      = "../../modules/security"
  vpc_id      = module.network.vpc_id
  admin_email = var.admin_email
}

module "eks" {
  source               = "../../modules/eks"
  nombre               = var.nombre_cluster
  version_kubernetes   = var.version_kubernetes
  subredes             = module.network.subredes_aplicacion
  sg_cluster_id        = module.security.sg_cluster_id
  sg_nodos_id          = module.security.sg_nodos_id
  cidrs_administracion = var.cidrs_administracion
  cifrar_secretos      = var.cifrar_secretos_eks
  kms_eks_arn          = module.security.kms_eks_arn
  nodos_min            = var.nodos_min
  nodos_deseados       = var.nodos_deseados
  nodos_max            = var.nodos_max
}

module "data" {
  source         = "../../modules/data"
  subredes_datos = module.network.subredes_datos
  sg_rds_id      = module.security.sg_rds_id
  kms_datos_arn  = module.security.kms_datos_arn
}

module "messaging" {
  source = "../../modules/messaging"
}

module "registry" {
  source    = "../../modules/registry"
  servicios = local.servicios
}
