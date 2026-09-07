output "api_endpoint" {
  description = "URL publica do API Gateway"
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "auth_token_url" {
  description = "Endpoint de autenticacao por CPF"
  value       = "${aws_apigatewayv2_stage.default.invoke_url}auth/token"
}

output "lambda_auth_name" {
  description = "Nome da funcao de autenticacao"
  value       = aws_lambda_function.auth.function_name
}

output "lambda_authorizer_name" {
  description = "Nome do authorizer"
  value       = aws_lambda_function.authorizer.function_name
}

output "jwt_secret_arn" {
  description = "ARN do segredo HS256 compartilhado com a aplicacao"
  value       = aws_secretsmanager_secret.jwt.arn
}
