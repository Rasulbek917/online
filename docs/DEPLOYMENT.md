# Deployment

This document describes the production Docker Compose deployment included in the repository.

## Components

| Service | Image / build | Purpose |
| --- | --- | --- |
| `db` | `postgres:16-alpine` | Persistent database |
| `redis` | `redis:7-alpine` | Celery broker/result backend |
| `backend` | `backend/Dockerfile` | Gunicorn + Django, runs migrations and collectstatic |
| `worker` | `backend/Dockerfile` | Celery worker |
| `beat` | `backend/Dockerfile` | Celery beat scheduler |
| `frontend` | `frontend/Dockerfile` | Next.js standalone server |
| `nginx` | `nginx:1.27-alpine` | Public HTTP entrypoint and reverse proxy |

Named volumes: `postgres_data`, `redis_data`, `media_data`, `static_data`.

## 1. Prepare the server

Install Docker Engine and Docker Compose v2. Open ports 80 and 443 in the firewall. Point the domain's DNS record at the server.

```bash
git clone <repository> /opt/itpark-academy
cd /opt/itpark-academy
cp .env.example .env
```

Edit `.env`:

```dotenv
DJANGO_SECRET_KEY=<64+ random characters>
JWT_SECRET=<different 64+ random characters>
DEBUG=false
ALLOWED_HOSTS=example.com,www.example.com,backend
POSTGRES_PASSWORD=<strong database password>
FRONTEND_URL=https://example.com
BACKEND_URL=https://example.com
NEXT_PUBLIC_SITE_URL=https://example.com
NEXT_PUBLIC_API_URL=
CORS_ALLOWED_ORIGINS=https://example.com
CSRF_TRUSTED_ORIGINS=https://example.com
AUTH_COOKIE_SECURE=true
SECURE_SSL_REDIRECT=true
SEED_DEMO=false
PAYMENT_SANDBOX_ENABLED=false
```

Generate secrets:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
```

`NEXT_PUBLIC_API_URL` must stay empty for the recommended same-origin setup. The web client then calls `/api` on its own domain, nginx proxies it to Django, and the HttpOnly refresh cookie remains same-site. `NEXT_PUBLIC_*` values are baked into the frontend at build time, so rebuild the frontend after changing them.

## 2. Start the stack

```bash
docker compose up -d --build
docker compose ps
```

The backend container applies migrations and collects static files before Gunicorn starts. The worker and beat containers wait for the backend health check.

Create the first administrator:

```bash
docker compose exec backend python manage.py createsuperuser
```

For a demo/staging environment only, seed the demo dataset:

```bash
docker compose exec backend python manage.py seed_demo
```

or set `SEED_DEMO=true` in `.env` and restart the backend. The seed command is idempotent.

## 3. Test before DNS/TLS cutover

```bash
curl http://127.0.0.1/api/health/
curl http://127.0.0.1/api/stats/
curl -I http://127.0.0.1/
```

Open `http://<server-ip>/` for the web app and `http://<server-ip>/api/docs/` for Swagger.

## 4. Enable HTTPS

Use certbot on the host and mount certificates into nginx, or terminate TLS with a load balancer. An example HTTPS server is provided at `deploy/nginx/itpark-ssl.conf.example`.

Typical certbot flow:

```bash
sudo apt install certbot
sudo certbot certonly --standalone -d example.com -d www.example.com
```

Then:

1. Copy `deploy/nginx/itpark-ssl.conf.example` to `deploy/nginx/itpark-ssl.conf` and replace the domain/certificate paths.
2. Mount the certificate directory and the SSL config in `docker-compose.yml`.
3. Expose port `443:443` and redirect port 80 to HTTPS.
4. Set `AUTH_COOKIE_SECURE=true` and `SECURE_SSL_REDIRECT=true` in `.env`.
5. Rebuild the frontend if `NEXT_PUBLIC_SITE_URL` or `NEXT_PUBLIC_API_URL` changed.
6. `docker compose up -d --build`.

The backend trusts `X-Forwarded-Proto`; nginx sets it to `https`. This prevents a redirect loop when Django's SSL redirect is enabled.

## 5. Payment callbacks

Configure the following public callback URLs in the provider dashboards:

