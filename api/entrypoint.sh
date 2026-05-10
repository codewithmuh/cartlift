#!/usr/bin/env bash
set -e

echo "[bandit-api] waiting for postgres at $POSTGRES_HOST:$POSTGRES_PORT…"
python <<'PY'
import os, socket, time
host = os.environ.get("POSTGRES_HOST", "db")
port = int(os.environ.get("POSTGRES_PORT", "5432"))
for _ in range(60):
    try:
        with socket.create_connection((host, port), timeout=1.5):
            break
    except OSError:
        time.sleep(1)
else:
    raise SystemExit(f"postgres at {host}:{port} not reachable after 60s")
PY

echo "[bandit-api] makemigrations…"
python manage.py makemigrations accounts sites experiments audits --noinput

echo "[bandit-api] migrate…"
python manage.py migrate --noinput

echo "[bandit-api] collectstatic…"
python manage.py collectstatic --noinput >/dev/null

if [ "${DJANGO_CREATE_SUPERUSER:-0}" = "1" ] && [ -n "$DJANGO_SUPERUSER_EMAIL" ]; then
  echo "[bandit-api] ensuring superuser $DJANGO_SUPERUSER_EMAIL"
  python manage.py shell <<PY
from django.contrib.auth import get_user_model
U = get_user_model()
email = "$DJANGO_SUPERUSER_EMAIL"
if not U.objects.filter(email=email).exists():
    U.objects.create_superuser(email=email, password="$DJANGO_SUPERUSER_PASSWORD")
    print("created", email)
else:
    print("exists", email)
PY
fi

echo "[bandit-api] launching → $@"
exec "$@"
