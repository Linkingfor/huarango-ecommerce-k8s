# Clúster Amazon EKS y managed node group. En AWS Academy no se pueden crear roles de IAM,
# así que el clúster y los nodos usan el rol existente LabRole.

data "aws_iam_role" "lab" {
  name = var.rol_lab
}

resource "aws_eks_cluster" "this" {
  name     = var.nombre
  version  = var.version_kubernetes
  role_arn = data.aws_iam_role.lab.arn

  vpc_config {
    subnet_ids              = var.subredes
    security_group_ids      = [var.sg_cluster_id]
    endpoint_private_access = true
    endpoint_public_access  = true
    public_access_cidrs     = var.cidrs_administracion
  }

  access_config {
    authentication_mode                         = "API_AND_CONFIG_MAP"
    bootstrap_cluster_creator_admin_permissions = true
  }

  # Al terminar el soporte estándar de la versión, se actualiza en lugar de pagar soporte extendido.
  upgrade_policy {
    support_type = "STANDARD"
  }

  dynamic "encryption_config" {
    for_each = var.cifrar_secretos ? [1] : []
    content {
      resources = ["secrets"]
      provider {
        key_arn = var.kms_eks_arn
      }
    }
  }
}

# La CNI se configura antes que los nodos para que arranquen con NetworkPolicies habilitadas.
resource "aws_eks_addon" "vpc_cni" {
  cluster_name                = aws_eks_cluster.this.name
  addon_name                  = "vpc-cni"
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"
  configuration_values        = jsonencode({ enableNetworkPolicy = "true" })
}

resource "aws_eks_addon" "kube_proxy" {
  cluster_name                = aws_eks_cluster.this.name
  addon_name                  = "kube-proxy"
  resolve_conflicts_on_create = "OVERWRITE"
}

# ---------------------------------------------------------------- nodos
resource "aws_launch_template" "nodos" {
  name_prefix = "${var.nombre}-nodos-"

  # El security group que crea EKS permite la comunicación nodo–plano de control; sg-nodos agrega
  # el acceso desde el ALB y hacia RDS.
  vpc_security_group_ids = [
    aws_eks_cluster.this.vpc_config[0].cluster_security_group_id,
    var.sg_nodos_id,
  ]

  # IMDSv2 obligatorio. El límite de 2 saltos permite que los pods lean las credenciales de LabRole.
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }

  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_size           = var.disco_gb
      volume_type           = "gp3"
      encrypted             = true
      delete_on_termination = true
    }
  }

  tag_specifications {
    resource_type = "instance"
    tags          = { Name = "${var.nombre}-nodo" }
  }
}

resource "aws_eks_node_group" "general" {
  cluster_name    = aws_eks_cluster.this.name
  node_group_name = "ng-general"
  node_role_arn   = data.aws_iam_role.lab.arn
  subnet_ids      = var.subredes
  instance_types  = [var.tipo_instancia]
  ami_type        = "AL2023_x86_64_STANDARD"
  capacity_type   = "ON_DEMAND"

  launch_template {
    id      = aws_launch_template.nodos.id
    version = aws_launch_template.nodos.latest_version
  }

  scaling_config {
    min_size     = var.nodos_min
    desired_size = var.nodos_deseados
    max_size     = var.nodos_max
  }

  update_config {
    max_unavailable = 1
  }

  labels = { rol = "general" }

  # El Cluster Autoscaler (APF3) cambia la cantidad deseada; Terraform no debe revertirla.
  lifecycle {
    ignore_changes = [scaling_config[0].desired_size]
  }

  depends_on = [aws_eks_addon.vpc_cni, aws_eks_addon.kube_proxy]
}

resource "aws_eks_addon" "coredns" {
  cluster_name                = aws_eks_cluster.this.name
  addon_name                  = "coredns"
  resolve_conflicts_on_create = "OVERWRITE"
  depends_on                  = [aws_eks_node_group.general]
}
