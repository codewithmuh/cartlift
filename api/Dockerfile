FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
RUN chmod +x /app/entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
# Long timeout: audits are synchronous and SEO can crawl up to 12 pages + make
# two Claude calls (each capped at 60s in the runner). 60s gunicorn timeout
# was killing SEO mid-flight. A proper fix is a background job queue, but
# 300s unblocks the worst-case run today.
CMD ["gunicorn", "conf.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "300", "--access-logfile", "-"]
