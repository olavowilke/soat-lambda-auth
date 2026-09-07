locals {
  prefixo      = "${var.project}-${var.environment}"
  ssm_base     = "/${var.project}/${var.environment}"
  jwt_issuer   = "oficina-auth"
  jwt_audience = "oficina-api"
}