| Provider | URL |
| --- | --- |
| Click prepare | `https://example.com/api/payments/click/prepare/` |
| Click complete | `https://example.com/api/payments/click/complete/` |
| Payme | `https://example.com/api/payments/payme/` |
| Uzum | `https://example.com/api/payments/uzum/callback/` |

Provider credentials belong in `.env`. Keys are never sent to the frontend. See `docs/INTEGRATIONS.md`.

## 6. Telegram and push notifications

- Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, and `TELEGRAM_WEBHOOK_SECRET`.
- Register the webhook:

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://example.com/api/notifications/telegram/webhook/" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

- Set Firebase service-account credentials through `FIREBASE_CREDENTIALS_JSON` or mount a file and set `FIREBASE_CREDENTIALS_FILE`.
- The mobile app registers its FCM device token through `/api/notifications/devices/`.

## 7. Email

Production email requires SMTP settings:

```dotenv
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_HOST_USER=...
EMAIL_HOST_PASSWORD=...
EMAIL_USE_TLS=true
DEFAULT_FROM_EMAIL=IT PARK ACADEMY <noreply@example.com>
```

Without SMTP the console backend prints emails to the backend logs. That is suitable only for development.

## 8. Backups

### Database

```bash
docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip > "backup-$(date +%F).sql.gz"
```

Restore:

```bash
gunzip -c backup-2026-11-03.sql.gz \
  | docker compose exec -T db psql -U "$POSTGRES_USER" "$POSTGRES_DB"
```

### Media

Back up the `media_data` volume (course thumbnails, avatars, certificate PDFs, source videos). A simple approach:

```bash
docker run --rm \
  -v itpark-academy_media_data:/source:ro \
  -v "$PWD/backups":/backup \
  alpine tar czf /backup/media-$(date +%F).tar.gz -C /source .
```

Test restores on a separate environment. A backup that has never been restored is not a backup.

## 9. Updates

```bash
git pull
docker compose build
docker compose up -d
```

Migrations run automatically when the backend container starts. If a deployment requires a maintenance window, take a database backup first.

## 10. Monitoring and operations

- Health endpoint: `GET /api/health/` (database, cache/Redis checks).
- Swagger: `/api/docs/`, schema: `/api/schema/`.
- Django admin: `/django-admin/` (administrator accounts only).
- Application logs: `docker compose logs -f backend worker beat frontend nginx`.
- Audit logs: admin portal or `/api/audit-logs/`.

Recommended external checks:

- HTTP 200 from `/api/health/` every minute.
- Disk space for PostgreSQL and media.
- Celery queue length and worker heartbeat.
- Payment webhook failures in `PaymentWebhookLog`.
- Certificate verification errors.

## 11. Scaling notes

- Gunicorn defaults to 3 workers in `backend/Dockerfile`; tune for CPU/RAM.
- Celery worker concurrency is 2 in `docker-compose.yml`; increase for notification throughput.
- Use a managed PostgreSQL and Redis service for high availability.
- Move media to S3-compatible object storage before running multiple backend hosts; set `DEFAULT_FILE_STORAGE` and the corresponding storage credentials.
- The current video stream endpoint reads from local disk. Object storage or a signed CDN URL service should replace it for multi-node deployments.

## 12. Troubleshooting

| Symptom | Check |
| --- | --- |
| Backend restarts repeatedly | `docker compose logs backend`; database credentials; `ALLOWED_HOSTS` |
| Login succeeds but session expires immediately | `NEXT_PUBLIC_API_URL` must be empty in same-origin mode, or CORS/cookie settings must match the frontend origin |
| 400 `DisallowedHost` | Add the public domain to `ALLOWED_HOSTS` |
| CSRF failure on Django admin | Add the HTTPS origin to `CSRF_TRUSTED_ORIGINS` |
| Payment callback 401/403 | Provider credentials and callback signatures |
| Email not delivered | SMTP credentials, port/TLS, spam logs; console backend only logs |
| Video 403 | Active subscription, signed token, lesson unlock order |
| Certificate PDF has missing Cyrillic glyphs | Backend image must include `fonts-dejavu-core` (already in the Dockerfile) |
| Static files 404 | Ensure `static_data` volume is populated by the backend and mounted in nginx |
| Media 404 | Ensure `media_data` is mounted in nginx at `/var/www/media` |
