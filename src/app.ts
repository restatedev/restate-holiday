import * as restate from "@restatedev/restate-sdk";
import {carRentalRouter, carRentalService} from "./cars";
import {flightsRouter, flightsService} from "./flights";
import {paymentsRouter, paymentsService} from "./payments";

export const handler = restate
  .createLambdaApiGatewayHandler()
  .bindKeyedRouter(
    carRentalService.path,
    carRentalRouter,
  )
  .bindKeyedRouter(
    flightsService.path,
    flightsRouter,
  )
  .bindKeyedRouter(
    paymentsService.path,
    paymentsRouter,
  ).handle()
