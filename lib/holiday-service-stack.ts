/*
 * Copyright (c) 2023 - Restate Software, Inc., Restate GmbH
 *
 * This file is part of the Restate SDK for Node.js/TypeScript,
 * which is released under the MIT license.
 *
 * You can find a copy of the license in file LICENSE in the root
 * directory of this repository or package, or at
 * https://github.com/restatedev/sdk-typescript/blob/main/LICENSE
 */

import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { BillingMode } from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as restate from "@restatedev/restate-cdk";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import { Construct } from "constructs";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";

export interface HolidayServiceStackProps extends cdk.StackProps {
  /**
   * Provides details of the Restate instance with which to register services.
   */
  restateInstance: restate.RestateInstance;

  /**
   * Service registration token obtained from the Restate construct {@link restate.RestateInstance#registrationProviderToken}.
   */
  registrationProviderToken: string;

  /**
   * Optional prefix for resources that need unique identifiers within an account.
   */
  prefix?: string;
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
      billingMode: BillingMode.PAY_PER_REQUEST,
    });

    const rentalsTable = new dynamodb.Table(this, "Rentals", {
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      billingMode: BillingMode.PAY_PER_REQUEST,
    });

    const paymentsTable = new dynamodb.Table(this, "Payments", {
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      billingMode: BillingMode.PAY_PER_REQUEST,
    });

    // SNS Topic, Subscription configuration
    const topic = new sns.Topic(this, "Topic");
    topic.addSubscription(new subscriptions.SmsSubscription("+11111111111"));

    // Lambda deployments of Restate service handlers: Trips provides the main entry point, and orchestrates the rest.
    const tripLambda = lambdaHandler(this, "TripHandler", "src/trips.ts", {
      SNS_TOPIC: topic.topicArn,
    });
    topic.grantPublish(tripLambda);

    const flightLambda = lambdaHandler(this, "FlightHandler", "src/flights.ts", {
      FLIGHTS_TABLE_NAME: flightsTable.tableName,
    });
    flightsTable.grantReadWriteData(flightLambda);

    const rentalLambda = lambdaHandler(this, "RentalHandler", "src/cars.ts", {
      CARS_TABLE_NAME: rentalsTable.tableName,
    });
    rentalsTable.grantReadWriteData(rentalLambda);

    const paymentLambda = lambdaHandler(this, "PaymentHandler", "src/payments.ts", {
      PAYMENTS_TABLE_NAME: paymentsTable.tableName,
    });
    paymentsTable.grantReadWriteData(paymentLambda);

    const handlers = new restate.LambdaServiceRegistry(this, "RestateServices", {
      serviceHandlers: {
        trips: tripLambda,
        flights: flightLambda,
        cars: rentalLambda,
        payments: paymentLambda,
      },
      restate: props.restateInstance,
    });
    handlers.register({
      metaEndpoint: props.restateInstance.metaEndpoint,
      invokerRoleArn: props.restateInstance.invokerRole.roleArn,
      authTokenSecretArn: props.restateInstance.authToken?.secretArn,
    });
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
    awsSdkConnectionReuse: true,
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
