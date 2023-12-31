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

import * as restate from "@restatedev/restate-sdk";
import { TerminalError } from "@restatedev/restate-sdk";
import { DeleteItemCommand, DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

const dynamo = new DynamoDBClient({ endpoint: global.process.env.AWS_ENDPOINT });

type ProcessParams = { run_type?: string };

const process = async (ctx: restate.RpcContext, tripID: string, event: ProcessParams) => {
  console.log("process payment:", tripID);

  const paymentID = ctx.rand.uuidv4();

  // Pass the parameter to fail this step
  if (event.run_type === "failPayment") {
    throw new TerminalError("Failed to process payment");
  }

  const put = new PutItemCommand({
    TableName: global.process.env.PAYMENTS_TABLE_NAME,
    Item: {
      pk: { S: tripID },
      sk: { S: paymentID },
      trip_id: { S: tripID },
      id: { S: paymentID },
      amount: { S: "750.00" },
      currency: { S: "USD" },
      transaction_status: { S: "confirmed" },
    },
  });

  const result = await ctx.sideEffect(() => dynamo.send(put));

  console.log("Payment Processed Successfully:");
  console.log(result);

  return {
    payment_id: paymentID,
  };
};

type RefundParams = { payment_id: string };

const refund = async (ctx: restate.RpcContext, tripID: string, event: RefundParams) => {
  console.log("refund payment:", tripID, JSON.stringify(event, undefined, 2));

  const del = new DeleteItemCommand({
    TableName: global.process.env.PAYMENTS_TABLE_NAME,
    Key: {
      pk: { S: tripID },
      sk: { S: event.payment_id },
    },
  });

  const result = await ctx.sideEffect(() => dynamo.send(del));

  console.log("Payment has been refunded");
  console.log(result);

  return {};
};

export const paymentsRouter = restate.keyedRouter({ process, refund });
export const paymentsService: restate.ServiceApi<typeof paymentsRouter> = { path: "payments" };
export const handler = restate
  .createLambdaApiGatewayHandler()
  .bindKeyedRouter(paymentsService.path, paymentsRouter)
  .handle();
