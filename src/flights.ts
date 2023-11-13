import * as restate from "@restatedev/restate-sdk";
import {TerminalError} from "@restatedev/restate-sdk";
import {
  DeleteItemCommand,
  DynamoDBClient,
  PutItemCommand,
  ResourceNotFoundException,
  UpdateItemCommand
} from "@aws-sdk/client-dynamodb";
import {v4 as uuidv4} from "uuid";
import {carRentalRouter} from "./cars";

const dynamo = new DynamoDBClient({})
export type FlightReserveParams = { rental: string, rental_from: string, rental_to: string, run_type?: string }
const reserve = async (ctx: restate.RpcContext, tripID: string, event: FlightReserveParams): Promise<{booking_id: string}> => {
  console.log("request:", tripID, JSON.stringify(event, undefined, 2));

  const flightReservationID = await ctx.sideEffect(async () => uuidv4())
  console.log("flightReservationID:", flightReservationID)

  // Pass the parameter to fail this step
  if (event.run_type === 'failFlightsReservation') {
    throw new TerminalError('Failed to book the flights');
  }

  const put = new PutItemCommand({
    TableName: process.env.FLIGHTS_TABLE_NAME,
    Item: {
      pk: {S: tripID},
      sk: {S: flightReservationID},
      'trip_id': {S: tripID},
      'id': {S: flightReservationID},
      'rental': {S: event.rental},
      'rental_from': {S: event.rental_from},
      'rental_to': {S: event.rental_to},
      'transaction_status': {S: 'pending'}
    }
  })
  const result = await ctx.sideEffect(() => dynamo.send(put))

  console.log('inserted flight reservation:');
  console.log(result);

  return {booking_id: flightReservationID}
};

type ConfirmParams = { booking_id: string, run_type?: string }

const confirm = async (ctx: restate.RpcContext, tripID: string, event: ConfirmParams): Promise<{booking_id: string}> => {
  console.log("request:", tripID, JSON.stringify(event, undefined, 2));

  // Pass the parameter to fail this step
  if (event.run_type === 'failFlightsConfirmation') {
    throw new TerminalError('Failed to book the flights');
  }

  const update = new UpdateItemCommand({
    TableName: process.env.FLIGHTS_TABLE_NAME,
    Key: {
      pk: {S: tripID},
      sk: {S: event.booking_id},
    },
    UpdateExpression: "set transaction_status = :booked",
    ExpressionAttributeValues: {
      ":booked": {"S": "confirmed"}
    }
  })

  const result = await ctx.sideEffect(() => dynamo.send(update))

  console.log('confirmed flight reservation:');
  console.log(result);

  return {booking_id: event.booking_id}
}

type CancelParams = { booking_id: string }

const cancel = async (ctx: restate.RpcContext, tripID: string, event: CancelParams) => {
  console.log("request:", tripID, JSON.stringify(event, undefined, 2));

  const del = new DeleteItemCommand({
    TableName: process.env.FLIGHTS_TABLE_NAME,
    Key: {
      'pk': {S: tripID},
      'sk': {S: event.booking_id}
    }
  });

  const result = await ctx.sideEffect(() => dynamo.send(del))

  console.log('deleted flight reservation:');
  console.log(result);

  return {}
}


export const flightsRouter = restate.keyedRouter({reserve, confirm, cancel})
export const flightsService: restate.ServiceApi<typeof flightsRouter> = {path: "flights"}

