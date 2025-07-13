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
import { DeleteItemCommand, DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

const dynamo = new DynamoDBClient({ endpoint: global.process.env.AWS_ENDPOINT });

type ProcessParams = { run_type?: string };

const process = async (ctx: restate.ObjectContext, event: ProcessParams) => {
  console.log("process payment:", ctx.key);

  const paymentID = ctx.rand.uuidv4();

  // Pass the parameter to fail this step
  if (event.run_type === "failPayment") {
    throw new TerminalError("Failed to process payment");
  }

  const put = new PutItemCommand({
    TableName: global.process.env.PAYMENTS_TABLE_NAME,
    Item: {
      pk: { S: ctx.key },
      sk: { S: paymentID },
      trip_id: { S: ctx.key },
      id: { S: paymentID },
      amount: { S: "750.00" },
      currency: { S: "USD" },
      transaction_status: { S: "confirmed" },
    },
  });

  const result = await ctx.run(() => dynamo.send(put));

  console.log("Payment Processed Successfully:");
  console.log(result);

  return {
    payment_id: paymentID,
  };
};

type RefundParams = { payment_id: string };

const refund = async (ctx: restate.ObjectContext, event: RefundParams) => {
  console.log("refund payment:", ctx.key, JSON.stringify(event, undefined, 2));

  const del = new DeleteItemCommand({
    TableName: global.process.env.PAYMENTS_TABLE_NAME,
    Key: {
      pk: { S: ctx.key },
      sk: { S: event.payment_id },
    },
  });

  const result = await ctx.run(() => dynamo.send(del));

  console.log("Payment has been refunded");
  console.log(result);

  return {};
};

export const paymentsObject = restate.object({
  name: "payments",
  handlers: {
    process,
    refund,
  },
});

export type PaymentsObject = typeof paymentsObject;

export const handler = restate.endpoint().bind(paymentsObject).handler();
