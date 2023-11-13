import * as restate from "@restatedev/restate-sdk";
import {carRentalRouter, carRentalService} from "./cars";
import {flightsRouter, flightsService} from "./flights";
import {paymentsRouter, paymentsService} from "./payments";
import {tripsRouter, tripsService} from "./trips";

export const handler = restate
  .createServer()
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
  ).bindRouter(
    tripsService.path,
    tripsRouter
  ).listen(9080)
