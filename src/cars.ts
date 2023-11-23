import * as restate from "@restatedev/restate-sdk";
import { TerminalError } from "@restatedev/restate-sdk";
import { DeleteItemCommand, DynamoDBClient, PutItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { v4 as uuidv4 } from "uuid";
import * as process from "process";

const dynamo = new DynamoDBClient({ endpoint: process.env.AWS_ENDPOINT });

export type CarReserveParams = {
  depart_city: string;
  depart_time: string;
  arrive_city: string;
  arrive_time: string;
  run_type?: string;
};

const reserve = async (ctx: restate.RpcContext, tripID: string, event: CarReserveParams) => {
  console.log("reserve car:", tripID, JSON.stringify(event, undefined, 2));

  const carRentalReservationID = await ctx.sideEffect(async () => uuidv4());
  console.log("carRentalReservationID:", carRentalReservationID);

  // Pass the parameter to fail this step
  if (event.run_type === "failCarRentalReservation") {
    throw new TerminalError("Failed to book the car rental");
  }

  const put = new PutItemCommand({
    TableName: process.env.CARS_TABLE_NAME,
    Item: {
      pk: { S: tripID },
      sk: { S: carRentalReservationID },
      trip_id: { S: tripID },
      id: { S: carRentalReservationID },
      depart_city: { S: event.depart_city },
      depart_time: { S: event.depart_time },
      arrive_city: { S: event.arrive_city },
      arrive_time: { S: event.arrive_time },
      transaction_status: { S: "pending" },
    },
  });
  const result = await ctx.sideEffect(() => dynamo.send(put));

  console.log("inserted car rental reservation:");
  console.log(result);

  return { booking_id: carRentalReservationID };
};

type ConfirmParams = { booking_id: string; run_type?: string };

const confirm = async (ctx: restate.RpcContext, tripID: string, event: ConfirmParams) => {
  console.log("confirm car:", tripID, JSON.stringify(event, undefined, 2));

  // Pass the parameter to fail this step
  if (event.run_type === "failCarRentalConfirmation") {
    throw new TerminalError("Failed to book the flights");
  }

  const update = new UpdateItemCommand({
    TableName: process.env.CARS_TABLE_NAME,
    Key: {
      pk: { S: tripID },
      sk: { S: event.booking_id },
    },
    UpdateExpression: "set transaction_status = :booked",
    ExpressionAttributeValues: {
      ":booked": { S: "confirmed" },
    },
  });

  const result = await ctx.sideEffect(() => dynamo.send(update));

  console.log("confirmed car rental reservation:");
  console.log(result);

  return { booking_id: event.booking_id };
};

type CancelParams = { booking_id: string };

const cancel = async (ctx: restate.RpcContext, tripID: string, event: CancelParams) => {
  console.log("cancel car:", tripID, JSON.stringify(event, undefined, 2));

  const del = new DeleteItemCommand({
    TableName: process.env.CARS_TABLE_NAME,
    Key: {
      pk: { S: tripID },
      sk: { S: event.booking_id },
    },
  });

  const result = await ctx.sideEffect(() => dynamo.send(del));

  console.log("deleted car rental reservation:");
  console.log(result);

  return {};
};

export const carRentalRouter = restate.keyedRouter({ reserve, confirm, cancel });
export const carRentalService: restate.ServiceApi<typeof carRentalRouter> = { path: "cars" };

export const handler = restate
  .createLambdaApiGatewayHandler()
  .bindKeyedRouter(carRentalService.path, carRentalRouter)
  .handle();
