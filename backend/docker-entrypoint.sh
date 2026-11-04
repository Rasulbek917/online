#!/bin/sh
set -eu

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "Applying database migrations..."
  python manage.py migrate --noinput
fi

if [ "${COLLECT_STATIC:-false}" = "true" ]; then
  echo "Collecting static files..."
  python manage.py collectstatic --noinput --clear
fi

if [ "${SEED_DEMO:-false}" = "true" ]; then
  echo "Seeding demo data (idempotent)..."
  python manage.py seed_demo
fi

exec "$@"
