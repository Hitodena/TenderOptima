FROM python:3.12-slim AS deps

WORKDIR /app

RUN pip install --no-cache-dir uv

COPY pyproject.toml uv.lock ./

RUN uv sync --frozen --no-dev

FROM python:3.12-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
	curl \
	tesseract-ocr \
	tesseract-ocr-eng \
	tesseract-ocr-rus \
	fontconfig \
	fonts-liberation \
	libreoffice-writer \
	&& rm -rf /var/lib/apt/lists/* \
	&& groupadd --gid 1001 appgroup \
	&& useradd --uid 1001 --gid appgroup --create-home --home-dir /home/appuser appuser

WORKDIR /app

COPY --from=deps /app/.venv /app/.venv

COPY --chown=appuser:appgroup . ./backend/

ENV PATH="/app/.venv/bin:$PATH" \
	PYTHONPATH=/app \
	PYTHONUNBUFFERED=1 \
	PYTHONDONTWRITEBYTECODE=1 \
	HOME=/home/appuser \
	SAL_USE_VCLPLUGIN=svp \
	SAL_DISABLE_OPENCL=1

RUN mkdir -p /app/celerybeat /app/uploads /home/appuser/.cache && \
	chown -R appuser:appgroup /app/celerybeat /app/uploads /home/appuser

USER appuser

FROM base AS backend

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]

FROM base AS worker

CMD ["celery", "-A", "backend.celery_app.celery_config", "worker", \
	"--pool=prefork", "--loglevel=info", "--concurrency=4", \
	"--queues", "mail_send,mail_poll,mail_reply,parser_search,analysis"]

FROM base AS beat

CMD ["celery", "-A", "backend.celery_app.celery_config", "beat", \
	"--loglevel=info", "--schedule=/app/celerybeat/celerybeat-schedule"]
