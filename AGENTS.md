# SupplierFinder

## Commands (use UV exclusively)

- `uv run` for scripts/tests
- `uv run ruff check` / `uv run ruff format` (line-length 79, double quotes)
- `uv add`, `uv sync`, `uv lock` only
- Never use pip/poetry

## Structure & Entry Points

- Backend: `app/` (FastAPI, /app layout)
- Frontend: `SupplierFinderFront/` (Nuxt/Vue)
- Infra: docker-compose.yml (postgres, redis, migrate via alembic, api)
- Migrations: run via `docker compose up migrate` or container

## Key Practices

- Always use context7 MCP for library docs, use nuxt / nuxtui MCP for frontend
- Follow python-practices.md: type hints on all public funcs, SOLID, explicit errors (no bare except)
- Ruff handles all lint/format; pyproject.toml is source of truth
- Celery for email tasks; Alembic for DB

Project uses Docker for services; .env required. See existing AGENTS guidelines and python-practices for details.
