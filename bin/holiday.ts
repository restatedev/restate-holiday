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

enum DeploymentMode {
  SELF_HOSTED = "self-hosted",
  MANAGED_SERVICE = "managed",
}

function addPrefix(name: string, prefix?: string) {
  if (!prefix) return name;
  return `${prefix}-${name}`;
}

const app = new cdk.App();

const managedServiceClusterId = app.node.tryGetContext("clusterId") ?? process.env["MANAGED_SERVICE_CLUSTER_ID"];
const deploymentMode = app.node.tryGetContext("deploymentMode") ?? DeploymentMode.SELF_HOSTED;

switch (deploymentMode) {
  case DeploymentMode.MANAGED_SERVICE:
    if (!managedServiceClusterId) {
      throw new Error("Expected a cluster id to be provided for managed service deployment mode.");
    }
    console.log(`Deploying in managed service mode, cluster id: ${managedServiceClusterId}`);
    break;

  case DeploymentMode.SELF_HOSTED:
    console.log("Deploying in self-hosted mode.");
    break;

  default:
    throw new Error(`Unknown deployment mode "${deploymentMode}". Expected one of: ${Object.values(DeploymentMode)}`);
}

const prefix = app.node.tryGetContext("prefix");

const restateStack = deploymentMode === DeploymentMode.SELF_HOSTED ?
  new SelfHostedRestateStack(app, addPrefix("RestateStack", prefix), {
    prefix,
    ingressCertificateArn: app.node.tryGetContext("ingressCertificateArn") ?? process.env["INGRESS_CERTIFICATE_ARN"],
  }) : null;

new HolidayServiceStack(app, addPrefix("HolidayTripsServiceStack", prefix), {
  managedServiceClusterId,
  restateInstance: restateStack?.restateInstance,
  registrationProviderToken: restateStack?.registrationProviderToken.value,
});