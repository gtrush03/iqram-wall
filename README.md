# iqram-wall · pay-to-post public board

stark b&w monospace wall. anyone pays $1+ via stripe to post text/photo/voice.
default wall: @iqram. switch via jelly username search.

## storage

- comments gist: `b1e1d5a179a804d56aee2c2937b64519` (one file per wall, e.g. `iqram.json`)
- media gist:    `cd3d435defd860a630716f88ae11edb3` (one file per upload, base64)

both gists are public; the github token is server-side only.

## env vars (set in vercel)

| key | value | how to get it |
|-----|-------|---------------|
| `GITHUB_TOKEN`            | (already set — gist scope)               | dispatcher env  |
| `COMMENTS_GIST_ID`        | `b1e1d5a179a804d56aee2c2937b64519`                              | this README     |
| `MEDIA_GIST_ID`           | `cd3d435defd860a630716f88ae11edb3`                        | this README     |
| `STRIPE_SECRET_KEY`       | `sk_live_…` or `sk_test_…`            | dashboard.stripe.com/apikeys |
| `STRIPE_WEBHOOK_SECRET`   | `whsec_…` (after creating the webhook) | dashboard.stripe.com/webhooks |

## stripe webhook setup

once deployed:

1. dashboard.stripe.com/webhooks → "+ add endpoint"
2. URL: `https://<your-project>.vercel.app/api/webhook`
3. event: `checkout.session.completed`
4. copy the signing secret (`whsec_…`) → set as `STRIPE_WEBHOOK_SECRET` in vercel
5. redeploy

if `STRIPE_WEBHOOK_SECRET` isn't set, the webhook handler will re-fetch the session
from stripe before mutating the gist — works either way, but signed is stronger.

## flow

1. user composes (text / photo / voice) and picks an amount (≥ $1)
2. POST /api/checkout → creates stripe checkout session + writes "pending" comment to gist
3. user pays on stripe
4. stripe → /api/webhook → flips status to "paid"
5. /api/comments?wall=iqram returns paid comments

## local dev

```
npm i
npx vercel dev
```
