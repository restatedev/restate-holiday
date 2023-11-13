# Restate Holiday

This repo reimplements AWS's 'Serverless Saga Pattern' in Restate:
https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/implement-the-serverless-saga-pattern-by-using-aws-step-functions.html
https://github.com/aws-samples/step-functions-workflows-collection/tree/main/saga-pattern-tf

The goal of this example is to show how you can easily move a fairly complex AWS Step Functions workflow into code
using Restate. Instead of designing a graph of operations including failure compensations, you can just execute steps
imperatively, using try/catch/finally statements to do error control. You also don't need to make a distinction between
workflow and lambda code; everything is Lambda.

The original example has 9 Lambdas:
- Reserve/Confirm/Cancel flight
- Reserve/Confirm/Cancel car reservation
- Process/Refund payment
- Kick off the workflow (called by API gateway)
And some other components:
- API gateway
- Step functions workflow with 12 steps

Instead, we have 4 Lambdas, each with a domain area:
- The [Flight service](./src/flights.ts), with methods for reserve/confirm/cancel
- The [Car service](./src/cars.ts), with methods for reserve/confirm/cancel
- The [Payment service](./src/payments.ts), with methods for process/refund
- The [Trip service](./src/trips.ts), the entrypoint which orchestrates the whole thing, which you can call directly
via the Restate HTTP gateway

You don't need an API gateway, and you don't need any JSON workflow files!

## Deploying
`terraform apply` will set up everything you need in your AWS account. To discover the Lambdas to your managed Restate cluster:
```shell 
curl  -H "Authorization: Bearer <your-cluster-token>"  https://<your-cluster>.dev.restate.cloud:9070/endpoints --json \
  '{"arn": "<lambda-arn>", "assume_role_arn": "<assume-role-arn>"}'
```

See [the Managed Service docs](https://docs.restate.dev/restate/managed_service#giving-permission-for-your-cluster-to-invoke-your-lambdas) for more information

### Deploying locally
Restate services don't care if they're running in a Lambda or not. 
You can start a local instance of the services in one binary:
```shell
FLIGHTS_TABLE_NAME=restate-holiday-Flights CARS_TABLE_NAME=restate-holiday-Rentals PAYMENTS_TABLE_NAME=restate-holiday-Payments npm run app-dev
curl localhost:9070/endpoints --json '{"uri": "http://localhost:9080"}'
```

You can also deploy against localstack AWS services using [`tflocal`](https://docs.localstack.cloud/user-guide/integrations/terraform/):
```shell
tflocal init
tflocal apply

AWS_ENDPOINT=http://localhost:4566 FLIGHTS_TABLE_NAME=restate-holiday-Flights CARS_TABLE_NAME=restate-holiday-Rentals PAYMENTS_TABLE_NAME=restate-holiday-Payments npm run app-dev
```

## Invoking
```shell
curl $INGRESS:8080/trips/reserve --json '{}'
```
Or Invoke with one of the following failure types:
- `failFlightsReservation`
- `failFlightsConfirmation`
- `failCarRentalReservation`
- `failCarRentalConfirmation`
- `failPayment`
- `failNotification`

```shell
curl $INGRESS:8080/trips/reserve --json '{"request": {"run_type": "failPayment"}}'
```

You may also provide a trip ID of your choice:
```shell
curl $INGRESS:8080/trips/reserve --json '{"request": {"trip_id": "foo"}}'
```
