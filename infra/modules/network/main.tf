# Red virtual: VPC en dos zonas con tres niveles de subred (pública, aplicación y datos).

resource "aws_vpc" "this" {
  cidr_block           = var.cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = var.nombre }
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "igw-${var.nombre}" }
}

locals {
  # Ninguna subred asigna IP pública automáticamente: el ALB y el NAT reciben la suya por su cuenta.
  subredes = {
    "pub-a"  = { cidr = var.cidr_publicas[0], zona = var.zonas[0], tipo = "publica" }
    "pub-b"  = { cidr = var.cidr_publicas[1], zona = var.zonas[1], tipo = "publica" }
    "app-a"  = { cidr = var.cidr_aplicacion[0], zona = var.zonas[0], tipo = "aplicacion" }
    "app-b"  = { cidr = var.cidr_aplicacion[1], zona = var.zonas[1], tipo = "aplicacion" }
    "data-a" = { cidr = var.cidr_datos[0], zona = var.zonas[0], tipo = "datos" }
    "data-b" = { cidr = var.cidr_datos[1], zona = var.zonas[1], tipo = "datos" }
  }
  etiquetas_k8s = {
    publica    = { "kubernetes.io/role/elb" = "1", "kubernetes.io/cluster/${var.nombre_cluster}" = "shared" }
    aplicacion = { "kubernetes.io/role/internal-elb" = "1", "kubernetes.io/cluster/${var.nombre_cluster}" = "shared" }
    datos      = {}
  }
}

resource "aws_subnet" "this" {
  for_each                = local.subredes
  vpc_id                  = aws_vpc.this.id
  cidr_block              = each.value.cidr
  availability_zone       = each.value.zona
  map_public_ip_on_launch = false
  tags = merge(
    { Name = each.key, nivel = each.value.tipo },
    local.etiquetas_k8s[each.value.tipo],
  )
}

# Un solo NAT Gateway en la zona a (ADR-04): ahorra uno de los costos fijos más altos del laboratorio.
resource "aws_eip" "nat" {
  domain = "vpc"
  tags   = { Name = "eip-nat-${var.nombre}" }
}

resource "aws_nat_gateway" "this" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.this["pub-a"].id
  tags          = { Name = "nat-${var.nombre}" }
  depends_on    = [aws_internet_gateway.this]
}

# ---------------------------------------------------------------- tablas de ruteo
resource "aws_route_table" "publica" {
  vpc_id = aws_vpc.this.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }
  tags = { Name = "rt-public" }
}

resource "aws_route_table" "aplicacion" {
  vpc_id = aws_vpc.this.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.this.id
  }
  tags = { Name = "rt-app" }
}

# Sin ruta a internet: la base de datos solo es alcanzable desde dentro de la VPC.
resource "aws_route_table" "datos" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "rt-data" }
}

resource "aws_route_table_association" "this" {
  for_each  = local.subredes
  subnet_id = aws_subnet.this[each.key].id
  route_table_id = {
    publica    = aws_route_table.publica.id
    aplicacion = aws_route_table.aplicacion.id
    datos      = aws_route_table.datos.id
  }[each.value.tipo]
}

# ---------------------------------------------------------------- endpoints de gateway (sin costo)
# El tráfico a S3 y DynamoDB no pasa por el NAT, que cobra por cada GB procesado.
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${var.region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.aplicacion.id]
  tags              = { Name = "vpce-s3" }
}

resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${var.region}.dynamodb"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.aplicacion.id]
  tags              = { Name = "vpce-dynamodb" }
}
