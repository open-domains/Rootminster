#!/bin/sh
# Certbot manual hook for Rootminster ACME DNS-01 challenges.
#
#   export ROOTMINSTER_URL=https://rootminster.example.com
#   export ROOTMINSTER_TOKEN=od_...        # a token with the dns:acme scope
#   certbot certonly --manual --preferred-challenges dns \
#     --manual-auth-hook "/path/to/certbot-hook.sh present" \
#     --manual-cleanup-hook "/path/to/certbot-hook.sh cleanup" \
#     -d home.example.com -d '*.home.example.com'
set -eu

action="${1:-}"
case "$action" in
  present|cleanup) ;;
  *) echo "usage: $0 present|cleanup" >&2; exit 2 ;;
esac

: "${ROOTMINSTER_URL:?Set ROOTMINSTER_URL}"
: "${ROOTMINSTER_TOKEN:?Set ROOTMINSTER_TOKEN}"
: "${CERTBOT_DOMAIN:?CERTBOT_DOMAIN is set by certbot}"
: "${CERTBOT_VALIDATION:?CERTBOT_VALIDATION is set by certbot}"

# Wildcard requests arrive as "*.name"; the challenge lives at _acme-challenge.name.
domain="${CERTBOT_DOMAIN#\*.}"

curl -fsS -X POST \
  -H "Authorization: Bearer ${ROOTMINSTER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"fqdn\":\"_acme-challenge.${domain}.\",\"value\":\"${CERTBOT_VALIDATION}\"}" \
  "${ROOTMINSTER_URL%/}/api/v1/acme/${action}" >/dev/null

# Give public resolvers time to see the new record before certbot asks for validation.
if [ "$action" = "present" ]; then sleep "${ROOTMINSTER_PROPAGATION_SECONDS:-30}"; fi
