#!/usr/bin/env zsh

set -euo pipefail

openssl genrsa 2048 > restate-ingress-private.key
openssl req -new -x509 -nodes -sha256 -days 365 -extensions v3_ca -key restate-ingress-private.key \
  -subj "/C=DE/ST=Berlin/L=Berlin/O=restatedev/OU=demo/CN=restate.example.com" > restate-ingress-public.crt

aws acm import-certificate --certificate fileb://restate-ingress-public.crt --private-key fileb://restate-ingress-private.key