# API overview

Base URL: `https://your-domain.example/api`

Interactive schema: `/api/docs/`  
OpenAPI JSON: `/api/schema/`  
Health: `/api/health/`

## Authentication

Protected endpoints accept:

```http
Authorization: Bearer <access_token>
```

Web refresh tokens are also sent automatically as the HttpOnly cookie `ipa_refresh` (path `/api/auth/`). Mobile clients receive the refresh token in the JSON response when they send `"client": "mobile"` and can submit it as `{"refresh": "..."}`.

Access tokens expire after 30 minutes by default. Refresh rotates and blacklists the old token.

### Auth endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/auth/register/` | No | Register; returns access token and user |
| `POST` | `/auth/login/` | No | Login; sets refresh cookie |
| `POST` | `/auth/google/` | No | Sign in with a Google ID token credential |
| `POST` | `/auth/refresh/` | Cookie/body | Rotate refresh token and return a new access token |
| `POST` | `/auth/logout/` | Cookie/body | Blacklist refresh token and clear cookie |
| `GET/PATCH` | `/auth/me/` | Yes | Read/update the current user and profile |
| `POST` | `/auth/verify-email/` | No | Verify email with one-time token |
| `POST` | `/auth/resend-verification/` | Yes | Resend verification email |
| `POST` | `/auth/password-reset/` | No | Request password reset email |
| `POST` | `/auth/password-reset/confirm/` | No | Set a new password with reset token |
| `POST` | `/auth/change-password/` | Yes | Change password for the current user |

### Example login

```bash
curl -i -X POST https://example.com/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"student@example.com","password":"Student123!"}'
```

The response body contains `access` and `user`; `Set-Cookie` contains the HttpOnly refresh cookie.

## Public endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health/` | Database/Redis health |
| `GET` | `/stats/` | Public counts: students, courses, lessons, certificates, categories |
| `GET` | `/testimonials/` | Approved testimonials |
| `GET` | `/categories/` | Categories with published course counts |
| `GET` | `/courses/` | Catalog with search, filters, ordering, pagination |
| `GET` | `/courses/{slug}/` | Course detail, sections, lessons, subscription/progress when authenticated |
| `GET` | `/certificates/verify/{certificate_id}/` | Public certificate verification |
| `GET` | `/comments/?course_slug=...` | Public Q&A for a course/lesson |

### Catalog query parameters

- `search` — title/description search
- `category` — category slug
- `level` — `beginner`, `intermediate`, `advanced`
- `free=1`, `discounted=1`
- `price_min`, `price_max`
- `ordering` — `popular`, `newest`, `rating`, `price_low`, `price_high`, or a DRF field
- `page`, `page_size`
- `lang` — `uz` (default) or `ru`

## Student endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/analytics/dashboard/` | Dashboard summary, enrollments, certificates, attempts, payments |
| `GET` | `/my-courses/` | Enrolled/taught course list |
| `POST` | `/courses/{slug}/enroll/` | Enroll in a free course |
| `GET` | `/courses/{slug}/learn/` | Ordered learning payload |
| `POST` | `/progress/` or lesson progress endpoints | Save video progress/completion |
| `POST` | `/quizzes/{id}/start/` | Start an attempt; returns randomized questions without answers |
| `POST` | `/quiz-attempts/{id}/submit/` | Submit answers and receive score/pass result |
| `GET` | `/quiz-attempts/` | Attempt history |
| `GET/POST` | `/subscriptions/` | Read subscriptions; create checkout/subscription |
| `POST` | `/subscriptions/{id}/cancel/` | Cancel renewal |
| `GET` | `/payments/` | Own payments |
| `POST` | `/payments/checkout/` | Create a provider payment |
| `POST` | `/payments/{id}/sandbox_confirm/` | Confirm sandbox payment (development only) |
| `GET` | `/certificates/` | Own certificates |
| `GET` | `/certificates/{certificate_id}/download/` | Download own PDF |
| `GET` | `/notifications/` | Own notifications |
| `POST` | `/notifications/{id}/read/` | Mark one as read |
| `POST` | `/notifications/read-all/` | Mark all as read |
| `GET/POST/DELETE` | `/notifications/telegram/` | Telegram link state/link/unlink |
| `GET` | `/leaderboard/` | `type=overall\|points\|courses\|quizzes`, `period=all\|month\|week` |
| `GET` | `/comments/` | Q&A list |
| `POST` | `/comments/` | Create a question (requires course access for lesson comments) |
| `POST` | `/comments/{id}/reply/` | Reply where allowed |
| `DELETE` | `/comments/{id}/` | Soft-delete own comment |

