#!/usr/bin/env zsh

set -euo pipefail

aws secretsmanager create-secret --name /restate/${PREFIX}/auth-token --secret-string ${RESTATE_AUTH_TOKEN}