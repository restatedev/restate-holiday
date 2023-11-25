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

  const compensations: (() => void)[] = [];

  const tripID = request?.trip_id ?? ctx.rand.uuidv4();

  const input = {
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

  try {
    // call the flights Lambda to reserve, keeping track of how to cancel it
    compensations.push(() => ctx.send(flightsService).cancel(tripID, { booking_id: flight_booking_id }));
    const { booking_id: flight_booking_id } = await ctx.rpc(flightsService).reserve(tripID, input);

    // call the cars Lambda to reserve, keeping track of how to cancel it
    compensations.push(() => ctx.send(carRentalService).cancel(tripID, { booking_id: car_booking_id }));
    const { booking_id: car_booking_id } = await ctx.rpc(carRentalService).reserve(tripID, input);

    // call the payments Lambda to process, keeping track of how to refund it
    compensations.push(() => ctx.send(paymentsService).refund(tripID, { payment_id }));
    const { payment_id } = await ctx
      .rpc(paymentsService)
      .process(tripID, {
        car_booking_id,
        flight_booking_id,
        run_type: input.run_type,
      });

    // confirm the flight and car
    await ctx.rpc(flightsService).confirm(tripID, { booking_id: flight_booking_id });
    await ctx.rpc(carRentalService).confirm(tripID, { booking_id: car_booking_id });

    // simulate a failing SNS call
    if (request?.run_type === "failNotification") {
      await Promise.reject(new TerminalError("Failed to send notification"));
    }
  } catch (e) {
    // undo all the steps up to this point
    compensations.reverse().forEach((undo) => undo())

    // notify failure
    await ctx.sideEffect(() => sns.send(new PublishCommand({
      TopicArn: process.env.SNS_TOPIC,
      Message: "Your Travel Reservation Failed",
    })));

    throw new TerminalError(`Travel reservation failed with err '${e}'; successfully applied ${compensations.length} compensations`, {
      cause: e,
    });
  }

  // notify success
  await ctx.sideEffect(async () => (process.env.SNS_TOPIC ? await sns.send(new PublishCommand({
    TopicArn: process.env.SNS_TOPIC,
    Message: "Your Travel Reservation is Successful",
  })) : {}));

  return;
};

export const tripsRouter = restate.router({ reserve });
export const tripsService: restate.ServiceApi<typeof tripsRouter> = { path: "trips" };

export const handler = restate.createLambdaApiGatewayHandler().bindRouter(tripsService.path, tripsRouter).handle();
