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

## Deploying against Restate managed service
`MANAGED_SERVICE_CLUSTER=<your-cluster> cdk deploy` will set up everything you need in your AWS account. To discover the Lambdas to your managed Restate cluster:
```shell 
# get stack outputs into your shell
eval $(aws cloudformation describe-stacks --stack RestateHolidayStack  --query "Stacks[].Outputs[]" | jq -r '.[] | "export " + .ExportName + "=" + .OutputValue')
for arn in ${tripsLambdaArn} ${carsLambdaArn} ${paymentsLambdaArn} ${flightsLambdaArn}; do
  curl -H "Authorization: Bearer <your-cluster-token>" https://<your-cluster>.dev.restate.cloud:9070/endpoints --json "{\"arn\": \"$arn\", \"assume_role_arn\": \"${assumeRoleArn}\"}"
done
```
This discovered a specific version, so you'll need to run this again if you update the Lambda functions.

See [the Managed Service docs](https://docs.restate.dev/restate/managed_service#giving-permission-for-your-cluster-to-invoke-your-lambdas) for more information

## Deploying with your own Restate cluster

TODO

### Deploying against local Restate
Restate services don't care if they're running in a Lambda or not. 
You can start a local instance of the services in one binary, which will use your local AWS creds
```shell
# get stack outputs into your shell
eval $(aws cloudformation describe-stacks --stack RestateHolidayStack  --query "Stacks[].Outputs[]" | jq -r '.[] | "export " + .ExportName + "=" + .OutputValue')
FLIGHTS_TABLE_NAME=${flightsTableName} CARS_TABLE_NAME=$carsTableName PAYMENTS_TABLE_NAME=${paymentsTableName} npm run app-dev
```

And you can start a local Restate instance and discover the service:
```
docker run --name restate_dev --rm -d --network=host ghcr.io/restatedev/restate-dist:0.4.0
curl localhost:9070/endpoints --json '{"uri": "http://localhost:9080"}'
```

You can even expose your local service over [ngrok](https://ngrok.com/) and route all new invocations from a remote cluster to your machine:
```shell
ngrok tcp 9080
# get the tcp endpoint like tcp://6.tcp.eu.ngrok.io:14640 and change tcp -> http
curl <remote-restate-cluster>/endpoints --json '{"uri": "http://6.tcp.eu.ngrok.io:14640"}'
```

You can also deploy against localstack AWS services using [`cdklocal`](https://github.com/localstack/aws-cdk-local)
and [`awslocal`](https://github.com/localstack/awscli-local):
```shell
cdklocal deploy
# get stack outputs into your shell
eval $(awslocal cloudformation describe-stacks --stack RestateHolidayStack  --query "Stacks[].Outputs[]" | jq -r '.[] | "export " + .ExportName + "=" + .OutputValue')
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
