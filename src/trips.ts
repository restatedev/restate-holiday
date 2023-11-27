import * as restate from "@restatedev/restate-sdk";
import { TerminalError } from "@restatedev/restate-sdk";
import { carRentalService } from "./cars";
import { flightsService } from "./flights";
import { paymentsService } from "./payments";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import * as process from "process";

const sns = new SNSClient({ endpoint: process.env.AWS_ENDPOINT });

const reserve = async (ctx: restate.RpcContext, request?: { run_type?: string; trip_id?: string }) => {
  console.log("reserve trip:", JSON.stringify(request, undefined, 2));

  const tripID = request?.trip_id ?? ctx.rand.uuidv4();

  let input = {
    trip_id: tripID,
    depart_city: "Detroit",
    depart_time: "2021-07-07T06:00:00.000Z",
    arrive_city: "Frankfurt",
    arrive_time: "2021-07-09T08:00:00.000Z",
    rental: "BMW",
    rental_from: "2021-07-09T00:00:00.000Z",
    rental_to: "2021-07-17T00:00:00.000Z",
    run_type: request?.run_type,
  };

  // set up RPC clients
  const flights = ctx.rpc(flightsService);
  const carRentals = ctx.rpc(carRentalService);
  const payments = ctx.rpc(paymentsService);

  // create an undo stack
  const undos = [];
  try {
    // call the flights Lambda to reserve, keeping track of how to cancel
    const flight_booking = await flights.reserve(tripID, input);
    undos.push(() => flights.cancel(tripID, flight_booking));

    // RPC the rental service to reserve, keeping track of how to cancel
    const car_booking = await carRentals.reserve(tripID, input);
    undos.push(() => carRentals.cancel(tripID, car_booking));

    // RPC the payments service to process, keeping track of how to refund
    const payment = await payments.process(tripID, { run_type: input.run_type });
    undos.push(() => payments.refund(tripID, payment));

    // confirm the flight and car
    await flights.confirm(tripID, flight_booking);
    await flights.confirm(tripID, car_booking);

    // simulate a failing SNS call
    if (request?.run_type === "failNotification") {
      await Promise.reject(new TerminalError("Failed to send notification"));
    }
  } catch (e) {
    // undo all the steps up to this point
    for (const undo of undos.reverse()) {
      await undo()
    }

    // notify failure
    await ctx.sideEffect(() => sns.send(new PublishCommand({
      TopicArn: process.env.SNS_TOPIC,
      Message: "Your Travel Reservation Failed",
    })));

    // exit with an error
    throw new TerminalError(`Travel reservation failed with err '${e}'; successfully applied ${undos.length} compensations`, {
      cause: e,
    });
  }

  // notify success
  await ctx.sideEffect(async () => (process.env.SNS_TOPIC ? await sns.send(new PublishCommand({
    TopicArn: process.env.SNS_TOPIC,
    Message: "Your Travel Reservation is Successful",
  })) : {}));
};

export const tripsRouter = restate.router({ reserve });
export const tripsService: restate.ServiceApi<typeof tripsRouter> = { path: "trips" };

export const handler = restate.createLambdaApiGatewayHandler().bindRouter(tripsService.path, tripsRouter).handle();
