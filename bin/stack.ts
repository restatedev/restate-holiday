#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { RestateHolidayStack } from "../lib/holiday";

const app = new cdk.App();

new RestateHolidayStack(app, "RestateHolidayStack");
