output "colas" {
  description = "URL de cada cola"
  value       = { for nombre, cola in aws_sqs_queue.this : nombre => cola.url }
}

output "dlqs" {
  value = { for nombre, cola in aws_sqs_queue.dlq : nombre => cola.url }
}

output "topico_eventos_pago" {
  value = aws_sns_topic.eventos_pago.arn
}
