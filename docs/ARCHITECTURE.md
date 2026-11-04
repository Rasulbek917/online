# Architecture

## System overview

```
Browser / Flutter app
        │
        ├── HTTPS ──> nginx
        │               ├── /            ──> Next.js (frontend)
        │               ├── /api/        ──> Gunicorn / Django REST API
        │               ├── /django-admin/ ──> Django admin
        │               ├── /static/     ──> collected Django static files
        │               └── /media/      ──> uploaded images, PDFs, videos
        │
        ├── PostgreSQL 16
        └── Redis ──> Celery worker + Celery beat
```

The API is the only source of truth. The web and mobile clients contain no mock course data, fake progress, or frontend-only authentication.

## Backend applications

| App | Responsibility |
| --- | --- |
| `apps.users` | Custom user model, profile, auth, Google, email verification, password reset |
| `apps.courses` | Categories, courses, sections, lessons, videos, discounts, enrollments, progress, video streaming |
| `apps.quizzes` | Quizzes, questions, options, attempts, scoring and answer snapshots |
| `apps.subscriptions` | Monthly subscription lifecycle, grace period, cancellation, expiry tasks |
| `apps.payments` | Checkout, provider callbacks, payment audit logs, idempotent success transition |
| `apps.certificates` | Eligibility, PDF generation, QR verification, revocation, verification audit |
| `apps.comments` | Course/lesson Q&A, replies, pinning, soft delete |
| `apps.notifications` | In-app notifications, Telegram linking/webhook, FCM push devices, broadcasts |
| `apps.analytics` | Student dashboard, teacher/admin analytics, revenue, leaderboard, settings, audit logs, health |

Shared code lives in `backend/common`: pagination, permissions, exception format, audit middleware, utilities and test factories.

## Authentication

- Email/password registration creates a user with role `student`.
- Access tokens are short-lived JWTs returned in the response body and kept in memory by the web client.
- Refresh tokens are rotated and blacklisted. The web client receives the refresh token in the HttpOnly cookie `ipa_refresh`, scoped to `/api/auth/`.
- Mobile clients request `client: "mobile"` during login/registration and store the refresh token in platform secure preferences.
- `CookieAwareJWTAuthentication` accepts either an `Authorization: Bearer <token>` header or the access cookie.
- Google login verifies the Google ID token server-side and links/creates the user by verified email.
- Auth endpoints use a dedicated `15/min` throttle scope.

Production recommendation: same-origin API (`NEXT_PUBLIC_API_URL=` empty). nginx proxies `/api` and `/media`; no cross-site cookie is required.

## Roles and the single-teacher rule

Roles are `student`, `teacher`, and `admin`.

- Students can learn, take quizzes, comment, subscribe, and earn certificates.
- The teacher can manage only their own courses and view analytics/students for those courses.
- Admins manage the platform, users, payments, certificates, settings, and audit logs.
- `SINGLE_TEACHER_ENFORCED=true` prevents creating a second active teacher account.

## Course access and progress

A lesson is unlocked only when:

1. The user has course access (active subscription, free-course enrollment, teacher owner, or admin), or the lesson is a free preview.
2. All previous lessons are complete.

A lesson is complete when its video progress is complete and its quiz (if present) has a passing attempt. Course progress is stored on `Enrollment` and refreshed after relevant actions.

Free courses still require enrollment before access; opening a free course from an authenticated session creates that enrollment.

## Protected video streaming

Videos are stored in the media volume but are not served by nginx directly.

1. The lesson payload includes a short-lived signed playback token for each video the user may access.
2. Django verifies subscription/access before issuing that token.
3. `/api/videos/{id}/stream/?token=...` validates the token, re-checks access, and streams the file with HTTP byte-range support.
4. Direct `/media/...mp4` access is not used for lesson playback.

## Quizzes

- A quiz has a configurable question count (default 10) and passing score (default 7).
- Starting a quiz creates an `QuizAttempt` with a randomized snapshot of question IDs.
- Correct answers are not returned by the start endpoint.
- Submitting answers computes the score on the server.
- Four or more wrong answers force a restart; the next lesson remains locked until the quiz is passed.
- Passing attempts are idempotent for progress and awarding points.

## Subscriptions and payments

- Each course has a monthly price and an optional full-course price.
- `activate_subscription` creates or renews the active subscription and creates the enrollment.
- A grace period (default 3 days) allows access after `current_period_end`; after that the subscription expires.
- `SystemSettings` can override grace days, subscription period, quiz passing score, and provider toggles.
- Payment success can only be applied through the authoritative `mark_payment_success` service:
  - row lock on the payment;
  - provider and amount checks;
  - idempotent duplicate handling;
  - provider transaction uniqueness;
  - subscription activation and notification side effects.
- Click uses an MD5 signature, Payme uses JSON-RPC Basic authentication, and Uzum uses an API key. Every callback is logged in `PaymentWebhookLog`.
- Sandbox provider is enabled only when `DEBUG=true` and `PAYMENT_SANDBOX_ENABLED=true`.

## Certificates

- Certificates are issued only after all course lessons are complete.
- Issuance is idempotent per `(user, course)`.
- The PDF includes student/course/teacher data, certificate ID, issue date, and a QR code pointing to the public verification page.
- A certificate can be revoked by an admin with a reason.
- Public verification records each lookup in `CertificateVerification`.
- DejaVu fonts are installed in the backend image so Cyrillic PDFs render correctly.

## Notifications

- In-app notifications are persisted rows with Uzbek/Russian title and message fields.
- Creating a notification optionally queues Telegram and FCM delivery tasks.
- Telegram linking uses a one-time token and a webhook protected by `TELEGRAM_WEBHOOK_SECRET`.
- FCM uses Firebase service-account credentials from JSON or a mounted file.
- Broadcasts target all students, course students, or (for admins) all users; teachers are limited to their own courses.

## Analytics and leaderboard

- Dashboards aggregate real `Enrollment`, `Subscription`, `Payment`, `QuizAttempt`, `Certificate`, and notification data.
- Teacher analytics are scoped to the teacher's courses.
- Admin analytics include revenue, conversion, top courses, providers, recent payments, and recent users with real enrollment/course counts.
- Leaderboard supports points, completed courses, quiz accuracy, and an overall score, with week/month/all periods.
- `DailyAnalytics` is rebuilt by a Celery task.

## Frontend

- Next.js App Router, React Server Components for metadata/SSR, client components for authenticated flows.
- TanStack Query handles server state; React Hook Form + Zod handle forms.
- The dictionary in `frontend/lib/i18n.tsx` provides Uzbek (default) and Russian UI with persisted language and theme.
- Public routes: home, catalog, category, course detail, certificate verification, legal, about.
- Student routes: dashboard, courses, learning/lesson, leaderboard, notifications, payments, certificates, profile, settings.
- Teacher/admin portals: overview, courses editor, lessons/quizzes/videos, students, payments, discounts, comments, notifications, certificates, settings, audit log.
- The UI never fabricates statistics: loading states show skeletons/ellipses, empty datasets show empty states, and API errors show actionable messages.

## Mobile

- Native Flutter UI, no WebView.
- `ApiClient` mirrors the web client: access token in memory, refresh token in `SharedPreferences`, automatic refresh on 401.
- Screens: login/register, catalog, course detail, learning list, lesson player, quiz, notifications, profile.
- Theme and language are persisted locally.
- Release builds must pass `--dart-define=API_BASE_URL=https://...`; cleartext HTTP is restricted to local development hosts.
