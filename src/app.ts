/*
 * Copyright (c) 2024 - Restate Software, Inc., Restate GmbH
 *
 * This file is part of the Restate examples released under the MIT license.
 *
 * You can find a copy of the license in file LICENSE in the root
 * directory of this repository or package, or at
 * https://github.com/restatedev/sdk-typescript/blob/main/LICENSE
 */

import * as restate from "@restatedev/restate-sdk";
import { carsObject } from "./cars";
import { flightsObject } from "./flights";
import { paymentsObject } from "./payments";
import { tripsService } from "./trips";

export const handler = restate
  .endpoint()
  // You can restrict access by providing the public key of the Restate environment authorized to call this endpoint:
  //.withIdentityV1("publickeyv1_...")
  .bind(carsObject)
  .bind(flightsObject)
  .bind(paymentsObject)
  .bind(tripsService)
  .listen(9080);
