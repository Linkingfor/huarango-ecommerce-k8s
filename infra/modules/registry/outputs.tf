output "repositorios" {
  value = { for nombre, repo in aws_ecr_repository.this : nombre => repo.repository_url }
}
