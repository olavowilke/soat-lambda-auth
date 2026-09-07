# API Gateway HTTP API (v2) — porta de entrada unica do sistema.
#
#   POST /auth/token           -> Lambda de autenticacao (publica)
#   ANY  /api/{proxy+}         -> EKS via VPC Link + NLB interno (protegida pelo authorizer)
#   rotas publicas de consulta -> EKS sem authorizer (status de OS, health, Swagger)

resource "aws_apigatewayv2_api" "oficina" {
  name          = "${local.prefixo}-api"
  protocol_type = "HTTP"
  description   = "Gateway da Oficina — autenticacao por CPF e roteamento para o cluster"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    allow_headers = ["authorization", "content-type", "x-correlation-id"]
    max_age       = 300
  }
}

# --- integracoes ---------------------------------------------------------

resource "aws_apigatewayv2_integration" "auth" {
  api_id                 = aws_apigatewayv2_api.oficina.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.auth.invoke_arn
  payload_format_version = "2.0"
}

# Integracao privada: o trafego nunca sai da VPC para chegar ao cluster.
resource "aws_apigatewayv2_integration" "cluster" {
  api_id             = aws_apigatewayv2_api.oficina.id
  integration_type   = "HTTP_PROXY"
  integration_method = "ANY"
  integration_uri    = data.aws_ssm_parameter.nlb_listener_arn.value
  connection_type    = "VPC_LINK"
  connection_id      = data.aws_ssm_parameter.vpc_link_id.value

  # Correlaciona a requisicao do gateway com o log da aplicacao (MDC correlationId).
  request_parameters = {
    "overwrite:header.x-correlation-id" = "$context.requestId"
    "overwrite:header.x-cliente-id"     = "$context.authorizer.clienteId"
  }
}

# --- authorizer ----------------------------------------------------------

resource "aws_apigatewayv2_authorizer" "jwt_cpf" {
  api_id                            = aws_apigatewayv2_api.oficina.id
  name                              = "${local.prefixo}-authorizer"
  authorizer_type                   = "REQUEST"
  authorizer_uri                    = aws_lambda_function.authorizer.invoke_arn
  authorizer_payload_format_version = "2.0"
  enable_simple_responses           = true
  identity_sources                  = ["$request.header.Authorization"]
  authorizer_result_ttl_in_seconds  = var.authorizer_cache_ttl_seconds
}

# --- rotas ---------------------------------------------------------------

# Emissao do token a partir do CPF (publica, por definicao).
resource "aws_apigatewayv2_route" "auth_token" {
  api_id    = aws_apigatewayv2_api.oficina.id
  route_key = "POST /auth/token"
  target    = "integrations/${aws_apigatewayv2_integration.auth.id}"
}

# Rotas sensiveis: exigem o JWT emitido acima.
resource "aws_apigatewayv2_route" "api_protegida" {
  api_id             = aws_apigatewayv2_api.oficina.id
  route_key          = "ANY /api/{proxy+}"
  target             = "integrations/${aws_apigatewayv2_integration.cluster.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_cpf.id
}

# Rotas publicas do backend (consulta de status, health e documentacao).
locals {
  rotas_publicas = [
    "ANY /api/public/{proxy+}",
    "GET /api/health",
    "GET /api/actuator/health",
    "GET /api/actuator/health/{proxy+}",
    "GET /api/swagger-ui.html",
    "GET /api/swagger-ui/{proxy+}",
    "GET /api/v3/api-docs",
    "GET /api/v3/api-docs/{proxy+}",
  ]
}

resource "aws_apigatewayv2_route" "publicas" {
  for_each = toset(local.rotas_publicas)

  api_id    = aws_apigatewayv2_api.oficina.id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.cluster.id}"
}

# --- stage + logs de acesso ---------------------------------------------

resource "aws_cloudwatch_log_group" "acesso" {
  name              = "/aws/apigateway/${local.prefixo}"
  retention_in_days = var.log_retention_days
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.oficina.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit   = var.throttling_burst_limit
    throttling_rate_limit    = var.throttling_rate_limit
    detailed_metrics_enabled = true
  }

  # Log de acesso em JSON — mesma forma dos logs da aplicacao e da Lambda,
  # o que permite correlacionar pelo requestId no New Relic.
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.acesso.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      correlationId  = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      path           = "$context.path"
      status         = "$context.status"
      responseLength = "$context.responseLength"
      latencyMs      = "$context.responseLatency"
      integrationMs  = "$context.integration.latency"
      clienteId      = "$context.authorizer.clienteId"
      erro           = "$context.error.message"
    })
  }
}
