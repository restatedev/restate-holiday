terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~>4.0"
    }
  }
}

provider "aws" {
  region = "eu-central-1"
}

locals {
  project_name = "restate-holiday"
}

data "aws_caller_identity" "caller" {}
data "aws_partition" "partition" {}

resource "aws_iam_role" "lambda_role" {
  name               = "${local.project_name}-lambda-role"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [
      {
        Action : "sts:AssumeRole"
        Effect : "Allow"
        Sid : ""
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_policy" "flight_policy" {
  name = "${local.project_name}_flight_policy"

  policy = <<POLICY
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem"
            ],
            "Resource": "arn:aws:dynamodb:*:*:table/${local.project_name}-Flights"
        },
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "*"
        }
    ]
}
POLICY
}

resource "aws_iam_role_policy_attachment" "flight_policy_attachment" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.flight_policy.arn
}

resource "aws_lambda_function" "services" {
  function_name    = "${local.project_name}-services"
  role             = aws_iam_role.lambda_role.arn
  runtime          = "nodejs16.x"
  handler          = "index.handler"
  filename         = "${path.module}/dist/index.zip"
  source_code_hash = filebase64sha256("${path.module}/dist/index.zip")
  environment {
    variables = {
      FLIGHTS_TABLE_NAME  = aws_dynamodb_table.Flights.name
      CARS_TABLE_NAME     = aws_dynamodb_table.Rentals.name
      PAYMENTS_TABLE_NAME = aws_dynamodb_table.Payments.name
    }
  }
}

resource "aws_iam_policy" "car_rental_policy" {
  name = "${local.project_name}_car_rental_policy"

  policy = <<POLICY
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem"
            ],
            "Resource": "arn:aws:dynamodb:*:*:table/${local.project_name}-Rentals"
        },
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "*"
        }
    ]
}
POLICY
}

resource "aws_iam_role_policy_attachment" "car_rental_policy_attachment" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.car_rental_policy.arn
}

resource "aws_iam_policy" "payment_policy" {
  name = "${local.project_name}_payment_policy"

  policy = <<POLICY
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:PutItem",
                "dynamodb:DeleteItem"
            ],
            "Resource": "arn:aws:dynamodb:*:*:table/${local.project_name}-Payments"
        },
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "*"
        }
    ]
}
POLICY
}

resource "aws_iam_role_policy_attachment" "payment_policy_attachment" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.payment_policy.arn
}

resource "aws_iam_policy" "trip_policy" {
  name = "${local.project_name}_trip_policy"

  policy = <<POLICY
{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Action": [
          "SNS:Publish"
        ],
        "Effect": "Allow",
        "Resource": ${aws_sns_topic.topic.arn}
      }
    ]
}
POLICY
}

resource "aws_iam_role_policy_attachment" "trip_policy_attachment" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.trip_policy.arn
}


resource "aws_dynamodb_table" "Flights" {
  name         = "${local.project_name}-Flights"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"
  attribute {
    name = "pk"
    type = "S"
  }
  attribute {
    name = "sk"
    type = "S"
  }
}
resource "aws_dynamodb_table" "Rentals" {
  name         = "${local.project_name}-Rentals"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"
  attribute {
    name = "pk"
    type = "S"
  }
  attribute {
    name = "sk"
    type = "S"
  }
}
resource "aws_dynamodb_table" "Payments" {
  name         = "${local.project_name}-Payments"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"
  attribute {
    name = "pk"
    type = "S"
  }
  attribute {
    name = "sk"
    type = "S"
  }
}
resource "aws_sns_topic" "topic" {
  display_name      = "${local.project_name}-booking-topic"
  name              = "${local.project_name}-booking-topic"
  kms_master_key_id = "alias/aws/sns"
}

resource "aws_sns_topic_subscription" "sms-target" {
  topic_arn = aws_sns_topic.topic.arn
  protocol  = "sms"
  endpoint  = "+447411372882"
}
