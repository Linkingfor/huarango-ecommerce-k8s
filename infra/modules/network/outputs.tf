output "vpc_id" {
  value = aws_vpc.this.id
}

output "vpc_cidr" {
  value = aws_vpc.this.cidr_block
}

output "subredes_publicas" {
  value = [aws_subnet.this["pub-a"].id, aws_subnet.this["pub-b"].id]
}

output "subredes_aplicacion" {
  value = [aws_subnet.this["app-a"].id, aws_subnet.this["app-b"].id]
}

output "subredes_datos" {
  value = [aws_subnet.this["data-a"].id, aws_subnet.this["data-b"].id]
}

output "nat_gateway_id" {
  value = aws_nat_gateway.this.id
}

output "nat_ip_publica" {
  value = aws_eip.nat.public_ip
}
