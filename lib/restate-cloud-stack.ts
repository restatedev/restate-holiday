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
import * as restate from "@restatedev/restate-cdk";
import { Construct } from "constructs";

export class RestateCloudStack extends cdk.Stack {
  readonly restateInstance: restate.RestateInstance;
  readonly registrationProviderToken: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props: cdk.StackProps & restate.ManagedRestateProps) {
    super(scope, id, props);

    const restateInstance = new restate.ManagedRestate(this, "Restate", {
      ...props,
    });
    this.restateInstance = restateInstance;

    new cdk.CfnOutput(this, "RestateIngressEndpoint", {
      value: restateInstance.ingressEndpoint,
    });

    this.registrationProviderToken = restateInstance.registrationProviderToken;
  }
}
