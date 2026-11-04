# Integrations

Every integration below is implemented in the backend and ships disabled until its
credentials are configured. Nothing in this document requires frontend changes.

All examples assume the public site is `https://example.com`. Callback URLs must be
reachable over HTTPS and must point at the deployed nginx/Django entrypoint.

## 1. Google OAuth

Users sign in through Google Identity Services in the browser. The backend verifies
the Google ID token with `https://oauth2.googleapis.com/tokeninfo` and checks that
`aud` matches the configured client ID and `email_verified` is true.

1. Create an OAuth 2.0 Client ID (Web application) in Google Cloud Console.
2. Add authorised JavaScript origins:
   - `https://example.com`
   - `http://localhost:3000` (local development)
3. Add authorised redirect URIs if you use the popup/redirect flow
   (`https://example.com/login`).
4. Set the same client ID and the secret in `.env`:

```dotenv
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxx
```

5. Expose the public client ID to the web build. It is a public value, but
   `NEXT_PUBLIC_*` variables are baked in at build time, so rebuild the frontend:

```dotenv
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
```

```bash
docker compose build frontend
docker compose up -d frontend
```

If `GOOGLE_CLIENT_ID` is empty the `/api/auth/google/` endpoint returns a clear
"Google sign-in is not configured" error and the web button is hidden.

## 2. Click

Click uses the "Prepare" and "Complete" callbacks, both verified with an MD5
signature built from the Click secret key.

```dotenv
CLICK_SERVICE_ID=12345
CLICK_MERCHANT_ID=67890
CLICK_SECRET_KEY=your-click-secret
CLICK_MERCHANT_USER_ID=12345
```

Provider dashboard callback URLs:

| Purpose | URL |
| --- | --- |
| Prepare | `https://example.com/api/payments/click/prepare/` |
| Complete | `https://example.com/api/payments/click/complete/` |

The backend:

- rejects requests with a bad signature (`error: -1`) or wrong service ID;
- validates the order exists, belongs to Click, and the amount matches exactly;
- stores the Click transaction ID on prepare and completes idempotently;
- records every callback in `PaymentWebhookLog` with the source IP.

`CLICK_CHECKOUT_URL` defaults to `https://my.click.uz/services/pay`; the checkout URL
is generated per payment and returned to the client.

## 3. Payme

Payme uses the JSON-RPC Merchant API. Authentication is HTTP Basic with the login
`Paycom` and the Payme secret key:

```dotenv
PAYME_MERCHANT_ID=your-merchant-id
PAYME_SECRET_KEY=your-payme-key
```

Callback URL in the Payme merchant cabinet:

```
https://example.com/api/payments/payme/
```

Supported JSON-RPC methods: `CheckPerformTransaction`, `CreateTransaction`,
`PerformTransaction`, `CancelTransaction`, `CheckTransaction`, `GetStatement`.
Amounts are compared in tiyin (`payment.amount * 100`) and every state transition is
idempotent.

`PAYME_CHECKOUT_URL` defaults to `https://checkout.paycom.uz`; the generated checkout
URL contains `m=<merchant_id>;ac.order_id=<payment_id>;a=<amount_in_tiyin>` and the
return URL.

## 4. Uzum

Uzum calls one callback with an API key. The backend accepts the key either as
`Authorization: Bearer <key>` or `X-Api-Key: <key>`.

```dotenv
UZUM_API_KEY=your-uzum-api-key
UZUM_SERVICE_ID=your-service-id
```

Callback URL:

```
https://example.com/api/payments/uzum/callback/
```

A payload with `status` equal to `SUCCESS`, `PAID`, `COMPLETED` or `CONFIRMED`
activates the subscription; any other status marks the payment failed. `amount` may
be sent in sum or tiyin; both are accepted. Every request is logged.

`UZUM_CHECKOUT_URL` defaults to `https://checkout.uzumbank.uz`.

## 5. Sandbox payments

Only for development and demo environments. Requires both:

```dotenv
DEBUG=true
PAYMENT_SANDBOX_ENABLED=true
```

The web UI shows a clearly labelled "Sandbox" provider. The user confirms through
`POST /api/payments/{id}/sandbox_confirm/`, which is still verified server-side.
Never enable this on a production database.

