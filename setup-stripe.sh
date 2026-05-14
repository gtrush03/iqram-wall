#!/usr/bin/env bash
# usage: STRIPE_SECRET_KEY=sk_… [STRIPE_WEBHOOK_SECRET=whsec_…] bash setup-stripe.sh
set -euo pipefail
PROJ="${1:-$(jq -r .projectId .vercel/project.json 2>/dev/null || true)}"
[ -z "$PROJ" ] && { echo "pass project id or run from a linked dir"; exit 1; }
[ -z "${STRIPE_SECRET_KEY:-}" ] && { echo "STRIPE_SECRET_KEY required"; exit 1; }

put() {
  local key="$1" val="$2"
  curl -sS -X DELETE "https://api.vercel.com/v9/projects/${PROJ}/env?key=${key}" \
    -H "Authorization: Bearer ${VERCEL_TOKEN}" >/dev/null || true
  curl -sS -X POST "https://api.vercel.com/v10/projects/${PROJ}/env" \
    -H "Authorization: Bearer ${VERCEL_TOKEN}" -H "Content-Type: application/json" \
    -d "$(jq -nc --arg k "$key" --arg v "$val" '{key:$k,value:$v,type:"encrypted",target:["production","preview","development"]}')" >/dev/null
  echo "✓ $key set"
}

put STRIPE_SECRET_KEY "$STRIPE_SECRET_KEY"
[ -n "${STRIPE_WEBHOOK_SECRET:-}" ] && put STRIPE_WEBHOOK_SECRET "$STRIPE_WEBHOOK_SECRET"
echo "now redeploy: npx vercel deploy --prod --token \$VERCEL_TOKEN --scope \$VERCEL_SCOPE"
