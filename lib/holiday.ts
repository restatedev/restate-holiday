import {Construct} from "constructs";
import * as cdk from "aws-cdk-lib";
import {CfnOutput, RemovalPolicy} from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import {Architecture} from "aws-cdk-lib/aws-lambda";
import {NodejsFunction} from 'aws-cdk-lib/aws-lambda-nodejs';
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";

export class RestateHolidayStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const holiday = new RestateHoliday(this, 'RestateHoliday');
  }
}

export class RestateHoliday extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    /**
     * Create Dynamo DB tables which holds flights and car rentals reservations as well as payments information
     */
    const flightTable = new dynamodb.Table(this, 'Flights', {
      partitionKey: {name: 'pk', type: dynamodb.AttributeType.STRING},
      sortKey: {name: 'sk', type: dynamodb.AttributeType.STRING},
      removalPolicy: RemovalPolicy.DESTROY,
    })
    new CfnOutput(this, 'FlightTable', {value: flightTable.tableName, exportName: "flightsTableName"});

    const rentalTable = new dynamodb.Table(this, 'Rentals', {
      partitionKey: {name: 'pk', type: dynamodb.AttributeType.STRING},
      sortKey: {name: 'sk', type: dynamodb.AttributeType.STRING},
      removalPolicy: RemovalPolicy.DESTROY,
    })
    new CfnOutput(this, 'CarTable', {value: rentalTable.tableName, exportName: "carsTableName"});

    const paymentTable = new dynamodb.Table(this, 'Payments', {
      partitionKey: {name: 'pk', type: dynamodb.AttributeType.STRING},
      sortKey: {name: 'sk', type: dynamodb.AttributeType.STRING},
      removalPolicy: RemovalPolicy.DESTROY,
    })
    new CfnOutput(this, 'PaymentTable', {value: paymentTable.tableName, exportName: "paymentsTableName"});

    // SNS Topic, Subscription configuration
    const topic = new sns.Topic(this, 'Topic');
    topic.addSubscription(new subscriptions.SmsSubscription('+11111111111'));

    /**
     * Create Lambda Functions for booking and cancellation of services.
     */

      // Flights
    let flightLambda = this.createLambda(this, 'flightLambdaHandler', 'src/flights.ts', {"FLIGHTS_TABLE_NAME": flightTable.tableName});
    flightTable.grantReadWriteData(flightLambda);
    new CfnOutput(this, 'FlightLambda', {value: flightLambda.currentVersion.functionArn, exportName: "flightsLambdaArn"});

    // Car Rentals
    let rentalLambda = this.createLambda(this, 'rentalLambdaHandler', 'src/cars.ts', {"CARS_TABLE_NAME": rentalTable.tableName});
    rentalTable.grantReadWriteData(rentalLambda);
    new CfnOutput(this, 'CarLambda', {value: rentalLambda.currentVersion.functionArn, exportName: "carsLambdaArn"});

    // Payment
    let paymentLambda = this.createLambda(this, 'paymentLambdaHandler', 'src/payments.ts', {"PAYMENTS_TABLE_NAME": paymentTable.tableName});
    paymentTable.grantReadWriteData(paymentLambda);
    new CfnOutput(this, 'PaymentLambda', {value: paymentLambda.currentVersion.functionArn, exportName: "paymentsLambdaArn"});

    // Trip
    let tripLambda = this.createLambda(this, 'tripLambdaHandler', 'src/trips.ts', {"SNS_TOPIC": topic.topicArn});
    topic.grantPublish(tripLambda)
    new CfnOutput(this, 'TripLambda', {value: tripLambda.currentVersion.functionArn, exportName: "tripsLambdaArn"});

    if (process.env.MANAGED_SERVICE_CLUSTER) {
      // create a role for the managed service to assume
      const managed_service_role = new iam.Role(
        this,
        "ManagedServiceRole",
        {
          assumedBy: new iam.ArnPrincipal("arn:aws:iam::663487780041:role/restate-dev"),
          externalIds: [process.env.MANAGED_SERVICE_CLUSTER],
        },
      )

      for (let lambda of [flightLambda, rentalLambda, paymentLambda, tripLambda]) {
        lambda.grantInvoke(managed_service_role)
      }

      new CfnOutput(this, 'ManagedServiceAssumeRole', {value: managed_service_role.roleArn, exportName: "assumeRoleArn"});
    }
  }

  /**
   * Utility method to create Lambda blueprint
   * @param scope
   * @param id
   * @param handler
   * @param environment
   */
  createLambda(scope: Construct, id: string, handler: string, environment: { [key: string]: string; }) {

    const fn = new NodejsFunction(scope, id, {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: handler,
      architecture: Architecture.ARM_64,
      awsSdkConnectionReuse: true,
      bundling: {
        externalModules: ['aws-sdk'], // Use the 'aws-sdk' available in the Lambda runtime
      },
      environment,
    });

    return fn;
  }
}
