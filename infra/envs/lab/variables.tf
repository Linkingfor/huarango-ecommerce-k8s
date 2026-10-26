variable "region" {
  description = "Región de AWS (AWS Academy solo habilita us-east-1 y us-west-2)"
  type        = string
  default     = "us-east-1"
}

variable "responsable" {
  description = "Etiqueta de costos: quién creó los recursos"
  type        = string
  default     = "grupo-huarango"
}

variable "nombre_cluster" {
  type    = string
  default = "huarango-eks"
}

variable "version_kubernetes" {
  description = "Versión de Kubernetes en EKS. Debe estar en soporte estándar para no pagar soporte extendido"
  type        = string
  default     = "1.35"
}

variable "cidrs_administracion" {
  description = "IP pública de quienes administran el clúster, en formato x.x.x.x/32 (ver: curl -s https://checkip.amazonaws.com)"
  type        = list(string)
}

variable "cifrar_secretos_eks" {
  description = "Cifra los Secrets de Kubernetes con una llave KMS propia. Si el laboratorio lo rechaza, poner false"
  type        = bool
  default     = true
}

variable "admin_email" {
  description = "Correo de la cuenta administradora de la tienda"
  type        = string
  default     = "admin@huarango.pe"
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
  type    = number
  default = 4
}
