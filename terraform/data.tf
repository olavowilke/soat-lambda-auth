# Contrato entre as stacks (ADR-0005): cada repositorio publica seus outputs no
# SSM Parameter Store e os demais leem por `data`, sem acoplar remote states.
#
# Ordem de aplicacao: infra-k8s -> infra-database -> lambda-auth.

data "aws_caller_identity" "atual" {}

data "aws_region" "atual" {}

# --- publicados por soat-infra-k8s ---------------------------------------

data "aws_ssm_parameter" "vpc_id" {
  name = "${local.ssm_base}/network/vpc-id"
}

data "aws_ssm_parameter" "private_subnet_ids" {
  name = "${local.ssm_base}/network/private-subnet-ids"
}

# SG compartilhado por todos os clientes do banco (nos do EKS e esta Lambda).
data "aws_ssm_parameter" "db_client_sg_id" {
  name = "${local.ssm_base}/network/db-client-sg-id"
}

data "aws_ssm_parameter" "vpc_link_id" {
  name = "${local.ssm_base}/network/vpc-link-id"
}

data "aws_ssm_parameter" "nlb_listener_arn" {
  name = "${local.ssm_base}/network/nlb-listener-arn"
}

# --- publicados por soat-infra-database ----------------------------------

data "aws_ssm_parameter" "db_host" {
  name = "${local.ssm_base}/database/host"
}

data "aws_ssm_parameter" "db_port" {
  name = "${local.ssm_base}/database/port"
}

data "aws_ssm_parameter" "db_name" {
  name = "${local.ssm_base}/database/name"
}

data "aws_ssm_parameter" "db_secret_arn" {
  name = "${local.ssm_base}/database/secret-arn"
}
