/*
 * Copyright (c) 2024 - Restate Software, Inc., Restate GmbH
 *
 * This file is part of the Restate examples released under the MIT license.
 *
 * You can find a copy of the license in file LICENSE in the root
 * directory of this repository or package, or at
 * https://github.com/restatedev/sdk-typescript/blob/main/LICENSE
 */

import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { HolidayServiceStack } from "../lib/holiday-service-stack";

const app = new cdk.App();
new HolidayServiceStack(app, "HolidayTripsServiceStack", {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  restateCloudEnvironmentId: app.node.tryGetContext("cloudEnvironmentId"),
  deploySelfHostedRestateEnvironment: app.node.tryGetContext("deploySelfHostedRestateEnvironment"),

  // Setting an explicit token secret ARN takes precedence over other methods.
  authTokenSecretArn: app.node.tryGetContext("authTokenSecretArn"),

  // Alternatively, you can set the token as plaintext. The secret will appear in the CloudFormation template!
  authTokenUnsafePlaintext: app.node.tryGetContext("authToken"),

  // If you don't provide a secret, the service deployer will attempt to use a secret with a name
  // "/restate-holiday/auth-token". See create-auth-token-secret.ts for an example of how to create it.
});
