variable "project" {
  description = "Prefixo de nomes dos recursos"
  type        = string
  default     = "oficina"
}

variable "environment" {
  description = "Ambiente logico (homolog | prod)"
  type        = string

  validation {
    condition     = contains(["homolog", "prod"], var.environment)
    error_message = "environment deve ser homolog ou prod."
  }
}

variable "aws_region" {
  description = "Regiao AWS"
  type        = string
  default     = "us-east-1"
}

variable "lambda_artifact" {
  description = "Caminho do zip com os bundles (dist/handler.mjs e dist/authorizer.mjs)"
  type        = string
  default     = "../lambda-auth.zip"
}

variable "lambda_memory_mb" {
  description = "Memoria da funcao de autenticacao (tambem define a fatia de CPU)"
  type        = number
  default     = 512
}

variable "lambda_timeout_seconds" {
  description = "Timeout da funcao de autenticacao"
  type        = number
  default     = 10
}

variable "jwt_expiration_seconds" {
  description = "Validade do token emitido"
  type        = number
  default     = 3600
}

variable "log_retention_days" {
  description = "Retencao dos logs no CloudWatch"
  type        = number
  default     = 14
}

variable "authorizer_cache_ttl_seconds" {
  description = "Cache do resultado do authorizer no API Gateway (0 desliga)"
  type        = number
  default     = 300
}

variable "throttling_burst_limit" {
  description = "Burst de requisicoes por segundo no stage do API Gateway"
  type        = number
  default     = 100
}

variable "throttling_rate_limit" {
  description = "Taxa sustentada de requisicoes por segundo no stage"
  type        = number
  default     = 50
}
