# Persistencia: RDS PostgreSQL, DynamoDB (carritos) y el bucket S3 de imágenes.

data "aws_caller_identity" "actual" {}

# ---------------------------------------------------------------- RDS PostgreSQL
resource "aws_db_subnet_group" "this" {
  name        = "huarango-datos"
  description = "Subredes de datos (sin salida a internet)"
  subnet_ids  = var.subredes_datos
}

resource "aws_db_parameter_group" "this" {
  name   = "huarango-postgres16"
  family = "postgres16"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "500"
  }
}

# Limitaciones de AWS Academy: Single-AZ, clase micro, gp2 y sin monitoreo mejorado.
resource "aws_db_instance" "this" {
  identifier                  = "huarango-db"
  engine                      = "postgres"
  engine_version              = "16"
  instance_class              = var.clase_db
  allocated_storage           = 20
  max_allocated_storage       = 50
  storage_type                = "gp2"
  storage_encrypted           = true
  kms_key_id                  = var.kms_datos_arn
  db_name                     = "huarango"
  username                    = "huarango_admin"
  manage_master_user_password = true # la contraseña maestra la guarda RDS en Secrets Manager
  db_subnet_group_name        = aws_db_subnet_group.this.name
  vpc_security_group_ids      = [var.sg_rds_id]
  parameter_group_name        = aws_db_parameter_group.this.name
  publicly_accessible         = false
  multi_az                    = false
  backup_retention_period     = 7
  backup_window               = "08:00-09:00" # 03:00–04:00 en Perú
  maintenance_window          = "sun:09:30-sun:10:30"
  auto_minor_version_upgrade  = true
  copy_tags_to_snapshot       = true
  monitoring_interval         = 0
  deletion_protection         = false
  skip_final_snapshot         = true
  apply_immediately           = true
}

# ---------------------------------------------------------------- DynamoDB
resource "aws_dynamodb_table" "carritos" {
  name         = "carritos"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "clienteId"
  range_key    = "productoId"

  attribute {
    name = "clienteId"
    type = "S"
  }

  attribute {
    name = "productoId"
    type = "S"
  }

  # Los carritos abandonados se borran solos 7 días después de su último cambio.
  ttl {
    attribute_name = "expiraEn"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }
}

# ---------------------------------------------------------------- S3 (imágenes de productos)
resource "aws_s3_bucket" "media" {
  bucket        = "huarango-media-${data.aws_caller_identity.actual.account_id}"
  force_destroy = true
}

resource "aws_s3_bucket_ownership_controls" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket                  = aws_s3_bucket.media.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "media" {
  bucket = aws_s3_bucket.media.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    id     = "borrar-versiones-antiguas"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
  depends_on = [aws_s3_bucket_versioning.media]
}