## 6. Email / SMTP

Development defaults to the console backend (emails are printed to the container log):
`django.core.mail.backends.console.EmailBackend`.

Production:

```dotenv
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_HOST_USER=noreply@example.com
EMAIL_HOST_PASSWORD=your-smtp-password
EMAIL_USE_TLS=true
DEFAULT_FROM_EMAIL=IT PARK ACADEMY <noreply@example.com>
```

Used for email verification, resend verification, and password reset. Links point at
`FRONTEND_URL`; make sure it is the public HTTPS origin in production.

## 7. Telegram bot

```dotenv
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_BOT_USERNAME=ITParkAcademyBot
TELEGRAM_WEBHOOK_SECRET=a-long-random-string
```

1. Create a bot with [@BotFather](https://t.me/BotFather) and copy the token.
2. Register the webhook (Telegram echoes `X-Telegram-Bot-Api-Secret-Token`):

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://example.com/api/notifications/telegram/webhook/" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

3. Verify:

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

Users link their account from the profile page: the frontend calls
`POST /api/notifications/telegram/`, receives a `t.me/<bot>?start=<token>` deep link,
and the bot stores the chat ID when the user presses Start. `TELEGRAM_BOT_USERNAME`
must match the actual bot username or the deep link will be wrong.

Leave the token empty to disable delivery; in-app notifications keep working.

## 8. Firebase Cloud Messaging (push)

The backend uses the FCM HTTP v1 API. Provide service-account credentials in one of
two ways:

```dotenv
FIREBASE_PROJECT_ID=your-firebase-project
# Option A: full service-account JSON on one line
FIREBASE_CREDENTIALS_JSON={"type":"service_account",...}
# Option B: path to a mounted service-account file
FIREBASE_CREDENTIALS_FILE=/run/secrets/firebase-service-account.json
```

Steps:

1. Create a Firebase project and add an Android app with package
   `uz.itpark.itpark_academy`.
2. Download the service-account JSON (Project settings → Service accounts).
3. Download `google-services.json` only if you add the Firebase Flutter plugin to the
   mobile app; the current app registers tokens through the API instead.
4. Mount the credentials file into the `backend` and `worker` containers, or set the
   JSON variable through a secret manager.
5. Clients register a device with `POST /api/notifications/devices/` using
   `{"token": "...", "platform": "android"}`. Registration is idempotent per token.

`FIREBASE_PROJECT_ID` is required for delivery. If FCM fails the in-app notification
is still stored and the failure is logged.

## 9. Payment callback testing

For Click/Payme/Uzum you can only fully test against the provider sandbox or with real
credentials. On a development machine:

- Use `DEBUG=true` and `PAYMENT_SANDBOX_ENABLED=true` for the end-to-end UI flow.
- Use unit tests for signature/auth behaviour:
  `cd backend && .venv/bin/python manage.py test apps.payments -v 2`.
- Inspect callbacks in Django admin under `Payment webhook logs`, or with:

```bash
docker compose exec backend python manage.py shell -c \
  "from apps.payments.models import PaymentWebhookLog; print(PaymentWebhookLog.objects.values('provider','verified','error')[:10])"
```

## 10. Environment checklist

| Integration | Required variables |
| --- | --- |
| Google OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (build-time) |
| Click | `CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID`, `CLICK_SECRET_KEY`, `CLICK_MERCHANT_USER_ID` |
| Payme | `PAYME_MERCHANT_ID`, `PAYME_SECRET_KEY` |
| Uzum | `UZUM_API_KEY`, `UZUM_SERVICE_ID` |
| SMTP | `EMAIL_BACKEND`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS`, `DEFAULT_FROM_EMAIL` |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` |
| FCM | `FIREBASE_PROJECT_ID`, one of `FIREBASE_CREDENTIALS_JSON` / `FIREBASE_CREDENTIALS_FILE` |
| Public URLs | `FRONTEND_URL`, `BACKEND_URL`, `NEXT_PUBLIC_SITE_URL`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` |

After changing any variable that is read at container start, restart the affected
services:

```bash
docker compose up -d backend worker beat
```

After changing `NEXT_PUBLIC_*` variables, rebuild the frontend.
