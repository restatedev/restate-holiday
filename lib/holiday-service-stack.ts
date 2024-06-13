/*
 * Copyright (c) 2024 - Restate Software, Inc., Restate GmbH
 *
 * This file is part of the Restate examples released under the MIT license.
 *
 * You can find a copy of the license in file LICENSE in the root
 * directory of this repository or package, or at
 * https://github.com/restatedev/sdk-typescript/blob/main/LICENSE
 */

import * as restate from "@restatedev/restate-cdk";
import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as secrets_manager from "aws-cdk-lib/aws-secretsmanager";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import { Construct } from "constructs";

export interface HolidayServiceStackProps extends cdk.StackProps {
  /**
   * The easiest option to deploy this stack is to provide the ID of an existing Restate Cloud environment.
   * Visit https://restate.dev/ to create an account and set up a free environment.
   */
  restateCloudEnvironmentId?: string;

  /**
   * An alternative to Restate Cloud is to deploy a self-hosted Restate environment. Setting this flag to
   * true will deploy a single-node Restate environment on an EC2 instance running in your default VPC.
   */
  deploySelfHostedRestateEnvironment?: boolean;

  /**
   * If using a Restate Cloud environment, provide the ARN of a Secret containing your API key. The key
   * must have either Admin or Full access role in order to deploy the services.
   */
  authTokenSecretArn?: string;

  /**
   * You can also provide the Restate API key directly. The secret will be visible in the CloudFormation template.
   */
  authTokenUnsafePlaintext?: string;
}

/**
 * Stack defining a set of service handlers. This stack is agnostic of the type of Restate service – self-hosted
 * or managed service – that will be used.
 */
export class HolidayServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: HolidayServiceStackProps) {
    super(scope, id, props);

    const flightsTable = new dynamodb.Table(this, "Flights", {
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });
    new cdk.CfnOutput(this, "flightsTableName", { value: flightsTable.tableName });

    const carsTable = new dynamodb.Table(this, "Cars", {
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });
    new cdk.CfnOutput(this, "carsTableName", { value: carsTable.tableName });

    const paymentsTable = new dynamodb.Table(this, "Payments", {
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });
    new cdk.CfnOutput(this, "paymentsTableName", { value: paymentsTable.tableName });

    // SNS Topic, Subscription configuration
    const topic = new sns.Topic(this, "Topic");
    topic.addSubscription(new subscriptions.SmsSubscription("+11111111111"));

    // Lambda deployments of Restate service handlers: Trips provides the main entry point, and orchestrates the rest.
    const tripsLambda = lambdaHandler(this, "TripsHandler", "src/trips.ts", {
      SNS_TOPIC: topic.topicArn,
    });
    topic.grantPublish(tripsLambda);

    const flightsLambda = lambdaHandler(this, "FlightsHandler", "src/flights.ts", {
      FLIGHTS_TABLE_NAME: flightsTable.tableName,
    });
    flightsTable.grantReadWriteData(flightsLambda);

    const carsLambda = lambdaHandler(this, "CarsHandler", "src/cars.ts", {
      CARS_TABLE_NAME: carsTable.tableName,
    });
    carsTable.grantReadWriteData(carsLambda);

    const paymentsLambda = lambdaHandler(this, "PaymentsHandler", "src/payments.ts", {
      PAYMENTS_TABLE_NAME: paymentsTable.tableName,
    });
    paymentsTable.grantReadWriteData(paymentsLambda);

    let restateEnvironment;
    if (props.restateCloudEnvironmentId) {
      const invokerRole = restateCloudInvokerRole(this, props.restateCloudEnvironmentId);
      restateEnvironment = restate.RestateEnvironment.fromAttributes({
        adminUrl: `https://${props.restateCloudEnvironmentId.replace(/^env_/, "")}.env.us.restate.cloud:9070`,
        authToken: authTokenSecret(this, props),
        invokerRole,
      });
    } else if (props.deploySelfHostedRestateEnvironment) {
      restateEnvironment = new restate.SingleNodeRestateDeployment(this, "Restate", {
        ...props,
        restateTag: "1.0.1",
        tracing: restate.TracingMode.AWS_XRAY,
        logGroup: new logs.LogGroup(this, "RestateLogGroup", {
          logGroupName: "/restate-holiday/restate-server",
          removalPolicy: cdk.RemovalPolicy.DESTROY, // Set to RETAIN if you'd prefer to keep the logs after stack deletion
          retention: logs.RetentionDays.ONE_MONTH,
        }),
      });

      new cdk.CfnOutput(this, "RestateIngressUrl", {
        value: restateEnvironment.ingressUrl,
      });
    } else {
      throw new Error("Either restateCloudEnvironmentId or deploySelfHostedRestateEnvironment must be set.");
    }

    const deployer = new restate.ServiceDeployer(this, "ServiceDeployer");
    deployer.deployService("trips", tripsLambda.currentVersion, restateEnvironment);
    deployer.deployService("flights", flightsLambda.currentVersion, restateEnvironment);
    deployer.deployService("cars", carsLambda.currentVersion, restateEnvironment);
    deployer.deployService("payments", paymentsLambda.latestVersion, restateEnvironment, { configurationVersion: new Date().toISOString() });
  }
}

function lambdaHandler(scope: Construct, id: string, handler: string, environment: { [key: string]: string }) {
  return new NodejsFunction(scope, id, {
    currentVersionOptions: {
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    },
    runtime: lambda.Runtime.NODEJS_18_X,
    entry: handler,
    architecture: lambda.Architecture.ARM_64,
    memorySize: 512,
    timeout: cdk.Duration.seconds(10),
    bundling: {
      minify: true,
      sourceMap: true,
    },
    environment: {
      NODE_OPTIONS: "--enable-source-maps",
      ...environment,
    },
  });
}

function restateCloudInvokerRole(scope: Construct, environmentId: string) {
  const invokerRole = new iam.Role(scope, "InvokerRole", {
    assumedBy: new iam.AccountPrincipal("654654156625")
      .withConditions({
        "StringEquals": {
          "sts:ExternalId": environmentId,
          "aws:PrincipalArn": "arn:aws:iam::654654156625:role/RestateCloud",
        },
      }),
  });
  invokerRole.assumeRolePolicy!.addStatements(
    new iam.PolicyStatement({
      principals: [new iam.AccountPrincipal("654654156625")],
      actions: ["sts:TagSession"],
    }),
  );
  return invokerRole;
}

function authTokenSecret(scope: Construct, props: HolidayServiceStackProps) {
  if (props.authTokenSecretArn) {
    return secrets_manager.Secret.fromSecretCompleteArn(scope, "AuthToken", props.authTokenSecretArn);
  } else if (props.authTokenUnsafePlaintext) {
    return new secrets_manager.Secret(scope, "AuthToken", {
      secretStringValue: cdk.SecretValue.unsafePlainText(props.authTokenUnsafePlaintext),
    });
  } else {
    return secrets_manager.Secret.fromSecretNameV2(scope, "AuthToken", "/restate-holiday/auth-token");
  }
}
