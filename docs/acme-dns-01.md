# ACME DNS-01 certificates

Rootminster lets subdomain owners get TLS certificates (including wildcards) from Let's Encrypt or any other ACME CA using the DNS-01 challenge, without handing a full DNS token to their server.

## Create a token

In **Settings → API Tokens**, choose **ACME certificates** and list the hostnames you want certificates for, for example `home.example.com`. You must already own them.

An ACME token has only the `dns:acme` scope. It can publish and remove TXT records at `_acme-challenge.<allowed hostname>` and nothing else. A wildcard certificate for `*.home.example.com` uses the same challenge name, so listing `home.example.com` covers both.

A general token with `dns:write` can use the same endpoints if it is allowed to manage TXT records at the hostname.

## Endpoints

Both endpoints take `{"fqdn": "_acme-challenge.home.example.com.", "value": "<challenge digest>"}`.

| Endpoint | What it does |
|---|---|
| `POST /api/v1/acme/present` | Publishes the TXT record with a 60 second TTL. Calling it again with the same value is safe. |
| `POST /api/v1/acme/cleanup` | Removes the TXT record. It only removes records `present` created, never TXT records you added yourself. |

Send the token as `Authorization: Bearer <token>`. Because lego's `httpreq` provider only supports HTTP Basic auth, the token is also accepted as the Basic password (the username is ignored).

Challenge records that are never cleaned up are deleted automatically after 24 hours by the job runner.

## lego

```sh
HTTPREQ_ENDPOINT=https://rootminster.example.com/api/v1/acme \
HTTPREQ_USERNAME=token \
HTTPREQ_PASSWORD=od_your_token \
lego --dns httpreq -d home.example.com -d '*.home.example.com' -m you@example.com run
```

Traefik and Caddy builds that embed lego can use the same `httpreq` settings.

## certbot

Use [`scripts/acme/certbot-hook.sh`](../scripts/acme/certbot-hook.sh):

```sh
export ROOTMINSTER_URL=https://rootminster.example.com
export ROOTMINSTER_TOKEN=od_your_token
certbot certonly --manual --preferred-challenges dns \
  --manual-auth-hook "/path/to/certbot-hook.sh present" \
  --manual-cleanup-hook "/path/to/certbot-hook.sh cleanup" \
  -d home.example.com -d '*.home.example.com'
```

The hook waits 30 seconds after publishing so public resolvers can see the record. Set `ROOTMINSTER_PROPAGATION_SECONDS` to change that.

## acme.sh and others

Any client that can call a webhook works. Send the two requests above with `curl` from the client's DNS hook.
