# IT PARK ACADEMY

A full-stack learning management system for IT courses with a Django REST API, a Next.js web application, and a native Flutter Android application.

The platform covers the complete learning lifecycle: registration and email verification, course catalog, protected video lessons, 10-question quizzes, monthly subscriptions with a grace period, Click/Payme/Uzum callbacks, progress tracking, points and leaderboard, Q&A, verifiable PDF certificates, notifications, and teacher/admin portals.

## Repository layout

```
backend/     Django 5 + DRF + PostgreSQL + Redis + Celery
frontend/    Next.js 15 App Router + React 19 + TypeScript + Tailwind + shadcn/ui
mobile/      Native Flutter/Dart Android application
deploy/      nginx configuration for the Docker deployment
docs/        Architecture, deployment, API and integration documentation
```

## Implemented functionality

| Area | Status |
| --- | --- |
| Email/password auth, JWT rotation, HttpOnly refresh cookie | Working |
| Google OAuth | Implemented; requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` |
| Email verification, password reset, resend verification | Working; SMTP or console backend |
| Courses, sections, lessons, subscriptions, enrollment | Working |
| Protected video streaming with short-lived signed tokens and byte ranges | Working |
| Quizzes: 10 questions, pass 7/10, 4 wrong answers force a restart | Working |
| Progress, points, leaderboard, streaks/analytics | Working |
| Monthly subscriptions, 3-day grace, expiry reminders | Working |
| Click / Payme / Uzum provider verification | Implemented; requires provider credentials |
| Sandbox payment mode | Only with `DEBUG=true` and `PAYMENT_SANDBOX_ENABLED=true` |
| PDF certificates with QR code and public verification | Working |
| Comments, replies, teacher moderation | Working |
| In-app notifications, Telegram bot linking, FCM push devices | Working; Telegram/FCM delivery requires credentials |
| Teacher portal and admin portal | Working |
| OpenAPI schema and Swagger UI | Working at `/api/docs/` |
| Backend tests | 116 Django tests |
| Docker + nginx deployment | Included |

No dashboard statistic, payment success, certificate, or course card is hardcoded. Values come from the API and database.

## Demo credentials

After running `python manage.py seed_demo`:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@itparkacademy.uz` | `Admin123!` |
| Teacher | `teacher@itparkacademy.uz` | `Teacher123!` |
| Student | `student@itparkacademy.uz` | `Student123!` |

The seed also creates additional students using `*@itparkacademy.uz` with password `Student123!`. Seed data is idempotent and intended for development/demo environments only.

## Local development

### 1. Backend

Requirements: Python 3.12+, PostgreSQL 16 (or SQLite fallback), and Redis for non-eager Celery tasks.

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_demo
.venv/bin/python manage.py runserver 0.0.0.0:8000
```

The default PostgreSQL URL expects a database on `127.0.0.1:5434` with database `itpark`, user `itpark`, and password `itpark_dev_password`. To use SQLite instead, set `USE_SQLITE=1` in `backend/.env`.

API health: `http://localhost:8000/api/health/`  
Swagger UI: `http://localhost:8000/api/docs/`  
Django admin: `http://localhost:8000/django-admin/`

### 2. Web

```bash
cd frontend
cp .env.example .env
npm ci
npm run dev
```

Open `http://localhost:3000`.

Production build check:

```bash
cd frontend
npm run build
npm run start -- -p 3000
```

### 3. Mobile

Install Flutter 3.35+ and the Android SDK, then:

```bash
cd mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000
```

For a physical device use the machine's LAN address. For a release build use an HTTPS API URL:

```bash
flutter build apk --release --dart-define=API_BASE_URL=https://your-domain.example
```

Release signing is configured through `mobile/android/key.properties`. See `mobile/README.md`.

## Docker deployment

```bash
cp .env.example .env
# Edit .env: secrets, domain, public URLs, provider keys.
docker compose up -d --build
docker compose exec backend python manage.py createsuperuser
```

The stack contains PostgreSQL, Redis, Gunicorn/Django, Celery worker, Celery beat, Next.js, and nginx. HTTP is exposed on port 80. Enable TLS before production use.

For a first demo deployment, set `DEBUG=true`, `PAYMENT_SANDBOX_ENABLED=true`, and `SEED_DEMO=true` in `.env`, then rebuild. Never use those settings on a real production database.

Full instructions: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Tests

```bash
cd backend
.venv/bin/python manage.py test apps -v 1
```

The suite covers users/auth, courses and protected videos, quizzes, payments, subscriptions, certificates, analytics, comments, and notifications.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — data model, authentication, access control, payments, video protection, jobs.
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Docker, nginx, TLS, backups, health checks, operations.
- [`docs/API.md`](docs/API.md) — endpoint overview and request examples.
- [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md) — Google, Click, Payme, Uzum, Telegram, FCM, SMTP setup.

## Security notes

- Access tokens stay in memory; refresh tokens use an HttpOnly cookie scoped to `/api/auth/`.
- The recommended production setup is same-origin: `NEXT_PUBLIC_API_URL` empty, nginx proxies `/api` and `/media` to Django. This keeps cookies same-site.
- Payment callbacks verify Click MD5 signatures, Payme Basic authentication, and Uzum API keys before changing payment state. Successful callbacks are idempotent.
- Video files are never served directly from `/media`; playback requires a short-lived signed token and an active subscription (or a free-preview lesson).
- Set strong `DJANGO_SECRET_KEY` and `JWT_SECRET`, disable `DEBUG`, enable HTTPS, and set `AUTH_COOKIE_SECURE=true` and `SECURE_SSL_REDIRECT=true` in production.
