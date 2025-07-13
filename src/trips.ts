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
import { CarsObject } from "./cars";
import { FlightsObject } from "./flights";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import * as process from "process";
import { PaymentsObject } from "./payments";

const sns = new SNSClient({ endpoint: process.env.AWS_ENDPOINT });

const reserve = async (ctx: restate.Context, request?: { run_type?: string; trip_id?: string }) => {
  console.log("reserve trip:", JSON.stringify(request, undefined, 2));

  const tripId = request?.trip_id ?? ctx.rand.uuidv4();

  let input = {
    trip_id: tripId,
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
  const flights = ctx.objectClient({ name: "flights" } as FlightsObject, tripId);
  const cars = ctx.objectClient({ name: "cars" } as CarsObject, tripId);
  const payments = ctx.objectClient({ name: "payments" } as PaymentsObject, tripId);

  // create an undo stack
  const undos = [];
  try {
    // call the flights Lambda to reserve, keeping track of how to cancel
    const flight_booking = await flights.reserve(input);
    undos.push(() => flights.cancel(flight_booking));

    // RPC the rental service to reserve, keeping track of how to cancel
    const car_booking = await cars.reserve(input);
    undos.push(() => cars.cancel(car_booking));

    // RPC the payments service to process, keeping track of how to refund
    const payment = await payments.process({ run_type: input.run_type });
    undos.push(() => payments.refund(payment));

    // confirm the flight and car
    await flights.confirm(flight_booking);
    await flights.confirm(car_booking);

    // simulate a failing SNS call
    if (request?.run_type === "failNotification") {
      await Promise.reject(new TerminalError("Failed to send notification"));
    }
  } catch (e) {
    // undo all the steps up to this point
    for (const undo of undos.reverse()) {
      await undo();
    }

    // notify failure
    await ctx.run(() =>
      sns.send(
        new PublishCommand({
          TopicArn: process.env.SNS_TOPIC,
          Message: "Your Travel Reservation Failed",
        }),
      ),
    );

    // exit with an error
    throw new TerminalError(
      `Travel reservation failed with err '${e}'; successfully applied ${undos.length} compensations`,
      {
        cause: e,
      },
    );
  }

  // notify success
  await ctx.run(async () =>
    process.env.SNS_TOPIC
      ? await sns.send(
          new PublishCommand({
            TopicArn: process.env.SNS_TOPIC,
            Message: "Your Travel Reservation is Successful",
          }),
        )
      : {},
  );

  return {
    status: "success",
    trip_id: tripId,
  };
};

export const tripsService = restate.service({
  name: "trips",
  handlers: {
    reserve,
  },
});

export const handler = restate.endpoint().bind(tripsService).handler();
