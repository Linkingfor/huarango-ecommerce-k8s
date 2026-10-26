variable "subredes_datos" {
  description = "Subredes de datos para el grupo de subredes de RDS"
  type        = list(string)
}

variable "sg_rds_id" {
  type = string
}

variable "kms_datos_arn" {
  description = "Llave KMS para cifrar la base de datos"
  type        = string
}

variable "clase_db" {
  description = "Clase de instancia de RDS (AWS Academy admite hasta medium)"
  type        = string
  default     = "db.t3.micro"
}
