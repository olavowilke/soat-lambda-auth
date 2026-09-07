resource "aws_cloudwatch_log_group" "auth" {
  name              = "/aws/lambda/${local.prefixo}-auth"
  retention_in_days = var.log_retention_days
}

resource "aws_cloudwatch_log_group" "authorizer" {
  name              = "/aws/lambda/${local.prefixo}-authorizer"
  retention_in_days = var.log_retention_days
}

locals {
  ambiente_comum = {
    ENVIRONMENT            = var.environment
    JWT_SECRET_ARN         = aws_secretsmanager_secret.jwt.arn
    JWT_ISSUER             = local.jwt_issuer
    JWT_AUDIENCE           = local.jwt_audience
    JWT_EXPIRATION_SECONDS = tostring(var.jwt_expiration_seconds)
    NODE_OPTIONS           = "--enable-source-maps"
  }
}

# Funcao de autenticacao: valida o CPF, consulta o cliente no RDS e emite o JWT.
resource "aws_lambda_function" "auth" {
  function_name = "${local.prefixo}-auth"
  role          = aws_iam_role.lambda.arn
  runtime       = "nodejs22.x"
  handler       = "handler.handler"
  architectures = ["arm64"] # Graviton: ~20% mais barato para o mesmo perfil de carga

  filename         = var.lambda_artifact
  source_code_hash = filebase64sha256(var.lambda_artifact)

  memory_size = var.lambda_memory_mb
  timeout     = var.lambda_timeout_seconds

  vpc_config {
    subnet_ids         = split(",", data.aws_ssm_parameter.private_subnet_ids.value)
    security_group_ids = [data.aws_ssm_parameter.db_client_sg_id.value]
  }

  environment {
    variables = merge(local.ambiente_comum, {
      SERVICE_NAME  = "lambda-auth"
      DB_SECRET_ARN = data.aws_ssm_parameter.db_secret_arn.value
      DB_HOST       = data.aws_ssm_parameter.db_host.value
      DB_PORT       = data.aws_ssm_parameter.db_port.value
      DB_NAME       = data.aws_ssm_parameter.db_name.value
      DB_SSL        = "true"
    })
  }

  depends_on = [aws_cloudwatch_log_group.auth, aws_iam_role_policy.lambda]
}

# Authorizer: so valida a assinatura do JWT — nao precisa de VPC nem de banco,
# o que mantem o overhead por requisicao proximo de zero.
resource "aws_lambda_function" "authorizer" {
  function_name = "${local.prefixo}-authorizer"
  role          = aws_iam_role.lambda.arn
  runtime       = "nodejs22.x"
  handler       = "authorizer.handler"
  architectures = ["arm64"]

  filename         = var.lambda_artifact
  source_code_hash = filebase64sha256(var.lambda_artifact)

  memory_size = 256
  timeout     = 5

  environment {
    variables = merge(local.ambiente_comum, { SERVICE_NAME = "lambda-authorizer" })
  }

  depends_on = [aws_cloudwatch_log_group.authorizer, aws_iam_role_policy.lambda]
}

# Permissao ampla no nivel da conta/regiao para evitar dependencia circular
# entre a API (criada abaixo) e as funcoes.
resource "aws_lambda_permission" "apigw_auth" {
  statement_id  = "AllowApiGatewayInvokeAuth"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${data.aws_region.atual.name}:${data.aws_caller_identity.atual.account_id}:*/*"
}

resource "aws_lambda_permission" "apigw_authorizer" {
  statement_id  = "AllowApiGatewayInvokeAuthorizer"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.authorizer.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${data.aws_region.atual.name}:${data.aws_caller_identity.atual.account_id}:*/*"
}
