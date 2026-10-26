# Un repositorio de Amazon ECR por componente.

resource "aws_ecr_repository" "this" {
  for_each             = toset(var.servicios)
  name                 = "huarango/${each.key}"
  image_tag_mutability = "IMMUTABLE" # cada etiqueta (SHA del commit) apunta siempre a la misma imagen
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

resource "aws_ecr_lifecycle_policy" "this" {
  for_each   = aws_ecr_repository.this
  repository = each.value.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Conservar solo las ultimas 15 imagenes"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 15
      }
      action = { type = "expire" }
    }]
  })
}
