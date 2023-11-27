# Restate Holiday

This repository demonstrates the [Saga pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/implement-the-serverless-saga-pattern-by-using-aws-step-functions.html)
in Restate. The example is based on AWS's [Step Functions sample implementation](https://github.com/aws-samples/step-functions-workflows-collection/tree/main/saga-pattern-tf)
of the pattern and associated Holiday booking service.

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
- A Step Functions workflow with 12 steps

Instead, we have 4 Lambda deployments, each corresponding to a single service from the domain:

- The [Trip service](./src/trips.ts), the entrypoint which orchestrates the whole thing, which you can call directly via
  the Restate HTTP ingress endpoint
- The [Flight service](./src/flights.ts), with methods for reserve/confirm/cancel
- The [Car service](./src/cars.ts), with methods for reserve/confirm/cancel
- The [Payment service](./src/payments.ts), with methods for process/refund

## Deploying with self-hosted Restate instance

By default, the CDK app will deploy two stacks: a self-hosted Restate instance, and the Holiday service stack. 

```shell
npx cdk deploy --all
```

If you are deploying this stack in a shared AWS account, you may want to specify a prefix for the stack names:

```shell
npx cdk deploy --all --context prefix=${USER}
```

You can also deploy only the self-hosted Restate stack as follows:

```shell
npx cdk deploy RestateStack
```

To delete all created resources, run:

```shell
npx cdk destroy --all
```

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

## Deploying against local Restate

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
curl $INGRESS/trips/reserve --json '{}'
```

You can cause a specific type of failure by making a request with one of the following failure types:
 
- `failFlightsReservation`
- `failFlightsConfirmation`
- `failCarRentalReservation`
- `failCarRentalConfirmation`
- `failPayment`
- `failNotification`

```shell
curl $INGRESS/trips/reserve --json '{"request": {"run_type": "failPayment"}}'
```

You may also provide a trip ID of your choice:

```shell
curl $INGRESS/trips/reserve --json '{"request": {"trip_id": "foo"}}'
```

Finally, you can make an idempotent invocation by setting the `idempotency-key` header:

```shell
curl $INGRESS/trips/reserve -H 'idempotency-key: <unique-key>' --json '{}'
```