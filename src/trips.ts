import * as restate from "@restatedev/restate-sdk";
import {DynamoDBClient} from "@aws-sdk/client-dynamodb";
import {carRentalService, CarReserveParams} from "./cars";
import {FlightReserveParams, flightsService} from "./flights";
import {paymentsService} from "./payments";
import {PublishCommand, SNSClient} from "@aws-sdk/client-sns";

const sns = new SNSClient({})
type ReserveParams = CarReserveParams & FlightReserveParams
const reserve = async (ctx: restate.RpcContext, tripID: string, event: ReserveParams) => {
  console.log("reserve trip:", JSON.stringify(event, undefined, 2));

  const compensations: (() => void)[] = [];

  const revert = async (e: any) => {
    // apply compensations in reverse order
    for (let i = compensations.length - 1; i >= 0; i--) {
      compensations[i]()
    }
    // clear compensations
    compensations.splice(0, compensations.length)

    // notify failure
    const message = new PublishCommand({
      TopicArn: process.env.SNS_TOPIC,
      Message: "Your Travel Reservation Failed",
    })
    await ctx.sideEffect(() => sns.send(message))

    // rethrow
    throw e
  }

  const {booking_id: flight_booking_id} = await ctx.rpc(flightsService).reserve(tripID, event).catch(revert)
  compensations.push(() => ctx.send(flightsService).cancel(tripID, {booking_id: flight_booking_id}))

  const {booking_id: car_booking_id} = await ctx.rpc(carRentalService).reserve(tripID, event).catch(revert)
  compensations.push(() => ctx.send(carRentalService).cancel(tripID, {booking_id: car_booking_id}))

  const {payment_id} = await ctx.rpc(paymentsService).process(tripID, {
    car_booking_id,
    flight_booking_id,
    run_type: event.run_type
  }).catch(revert)
  compensations.push(() => ctx.send(paymentsService).refund(tripID, {payment_id}))

  await ctx.rpc(flightsService).confirm(tripID, {booking_id: flight_booking_id}).catch(revert)
  await ctx.rpc(carRentalService).confirm(tripID, {booking_id: car_booking_id}).catch(revert)

  // notify success
  let message = new PublishCommand({
    TopicArn: process.env.SNS_TOPIC,
    Message: "Your Travel Reservation is Successful",
  })
  await ctx.sideEffect(() => sns.send(message))

  return
};

export const tripsRouter = restate.keyedRouter({reserve})
export const tripsService: restate.ServiceApi<typeof tripsRouter> = {path: "trips"}

