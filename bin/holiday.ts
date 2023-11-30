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

import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { HolidayServiceStack } from "../lib/holiday-service-stack";
import { SelfHostedRestateStack } from "../lib/self-hosted-restate-stack";
import { ManagedRestateStack } from "../lib/managed-restate-stack";

enum DeploymentMode {
  SELF_HOSTED = "self-hosted",
  MANAGED_SERVICE = "managed",
}

function addPrefix(name: string, prefix?: string) {
  if (!prefix) return name;
  return `${prefix}-${name}`;
}

const app = new cdk.App();
const prefix = app.node.tryGetContext("prefix");

const deploymentMode = app.node.tryGetContext("deploymentMode") ?? DeploymentMode.SELF_HOSTED;
let restateStack: ManagedRestateStack | SelfHostedRestateStack;
switch (deploymentMode) {
  case DeploymentMode.MANAGED_SERVICE:
    console.log("Deploying in managed service mode.");

    restateStack = new ManagedRestateStack(app, addPrefix("RestateStack", prefix), {
      prefix,
      clusterId: requireContextAttribute(app, "clusterId"),
      authTokenSecretArn: requireContextAttribute(app, "authTokenSecretArn"),
    });
    break;

  case DeploymentMode.SELF_HOSTED:
    console.log("Deploying in self-hosted mode.");

    const ingressCertificateArn =
      app.node.tryGetContext("ingressCertificateArn") ?? process.env["INGRESS_CERTIFICATE_ARN"];
    if (!ingressCertificateArn) {
      console.warn("No certificate specified, will use plain HTTP for ingress endpoint!");
    }

    restateStack = new SelfHostedRestateStack(app, addPrefix("RestateStack", prefix), {
      prefix,
      ingressCertificateArn,
    });
    break;

  default:
    throw new Error(`Unknown deployment mode "${deploymentMode}". Expected one of: ${Object.values(DeploymentMode)}`);
}

new HolidayServiceStack(app, addPrefix("HolidayTripsServiceStack", prefix), {
  restateInstance: restateStack.restateInstance,
  registrationProviderToken: restateStack?.registrationProviderToken.value,
});

function requireContextAttribute(app: cdk.App, name: string) {
  const value = app.node.tryGetContext(name);
  if (!value) {
    throw new Error(`Required CDK application context parameter missing: "${name}"`);
  }
  return value;
}
