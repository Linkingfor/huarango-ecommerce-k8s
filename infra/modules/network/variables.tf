variable "nombre" {
  description = "Nombre de la VPC"
  type        = string
}

variable "region" {
  description = "Región de AWS (para los endpoints de gateway)"
  type        = string
}

variable "nombre_cluster" {
  description = "Nombre del clúster EKS, para etiquetar las subredes que usará el AWS Load Balancer Controller"
  type        = string
}

variable "cidr" {
  description = "Bloque CIDR de la VPC"
  type        = string
}

variable "zonas" {
  description = "Dos zonas de disponibilidad"
  type        = list(string)
  validation {
    condition     = length(var.zonas) == 2
    error_message = "Se necesitan exactamente dos zonas de disponibilidad."
  }
}

variable "cidr_publicas" {
  description = "CIDR de las subredes públicas (pub-a, pub-b)"
  type        = list(string)
}

variable "cidr_aplicacion" {
  description = "CIDR de las subredes de aplicación (app-a, app-b). /20 porque cada pod usa una IP de la VPC"
  type        = list(string)
}

variable "cidr_datos" {
  description = "CIDR de las subredes de datos (data-a, data-b)"
  type        = list(string)
}
