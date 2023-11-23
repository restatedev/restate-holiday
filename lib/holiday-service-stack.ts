import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import { CfnOutput, RemovalPolicy } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Architecture } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as restate from "@restatedev/cdk-support";

export interface HolidayServiceStackProps extends cdk.StackProps {
  /**
   * If set, create a role for the Restate managed service to assume with permission to invoke Lambda handlers.
   */
  managedServiceClusterId?: string;
}

export class HolidayServiceStack extends cdk.Stack {
  readonly restateServices: restate.LambdaServiceCollectionProps;

  constructor(scope: Construct, id: string, props?: HolidayServiceStackProps) {
    super(scope, id, props);

    // Create Dynamo DB tables for flights, car rental reservations, and payments information.
    const flightTable = new dynamodb.Table(this, "Flights", {
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
    });
    new CfnOutput(this, "FlightTable", { value: flightTable.tableName, exportName: "flightsTableName" });

    const rentalTable = new dynamodb.Table(this, "Rentals", {
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
    });
    new CfnOutput(this, "CarTable", { value: rentalTable.tableName, exportName: "carsTableName" });

    const paymentTable = new dynamodb.Table(this, "Payments", {
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
    });
    new CfnOutput(this, "PaymentTable", { value: paymentTable.tableName, exportName: "paymentsTableName" });

    // SNS Topic, Subscription configuration
    const topic = new sns.Topic(this, "Topic");
    topic.addSubscription(new subscriptions.SmsSubscription("+11111111111"));

    // Lambda deployments of Restate service handlers: Trips provides the main entry point, and orchestrates the rest.
    const tripLambda = lambdaHandler(this, "TripHandler", "src/trips.ts", { SNS_TOPIC: topic.topicArn });
    topic.grantPublish(tripLambda);
    new CfnOutput(this, "TripLambda", { value: tripLambda.currentVersion.functionArn, exportName: "tripsLambdaArn" });

    const flightLambda = lambdaHandler(this, "FlightHandler", "src/flights.ts", {
      FLIGHTS_TABLE_NAME: flightTable.tableName,
    });
    flightTable.grantReadWriteData(flightLambda);
    new CfnOutput(this, "FlightLambda", {
      value: flightLambda.currentVersion.functionArn,
      exportName: "flightsLambdaArn",
    });

    const rentalLambda = lambdaHandler(this, "RentalHandler", "src/cars.ts", {
      CARS_TABLE_NAME: rentalTable.tableName,
    });
    rentalTable.grantReadWriteData(rentalLambda);
    new CfnOutput(this, "CarLambda", { value: rentalLambda.currentVersion.functionArn, exportName: "carsLambdaArn" });

    const paymentLambda = lambdaHandler(this, "PaymentHandler", "src/payments.ts", {
      PAYMENTS_TABLE_NAME: paymentTable.tableName,
    });
    paymentTable.grantReadWriteData(paymentLambda);
    new CfnOutput(this, "PaymentLambda", {
      value: paymentLambda.currentVersion.functionArn,
      exportName: "paymentsLambdaArn",
    });

    this.restateServices = {
      serviceHandlers: {
        trips: tripLambda,
        flights: flightLambda,
        cars: rentalLambda,
        payments: paymentLambda,
      },
    };

    if (props?.managedServiceClusterId) {
      const managed_service_role = new iam.Role(this, "RestateManagedServiceRole", {
        assumedBy: new iam.ArnPrincipal("arn:aws:iam::663487780041:role/restate-dev"),
        externalIds: [props.managedServiceClusterId],
      });

      for (const lambda of [flightLambda, rentalLambda, paymentLambda, tripLambda]) {
        lambda.grantInvoke(managed_service_role);
      }

      new CfnOutput(this, "ManagedServiceAssumeRole", {
        value: managed_service_role.roleArn,
        exportName: "assumeRoleArn",
      });
    }
  }
}

function lambdaHandler(scope: Construct, id: string, handler: string, environment: { [key: string]: string }) {
  return new NodejsFunction(scope, id, {
    runtime: lambda.Runtime.NODEJS_18_X,
    entry: handler,
    architecture: Architecture.ARM_64,
    awsSdkConnectionReuse: true,
    bundling: {
      externalModules: ["aws-sdk"], // Use the 'aws-sdk' available in the Lambda runtime
    },
    environment: {
      NODE_OPTIONS: "--enable-source-maps",
      ...environment,
    },
  });
}
