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
import { carRentalRouter, carRentalService } from "./cars";
import { flightsRouter, flightsService } from "./flights";
import { paymentsRouter, paymentsService } from "./payments";
import { tripsRouter, tripsService } from "./trips";

export const handler = restate
  .createServer()
  .bindKeyedRouter(carRentalService.path, carRentalRouter)
  .bindKeyedRouter(flightsService.path, flightsRouter)
  .bindKeyedRouter(paymentsService.path, paymentsRouter)
  .bindRouter(tripsService.path, tripsRouter)
  .listen(9080);
