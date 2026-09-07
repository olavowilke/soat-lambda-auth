data "aws_iam_policy_document" "assume_lambda" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = "${local.prefixo}-lambda-auth"
  assume_role_policy = data.aws_iam_policy_document.assume_lambda.json
}

# ENIs nas subnets privadas — necessario para a Lambda alcancar o RDS.
resource "aws_iam_role_policy_attachment" "vpc_access" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

data "aws_iam_policy_document" "lambda" {
  statement {
    sid       = "Logs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.auth.arn}:*", "${aws_cloudwatch_log_group.authorizer.arn}:*"]
  }

  statement {
    sid     = "LerSegredos"
    actions = ["secretsmanager:GetSecretValue"]
    resources = [
      aws_secretsmanager_secret.jwt.arn,
      data.aws_ssm_parameter.db_secret_arn.value,
    ]
  }
}

resource "aws_iam_role_policy" "lambda" {
  name   = "${local.prefixo}-lambda-auth"
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.lambda.json
}
