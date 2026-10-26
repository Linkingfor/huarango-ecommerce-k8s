# Mensajería: cola de pagos, tópico de eventos de pago y colas suscritas, cada una con su DLQ.

locals {
  colas     = toset(["cola-pagos", "q-ordenes-estado", "q-notificaciones"])
  suscritas = toset(["q-ordenes-estado", "q-notificaciones"])
}

resource "aws_sqs_queue" "dlq" {
  for_each                  = local.colas
  name                      = "${each.key}-dlq"
  message_retention_seconds = 1209600 # 14 días para revisar qué falló
  sqs_managed_sse_enabled   = true
}

resource "aws_sqs_queue" "this" {
  for_each                   = local.colas
  name                       = each.key
  visibility_timeout_seconds = 60 # mayor que el timeout de la pasarela más los reintentos
  receive_wait_time_seconds  = 20 # long polling
  sqs_managed_sse_enabled    = true
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq[each.key].arn
    maxReceiveCount     = 5
  })
}

resource "aws_sns_topic" "eventos_pago" {
  name = "eventos-pago"
}

resource "aws_sns_topic_subscription" "this" {
  for_each             = local.suscritas
  topic_arn            = aws_sns_topic.eventos_pago.arn
  protocol             = "sqs"
  endpoint             = aws_sqs_queue.this[each.key].arn
  raw_message_delivery = true
}

# Solo el tópico eventos-pago puede escribir en las colas suscritas.
data "aws_iam_policy_document" "sns_a_sqs" {
  for_each = local.suscritas
  statement {
    effect    = "Allow"
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.this[each.key].arn]
    principals {
      type        = "Service"
      identifiers = ["sns.amazonaws.com"]
    }
    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_sns_topic.eventos_pago.arn]
    }
  }
}

resource "aws_sqs_queue_policy" "this" {
  for_each  = local.suscritas
  queue_url = aws_sqs_queue.this[each.key].id
  policy    = data.aws_iam_policy_document.sns_a_sqs[each.key].json
}
