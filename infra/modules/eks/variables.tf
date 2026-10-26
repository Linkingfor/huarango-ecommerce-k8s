variable "nombre" {
  description = "Nombre del clúster"
  type        = string
}

variable "version_kubernetes" {
  description = "Versión de Kubernetes en EKS (en soporte estándar)"
  type        = string
}

variable "rol_lab" {
  description = "Rol de IAM existente que usan el clúster y los nodos (LabRole en AWS Academy)"
  type        = string
  default     = "LabRole"
}

variable "subredes" {
  description = "Subredes de aplicación (privadas) para el plano de control y los nodos"
  type        = list(string)
}

variable "sg_cluster_id" {
  type = string
}

variable "sg_nodos_id" {
  type = string
}

variable "cidrs_administracion" {
  description = "IPs públicas desde donde se administra el clúster con kubectl"
  type        = list(string)
}

variable "cifrar_secretos" {
  description = "Cifra los Secrets de Kubernetes con la llave KMS del proyecto"
  type        = bool
  default     = true
}

variable "kms_eks_arn" {
  type = string
}

variable "tipo_instancia" {
  description = "Tipo de instancia de los nodos (AWS Academy admite hasta large)"
  type        = string
  default     = "t3.medium"
}

variable "disco_gb" {
  type    = number
  default = 20
}

variable "nodos_min" {
  type    = number
  default = 2
}

variable "nodos_deseados" {
  type    = number
  default = 3
}

variable "nodos_max" {
  description = "Máximo de nodos (el laboratorio permite 9 instancias y 32 vCPU)"
  type        = number
  default     = 4
}
