output "db_host" {
  value = aws_db_instance.this.address
}

output "db_puerto" {
  value = aws_db_instance.this.port
}

output "db_nombre" {
  value = aws_db_instance.this.db_name
}

output "db_secreto_maestro_arn" {
  description = "Secreto de Secrets Manager con la contraseña maestra que administra RDS"
  value       = aws_db_instance.this.master_user_secret[0].secret_arn
}

output "tabla_carritos" {
  value = aws_dynamodb_table.carritos.name
}

output "bucket_media" {
  value = aws_s3_bucket.media.bucket
}
