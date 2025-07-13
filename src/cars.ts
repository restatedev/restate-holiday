/*
 * Copyright (c) 2024 - Restate Software, Inc., Restate GmbH
 *
 * This file is part of the Restate examples released under the MIT license.
 *
 * You can find a copy of the license in file LICENSE in the root
 * directory of this repository or package, or at
 * https://github.com/restatedev/sdk-typescript/blob/main/LICENSE
 */

import * as restate from "@restatedev/restate-sdk/lambda";
import { TerminalError } from "@restatedev/restate-sdk";
import { DeleteItemCommand, DynamoDBClient, PutItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import * as process from "process";

const dynamo = new DynamoDBClient({ endpoint: process.env.AWS_ENDPOINT });

export type CarReserveParams = {
  depart_city: string;
  depart_time: string;
  arrive_city: string;
  arrive_time: string;
  run_type?: string;
};

const reserve = async (ctx: restate.ObjectContext, event: CarReserveParams) => {
  console.log("reserve car:", ctx.key, JSON.stringify(event, undefined, 2));

  const carRentalReservationID = ctx.rand.uuidv4();
  console.log("carRentalReservationID:", carRentalReservationID);

  // Pass the parameter to fail this step
  if (event.run_type === "failCarRentalReservation") {
    throw new TerminalError("Failed to book the car rental");
  }

  const put = new PutItemCommand({
    TableName: process.env.CARS_TABLE_NAME,
    Item: {
      pk: { S: ctx.key },
      sk: { S: carRentalReservationID },
      trip_id: { S: ctx.key },
      id: { S: carRentalReservationID },
      depart_city: { S: event.depart_city },
      depart_time: { S: event.depart_time },
      arrive_city: { S: event.arrive_city },
      arrive_time: { S: event.arrive_time },
      transaction_status: { S: "pending" },
    },
  });
  const result = await ctx.run(() => dynamo.send(put));

  console.log("inserted car rental reservation:");
  console.log(result);

  return { booking_id: carRentalReservationID };
};

type ConfirmParams = { booking_id: string; run_type?: string };

const confirm = async (ctx: restate.ObjectContext, event: ConfirmParams) => {
  console.log("confirm car:", ctx.key, JSON.stringify(event, undefined, 2));

  // Pass the parameter to fail this step
  if (event.run_type === "failCarRentalConfirmation") {
    throw new TerminalError("Failed to book the flights");
  }

  const update = new UpdateItemCommand({
    TableName: process.env.CARS_TABLE_NAME,
    Key: {
      pk: { S: ctx.key },
      sk: { S: event.booking_id },
    },
    UpdateExpression: "set transaction_status = :booked",
    ExpressionAttributeValues: {
      ":booked": { S: "confirmed" },
    },
  });

  const result = await ctx.run(() => dynamo.send(update));

  console.log("confirmed car rental reservation:");
  console.log(result);

  return { booking_id: event.booking_id };
};

type CancelParams = { booking_id: string };

const cancel = async (ctx: restate.ObjectContext, event: CancelParams) => {
  console.log("cancel car:", ctx.key, JSON.stringify(event, undefined, 2));

  const del = new DeleteItemCommand({
    TableName: process.env.CARS_TABLE_NAME,
    Key: {
      pk: { S: ctx.key },
      sk: { S: event.booking_id },
    },
  });

  const result = await ctx.run(() => dynamo.send(del));

  console.log("deleted car rental reservation:");
  console.log(result);

  return {};
};

export const carsObject = restate.object({
  name: "cars",
  handlers: { reserve, confirm, cancel },
});

export type CarsObject = typeof carsObject;

export const handler = restate.endpoint().bind(carsObject).handler();
