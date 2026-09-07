# O segredo HS256 e emitido aqui (dono do fluxo de autenticacao) e consumido
# por tres pontos: esta Lambda, o Lambda Authorizer e a aplicacao no EKS.
# Nenhum deles ve o valor em codigo — todos leem do Secrets Manager em runtime.

resource "random_password" "jwt" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret" "jwt" {
  name                    = "${local.prefixo}/auth/jwt-secret"
  description             = "Segredo HS256 compartilhado entre a Lambda de autenticacao e a API"
  recovery_window_in_days = var.environment == "prod" ? 30 : 0
}

resource "aws_secretsmanager_secret_version" "jwt" {
  secret_id     = aws_secretsmanager_secret.jwt.id
  secret_string = random_password.jwt.result

  lifecycle {
    # Rotacao manual/externa nao deve ser sobrescrita por um apply.
    ignore_changes = [secret_string]
  }
}

resource "aws_ssm_parameter" "jwt_secret_arn" {
  name  = "${local.ssm_base}/auth/jwt-secret-arn"
  type  = "String"
  value = aws_secretsmanager_secret.jwt.arn
}