### Quiz submission

```json
{
  "answers": [
    {
      "question_id": 42,
      "selected_options": [101, 103],
      "text_answer": ""
    }
  ]
}
```

The server scores the attempt. Four or more wrong answers return a restart-required result; the client must start a new attempt.

## Teacher endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/analytics/teacher/` | Teacher-scoped summary, series, course performance |
| `GET` | `/analytics/revenue/` | Teacher-scoped successful payment revenue |
| `GET/POST/PATCH/DELETE` | `/courses/` | Manage own courses |
| `POST` | `/courses/{slug}/publish/` | Publish own course (requires sections/lessons) |
| `POST` | `/courses/{slug}/unpublish/` | Unpublish own course |
| `GET/POST/PATCH/DELETE` | `/sections/`, `/lessons/`, `/videos/` | Curriculum CRUD |
| `GET/POST/PATCH/DELETE` | `/quizzes/` and nested questions/options | Quiz management |
| `GET/POST/PATCH/DELETE` | `/discounts/` | Discounts for own courses |
| `GET` | `/users/students/` | Students enrolled in own courses |
| `GET` | `/comments/?scope=teacher` | Comments on own courses |
| `POST` | `/comments/{id}/reply/` | Teacher reply |
| `POST` | `/comments/{id}/pin/` | Pin/unpin |
| `POST` | `/notifications/broadcast/` | Notify students of own course |
| `GET` | `/notifications/broadcasts/` | Broadcast history |
| `GET` | `/analytics/teacher/` | Teacher KPIs |

## Admin endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/analytics/admin/` | Platform summary, series, providers, top courses, recent payments/users |
| `GET` | `/analytics/revenue/` | Platform revenue |
| `GET/PATCH` | `/settings/` | Public fields for everyone; admin can update all `SystemSettings` fields |
| `GET` | `/users/` | Search/filter users with course/enrollment counts |
| `PATCH` | `/users/{id}/` | Update role/profile fields |
| `POST` | `/users/{id}/toggle_active/` | Enable/disable an account |
| `GET` | `/payments/` | All payments; admin can mark manual payments paid |
| `POST` | `/payments/{id}/mark_paid/` | Admin manual reconciliation |
| `GET` | `/certificates/` | All certificates |
| `POST` | `/certificates/{certificate_id}/revoke/` | Revoke with reason |
| `GET` | `/audit-logs/` | Admin audit trail |
| `GET/POST/PATCH/DELETE` | `/categories/` | Category CRUD |
| `POST` | `/notifications/broadcast/` | Platform-wide or audience broadcast |

## Error format

Errors use a consistent JSON shape:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Human-readable message",
    "details": {}
  }
}
```

HTTP status codes follow REST conventions: `400` validation, `401` unauthenticated, `403` forbidden/access denied, `404` not found, `409`/`400` for duplicate callbacks, `429` throttled, `500` server error.

## Pagination

List endpoints return:

```json
{
  "count": 48,
  "next": "...",
  "previous": null,
  "page": 1,
  "page_size": 12,
  "total_pages": 4,
  "results": []
}
```

## Payment callbacks

| Provider | Method | Path |
| --- | --- | --- |
| Click prepare | `POST` | `/payments/click/prepare/` |
| Click complete | `POST` | `/payments/click/complete/` |
| Payme JSON-RPC | `POST` | `/payments/payme/` |
| Uzum | `POST` | `/payments/uzum/callback/` |

These endpoints verify the provider signature/authentication/API key before changing payment state. They are idempotent for duplicate successful callbacks.
