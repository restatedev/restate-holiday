[![Documentation](https://img.shields.io/badge/doc-reference-blue)](https://docs.restate.dev)
[![Examples](https://img.shields.io/badge/view-examples-blue)](https://github.com/restatedev/examples)
[![Discord](https://img.shields.io/discord/1128210118216007792?logo=discord)](https://discord.gg/skW3AZ6uGd)
[![Twitter](https://img.shields.io/twitter/follow/restatedev.svg?style=social&label=Follow)](https://twitter.com/intent/follow?screen_name=restatedev)

# Restate Holiday

This repository demonstrates a complex workflow on Restate with AWS Lambda. The example is based
on [AWS's Step Functions sample implementation](https://github.com/aws-samples/step-functions-workflows-collection/tree/main/saga-pattern-cdk)
of a Holiday booking service using the Saga pattern.

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

- API Gateway
- A Step Function with 12 steps

Instead, we have 4 Lambda deployments, each corresponding to a single service from the domain:

- The [Trip service](./src/trips.ts), the entrypoint which orchestrates the whole thing, which you can call directly via
  the Restate HTTP ingress endpoint
- The [Flight service](./src/flights.ts), with methods for reserve/confirm/cancel
- The [Car service](./src/cars.ts), with methods for reserve/confirm/cancel
- The [Payment service](./src/payments.ts), with methods for process/refund

## Prerequisites

This example assumes you have the following installed:

- [A current version of Node.js and npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
- [An AWS account](https://aws.amazon.com/) and sufficient permissions to deploy the required resources
- [AWS CLI](https://aws.amazon.com/cli/)
- [curl](https://curl.se)

## Deploying the Holiday Service and a self-hosted Restate instance

By default, the Holiday CDK app will deploy two stacks: a self-hosted Restate instance, and the Holiday service stack.

```shell
npx cdk deploy --context deploySelfHostedRestateEnvironment=true
```

Note the ingress endpoint URL output by the deployment - we will need this later on.

```shell
export INGRESS=$(aws cloudformation describe-stacks \
    --stack-name RestateStack \
    --query "Stacks[0].Outputs[?OutputKey=='RestateIngressUrl'].OutputValue" \
    --output text)
```

### Cleanup

When you are done testing, you can easily delete all created resources with the command (if you specified a prefix
during deployment, you will need to use the same value here too):

```shell
npx cdk destroy --all
```

## Deploying on Restate Cloud

Visit [the Restate website](https://restate.dev) to register for a Cloud account which allows you to create a free
environment. Create an API key with either Admin or Full access role.

Create a secret in Secrets Manager to hold the authentication token. You can use the following command to save the key
in Secrets Manager.

```shell
export AUTH_TOKEN_ARN=$(aws secretsmanager create-secret \
    --name /restate-holiday/auth-token --secret-string ${RESTATE_AUTH_TOKEN} \
    --query ARN --output text
)
```

Once you have the ARN for the secret, deploying the Holiday demo app is as easy as:

```shell
npx cdk deploy \
    --context cloudEnvironmentId=${ENVIRONMENT_ID} \
    --context authTokenSecretArn=${AUTH_TOKEN_ARN}
```

Just like with the self-hosted stack you can also specify a unique prefix if you wish to deploy multiple copies of these
stacks to the same AWS account with `--context prefix=${USER}`. You can also save these context attributes in the
`cdk.json` file to avoid repetition for subsequent CDK operations.

You can obtain the Restate ingress URL from the Restate Cloud UI.

```shell
export INGRESS=https://...
```

You are now ready to jump to [Invoking](#Invoking) and send some requests to the service.

See the [Restate Cloud documentation](https://docs.restate.dev/deploy/cloud) for more information about deploying to it.

### Cleanup

When you are done testing, you can easily delete all created resources with the command (if you specified a prefix or a
deployment mode during deployment, you will need to use the same values here too):

```shell
npx cdk destroy \
    --context cloudEnvironmentId=${ENVIRONMENT_ID} \
    --context authTokenSecretArn=${AUTH_TOKEN_ARN}
```

## Deploying against local Restate

Restate services don't care if they're running in a Lambda or not. You can start a local instance of the service and use
local AWS credentials to interact with AWS resources.

```shell
# get stack outputs into your shell
eval $(aws cloudformation describe-stacks --stack RestateHolidayStack  --query "Stacks[].Outputs[]" | jq -r '.[] | "export " + .ExportName + "=" + .OutputValue')
FLIGHTS_TABLE_NAME=${flightsTableName} CARS_TABLE_NAME=${carsTableName} PAYMENTS_TABLE_NAME=${paymentsTableName} npm run app-dev
```

And you can start a local Restate instance and discover the service:

```shell
npx run @restatedev/restate-server
```

In another shell, register the locally running service endpoint with Restate:

```shell
npx run @restatedev/restate deployments register http://localhost:9080
```

## Invoking

Note that we use the `-k` flag to skip certificate validation and make requests work against an ingress endpoint using a
self-signed certificate. If you are calling Restate Cloud, or have a valid certificate deployed in front of your Restate
ingress, you can omit this flag.

```shell
curl -k ${INGRESS}/trips/reserve --json '{}'
```

You can cause a specific type of failure by making a request with one of the following failure types:

- `failFlightsReservation`
- `failFlightsConfirmation`
- `failCarRentalReservation`
- `failCarRentalConfirmation`
- `failPayment`
- `failNotification`

```shell
curl -k ${INGRESS}/trips/reserve --json '{"request": {"run_type": "failPayment"}}'
```

You may also provide a trip ID of your choice:

```shell
curl -k ${INGRESS}/trips/reserve --json '{"request": {"trip_id": "foo"}}'
```

Finally, you can make an idempotent invocation by setting the `idempotency-key` header:

```shell
curl -k ${INGRESS}/trips/reserve -H 'idempotency-key: <unique-key>' --json '{}'
```

## Observability

### Logs

The Restate container deployed by the CDK construct will publish its logs to CloudWatch logs. You can view them in the
console or follow them from a terminal using the AWS CLI:

```shell
aws logs tail /restate-holiday/restate-server --follow
```

If you specified a deployment prefix, the log group will be called `/restate/<prefix>/restate`.

### Traces

The self-hosted Restate container is configured to send traces to AWS X-Ray, by way of the AWS Distro for OpenTelemetry.
You should see traces in the X-Ray console including for health checks made by the load balancer. To filter just the
traces made to the demo Trips service, use a query like:

```
service(id(name: "trips"))
```
