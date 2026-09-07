# Outputs publicados para as demais stacks e para a pipeline da aplicacao.
resource "aws_ssm_parameter" "api_endpoint" {
  name  = "${local.ssm_base}/gateway/endpoint"
  type  = "String"
  value = aws_apigatewayv2_stage.default.invoke_url
}

resource "aws_ssm_parameter" "api_id" {
  name  = "${local.ssm_base}/gateway/api-id"
  type  = "String"
  value = aws_apigatewayv2_api.oficina.id
}
