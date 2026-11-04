#!/bin/sh
set -e

python manage.py collectstatic --noinput

if [ -n "$DATABASE_URL" ] || [ -n "$POSTGRES_URL" ] || [ -n "$POSTGRES_PRISMA_URL" ]; then
  python manage.py migrate --noinput
else
  echo "No database URL configured; skipping migrations."
  echo "Attach Postgres/Neon to the Vercel project and redeploy to run migrations."
fi
