/*
 * Copyright (c) 2024 - Restate Software, Inc., Restate GmbH
 *
 * This file is part of the Restate examples released under the MIT license.
 *
 * You can find a copy of the license in file LICENSE in the root
 * directory of this repository or package, or at
 * https://github.com/restatedev/sdk-typescript/blob/main/LICENSE
 */

import * as restate from "@restatedev/restate-sdk";
import { TerminalError } from "@restatedev/restate-sdk";
import { DeleteItemCommand, DynamoDBClient, PutItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import process from "process";

const dynamo = new DynamoDBClient({ endpoint: process.env.AWS_ENDPOINT });

export type FlightReserveParams = { rental: string; rental_from: string; rental_to: string; run_type?: string };
const reserve = async (
  ctx: restate.ObjectContext,
  event: FlightReserveParams,
): Promise<{ booking_id: string }> => {
  console.log("reserve flight:", ctx.key, JSON.stringify(event, undefined, 2));

  const flightReservationID = ctx.rand.uuidv4();
  console.log("flightReservationID:", flightReservationID);

  // Pass the parameter to fail this step
  if (event.run_type === "failFlightsReservation") {
    throw new TerminalError("Failed to book the flights");
  }

  const put = new PutItemCommand({
    TableName: process.env.FLIGHTS_TABLE_NAME,
    Item: {
      pk: { S: ctx.key },
      sk: { S: flightReservationID },
      trip_id: { S: ctx.key },
      id: { S: flightReservationID },
      rental: { S: event.rental },
      rental_from: { S: event.rental_from },
      rental_to: { S: event.rental_to },
      transaction_status: { S: "pending" },
    },
  });
  const result = await ctx.run(() => dynamo.send(put));

  console.log("inserted flight reservation:");
  console.log(result);

  return { booking_id: flightReservationID };
};

type ConfirmParams = { booking_id: string; run_type?: string };

const confirm = async (
  ctx: restate.ObjectContext,
  event: ConfirmParams,
): Promise<{ booking_id: string }> => {
  console.log("confirm flight:", ctx.key, JSON.stringify(event, undefined, 2));

  // Pass the parameter to fail this step
  if (event.run_type === "failFlightsConfirmation") {
    throw new TerminalError("Failed to book the flights");
  }

  const update = new UpdateItemCommand({
    TableName: process.env.FLIGHTS_TABLE_NAME,
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

  console.log("confirmed flight reservation:");
  console.log(result);

  return { booking_id: event.booking_id };
};

type CancelParams = { booking_id: string };

const cancel = async (ctx: restate.ObjectContext, event: CancelParams) => {
  console.log("cancel flight:", ctx.key, JSON.stringify(event, undefined, 2));

  const del = new DeleteItemCommand({
    TableName: process.env.FLIGHTS_TABLE_NAME,
    Key: {
      pk: { S: ctx.key },
      sk: { S: event.booking_id },
    },
  });

  const result = await ctx.run(() => dynamo.send(del));

  console.log("deleted flight reservation:");
  console.log(result);

  return {};
};

export const flightsObject = restate.object({ name: "flights", handlers: { reserve, confirm, cancel } });

export type FlightsObject = typeof flightsObject;

export const handler = restate
  .endpoint()
  .bind(flightsObject)
  .lambdaHandler();
