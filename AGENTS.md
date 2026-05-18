# SupplierFinder Project

## Main Goal

Automated supplier discovery and RFQ (Request for Quotation) processing pipeline:

- Search suppliers in internal DB or external search engines (Google/Yandex via LangChain)
- Generate personalized email requests from user-provided technical specifications
- Send bulk emails via SMTP using Celery workers
- Collect and parse incoming email responses
- AI-powered analysis (Local LLM) of responses
- Compare extracted data against original technical requirements
- Store history, manage blacklists, user auth

## Project Structure

- **Backend** (`app/`): FastAPI + SQLAlchemy + PostgreSQL + Redis + Celery
  - `core/`: config (Pydantic), logging
  - `api/`: routers (auth, user_requests, search_history, blacklist_domains)
  - `db/`: models (User, Supplier, Request, Response, Search, Subscription, BlacklistedDomain) + DAOs
  - `services/`: DB service layer
  - `celery_app/`: email sending tasks, worker context
  - `utils/`: JWT, security
- **Frontend** (`SupplierFinderFront/`): Nuxt 4.4.5 / Vue 3.5.34 + TypeScript
- **Infrastructure**: Docker, Alembic migrations, Jinja2 email templates
- **Config**: pyproject.toml (UV + Ruff), .env, docker-compose.yml

## Key Technologies

- Python 3.12, FastAPI, SQLAlchemy 2.0 (asyncpg), Pydantic v2
- Celery + Redis for background tasks (email sending)
- LangChain + LangGraph + Google API for intelligent search
- JWT auth, password hashing (argon2)
- Ruff for lint/format

## Workflow

1. User submits request + technical spec via frontend/API
2. System searches suppliers (DB + web)
3. Celery dispatches personalized SMTP emails
4. Responses collected, parsed, analyzed by LLM
5. Results compared to original spec, stored in history
6. Blacklist support for domains

Project follows SOLID, type hints, explicit error handling per AGENTS guidelines. Always use context7 MCP for working with libraries.
