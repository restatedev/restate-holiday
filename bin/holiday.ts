#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { HolidayServiceStack } from "../lib/holiday-service-stack";

function addPrefix(name: string, prefix?: string) {
  if (!prefix) return name;
  return `${prefix}-${name}`;
}

const app = new cdk.App();

const prefix = app.node.tryGetContext("prefix") ?? process.env["USER"];
new HolidayServiceStack(app, addPrefix("RestateHolidayStack", prefix), {
  managedServiceClusterId: process.env.MANAGED_SERVICE_CLUSTER,
});