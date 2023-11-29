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
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import * as restate from "@restatedev/restate-cdk";

export class SelfHostedRestateStack extends cdk.Stack {
  readonly restateInstance: restate.RestateInstance;
  readonly registrationProviderToken: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props: cdk.StackProps & { prefix: string; }) {
    super(scope, id, props);

    const restateInstance = new restate.SingleNodeRestateInstance(this, "Restate", {
      ...props,
      restateTag: "0.5.0",
      tracing: restate.TracingMode.AWS_XRAY,
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