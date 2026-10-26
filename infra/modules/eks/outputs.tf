output "nombre" {
  value = aws_eks_cluster.this.name
}

output "endpoint" {
  value = aws_eks_cluster.this.endpoint
}

output "version" {
  value = aws_eks_cluster.this.version
}

output "sg_cluster_eks_id" {
  description = "Security group que EKS crea para el clúster"
  value       = aws_eks_cluster.this.vpc_config[0].cluster_security_group_id
}

output "node_group" {
  value = aws_eks_node_group.general.node_group_name
}
