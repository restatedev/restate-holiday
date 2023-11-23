import * as cdk from "aws-cdk-lib";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import * as restate from "@restatedev/cdk-support";

export class SelfHostedRestateStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps & restate.LambdaServiceCollectionProps) {
    super(scope, id, props);

    const restateInstance = new restate.SingleNodeRestateInstance(this, "Restate", {
      ...props,
      logGroup: new logs.LogGroup(this, "RestateLogGroup", {
        logGroupName: "restate",
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        retention: logs.RetentionDays.ONE_MONTH,
      }),
    });

    const services = new restate.RestateLambdaServiceCollection(this, "RestateServices", {
      serviceHandlers: {},
    });
    services.register(restateInstance);

    new cdk.CfnOutput(this, "RestateIngressEndpoint", {
      value: restateInstance.publicIngressEndpoint,
    });
  }
}