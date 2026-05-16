FROM python:3.12-slim AS deps

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl && \
	rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv

COPY pyproject.toml uv.lock ./

RUN uv sync --frozen --no-dev

FROM python:3.12-slim AS base

RUN groupadd --gid 1001 appgroup && \
	useradd --uid 1001 --gid appgroup --no-create-home appuser

WORKDIR /app

COPY --from=deps /app/.venv /app/.venv

COPY --chown=appuser:appgroup app/ ./app/
COPY --chown=appuser:appgroup templates/ ./templates/
COPY --chown=appuser:appgroup migration/ ./migration/
COPY --chown=appuser:appgroup alembic.ini ./
COPY --chown=appuser:appgroup parser/ ./parser/

ENV PATH="/app/.venv/bin:$PATH" \
	PYTHONUNBUFFERED=1 \
	PYTHONDONTWRITEBYTECODE=1

RUN mkdir -p /app/celerybeat && \
	chown -R appuser:appgroup /app/celerybeat

USER appuser

FROM base AS api

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

FROM base AS parser_api

EXPOSE 8010

CMD ["uvicorn", "parser.main:app", "--host", "0.0.0.0", "--port", "8010"]


FROM base AS worker

CMD ["celery", "-A", "app.celery_app.celery_config", "worker", \
	"--pool=prefork", "--loglevel=info", "--concurrency=4", "--queues", "mail_send,mail_poll"]

FROM base AS beat

CMD ["celery", "-A", "app.celery_app.celery_config", "beat", \
	"--loglevel=info", "--schedule=/app/celerybeat/celerybeat-schedule"]
