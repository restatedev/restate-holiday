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

resource "aws_iam_role" "flight_role" {
  name = "${local.project_name}-flight-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
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
  role       = aws_iam_role.flight_role.name
  policy_arn = aws_iam_policy.flight_policy.arn
}

data "archive_file" "flight" {
  type        = "zip"
  source_file = "${path.module}/dist/flights.js"
  output_path = "${path.module}/dist/flights.zip"
}

resource "aws_lambda_function" "flight_function" {
  function_name    = "${local.project_name}-services"
  role             = aws_iam_role.flight_role.arn
  runtime          = "nodejs16.x"
  handler          = "index.handler"
  filename         = "${path.module}/dist/flights.zip"
  source_code_hash = data.archive_file.flight.output_base64sha256
  environment {
    variables = {
      FLIGHTS_TABLE_NAME  = aws_dynamodb_table.Flights.name
    }
  }
}

resource "aws_iam_role" "car_rental_role" {
  name = "${local.project_name}-car-rental-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
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
  role       = aws_iam_role.car_rental_role.name
  policy_arn = aws_iam_policy.car_rental_policy.arn
}

data "archive_file" "car_rental" {
  type        = "zip"
  source_file = "${path.module}/dist/cars.js"
  output_path = "${path.module}/dist/cars.zip"
}

resource "aws_lambda_function" "car_rental_function" {
  function_name    = "${local.project_name}-car-rental-fn"
  role             = aws_iam_role.car_rental_role.arn
  handler          = "index.handler"
  runtime          = "nodejs16.x"
  filename         = "${path.module}/dist/cars.zip"
  source_code_hash = data.archive_file.car_rental.output_base64sha256
  environment {
    variables = {
      CARS_TABLE_NAME= aws_dynamodb_table.Rentals.name
    }
  }
}

resource "aws_iam_role" "payment_role" {
  name = "${local.project_name}-payment-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
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
  role       = aws_iam_role.payment_role.name
  policy_arn = aws_iam_policy.payment_policy.arn
}

data "archive_file" "payment" {
  type        = "zip"
  source_file = "${path.module}/dist/payments.js"
  output_path = "${path.module}/dist/payments.zip"
}

resource "aws_lambda_function" "payment_function" {
  function_name    = "${local.project_name}-payment-fn"
  role             = aws_iam_role.payment_role.arn
  handler          = "index.handler"
  runtime          = "nodejs16.x"
  filename         = "${path.module}/dist/payments.zip"
  source_code_hash = data.archive_file.payment.output_base64sha256
  environment {
    variables = {
      PAYMENTS_TABLE_NAME= aws_dynamodb_table.Payments.name
    }
  }
}

resource "aws_iam_role" "trip_role" {
  name = "${local.project_name}-trip-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
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
        "Resource": "${aws_sns_topic.topic.arn}"
      }
    ]
}
POLICY
}

resource "aws_iam_role_policy_attachment" "trip_policy_attachment" {
  role       = aws_iam_role.trip_role.name
  policy_arn = aws_iam_policy.trip_policy.arn
}

data "archive_file" "trip" {
  type        = "zip"
  source_file = "${path.module}/dist/trips.js"
  output_path = "${path.module}/dist/trips.zip"
}

resource "aws_lambda_function" "trip_function" {
  function_name    = "${local.project_name}-trip-fn"
  role             = aws_iam_role.trip_role.arn
  handler          = "index.handler"
  runtime          = "nodejs16.x"
  filename         = "${path.module}/dist/trips.zip"
  source_code_hash = data.archive_file.trip.output_base64sha256
  environment {
    variables = {
      SNS_TOPIC = aws_sns_topic.topic.arn
    }
  }
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
