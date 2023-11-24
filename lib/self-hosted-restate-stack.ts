import * as cdk from "aws-cdk-lib";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import * as restate from "@restatedev/cdk-support";

export class SelfHostedRestateStack extends cdk.Stack {
  readonly restateInstance: restate.RestateInstance;
  readonly registrationProviderToken: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props: cdk.StackProps & { prefix: string; }) {
    super(scope, id, props);

    const restateInstance = new restate.SingleNodeRestateInstance(this, "Restate", {
      ...props,
      logGroup: new logs.LogGroup(this, "RestateLogGroup", {
        logGroupName: ["/restate", props.prefix, "restate"].filter(Boolean).join("/"), // "/restate/${PREFIX}/restate" or just "/restate/restate" on empty prefix
        removalPolicy: cdk.RemovalPolicy.DESTROY, // Set to RETAIN if you'd prefer to keep the logs after stack deletion
        retention: logs.RetentionDays.ONE_MONTH,
      }),
    });
    this.restateInstance = restateInstance;

    new cdk.CfnOutput(this, "RestateIngressEndpoint", {
      value: restateInstance.publicIngressEndpoint,
    });
    new cdk.CfnOutput(this, "RestateHostInstanceId", {
      value: restateInstance.instance.instanceId,
      description: "Restate service host EC2 instance id",
    });

    this.registrationProviderToken = restateInstance.registrationProviderToken;
  }
}