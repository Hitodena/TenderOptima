# AGENTS.md — TenderOptima

Rules for AI agents working in this repository.

## Communication style

Strict, professional tone. Write like technical documentation, not marketing copy.

- **No emojis** unless the user explicitly asks for them
- **No filler** — skip "Great question!", "Happy to help!", forced follow-ups
- **Concise by default** — short tasks get short answers; expand only when complexity requires it
- **Complete sentences** — good grammar; avoid telegraphic bullet chains as the whole reply
- **Proportional detail** — a one-line fix does not need three paragraphs
- **Bold sparingly** — use only when it aids scanning, not for decoration
- **Code citations** — use `startLine:endLine:filepath` blocks for existing code; plain fenced blocks for new snippets

### Task completion summary

When finishing implementation or fixes, end with a brief structured summary:

**What was fixed / done** — one or two sentences on the goal and outcome.

**Key changes** — bullet list of concrete changes (files, endpoints, behavior). Focus on *why it matters*, not a raw file dump.

Example:

> **What was done:** Bulk supplier toggle now uses a single API call instead of N parallel PATCH requests.
>
> **Key changes:**
> - `PATCH /requests/{id}/suppliers/enabled` — batch endpoint in backend router
> - `RequestSupplierDAO.set_enabled_bulk` — one SELECT + one commit
> - Frontend `updateSuppliersEnabled()` — shared by switch and select-all; suppresses cascade switch events

Do not repeat the full diff if the summary covers it. Do not ask "want me to…?" unless a real decision is blocked.

---

## Project structure

The repo is split into **services** under `services/`:

| Service     | Path                 | Purpose                                               |
| ----------- | -------------------- | ----------------------------------------------------- |
| Backend API | `services/backend/`  | FastAPI, Celery worker/beat, Alembic                  |
| Parser      | `services/parser/`   | Yandex search + contact scraping (standalone FastAPI) |
| Frontend    | `services/frontend/` | Nuxt 4 + @nuxt/ui                                     |

Root infrastructure: `docker-compose.yml`, `.env`, `.dockerignore`.

### Entry points

- Backend API: `services/backend/main.py` → `backend.main:app`
- Parser API: `services/parser/main.py` → `main:app`
- Frontend: `services/frontend/nuxt.config.ts`
- Migrations: `services/backend/alembic.ini`, `services/backend/migration/`

### Python imports

- **Backend** — `backend.*` package (code in `services/backend/`; Docker: `/app/backend/`, `PYTHONPATH=/app`)
- **Parser** — flat sibling modules (`orchestrator`, `search_manager`, …), no `parser.` prefix

---

## Agent workflow

### 1. Context from agentmemory (start of task)

Before work, restore project context:

- **New session / "where did we leave off"** → skill `handoff` (`.cursor/skills/agentmemory/handoff/`) → MCP `memory_sessions`, `memory_recall`
- **"What did we do recently"** → skill `recap`
- **Find past decisions** → skill `recall` → MCP `memory_smart_search`

After decisions (architecture, conventions, non-obvious trade-offs) → skill `remember` → MCP `memory_save` with `concepts` and `files`.

**Do not invent** agentmemory observations — only report what MCP returned.

### 2. Codebase analysis via codegraph (before edits)

**Required** before symbol search, refactors, and "how does X work" answers:

1. `codegraph_context` — first call for the task/area
2. If needed — one `codegraph_explore` or `codegraph_impact` for blast radius

**Do not** start with repo-wide `grep` + `read` when codegraph is available.

| Task                      | Tool                |
| ------------------------- | ------------------- |
| How a feature/area works  | `codegraph_context` |
| Who calls a symbol        | `codegraph_callers` |
| What a symbol calls       | `codegraph_callees` |
| What a change might break | `codegraph_impact`  |
| Find symbol by name       | `codegraph_search`  |

MCP server: `codegraph` (`.cursor/mcp.json`).

### 3. Skills by task type

| Area                       | Skill                                                                                     | When                                             |
| -------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------ |
| FastAPI, Pydantic, routers | `.cursor/skills/fastapi/`                                                                 | Backend API                                      |
| Nuxt (general)             | `.cursor/skills/nuxt-frontend/` → generated skill in `services/frontend/.nuxt/skill-hub/` | SSR, pages, Nitro, modules                       |
| Nuxt UI v4                 | `.cursor/skills/nuxt-ui/` + MCP `nuxt-ui`                                                 | Components, forms, layouts                       |
| Nuxt docs / modules        | MCP `nuxt`                                                                                | Nuxt documentation, deploy                       |
| UI/UX, design system       | `.cursor/skills/ui-ux-pro-max/`                                                           | New screens, visual decisions                    |
| Agentmemory                | `.cursor/skills/agentmemory/*/`                                                           | recall, remember, handoff, recap, commit-context |

**Frontend:** `services/frontend/AGENTS.md` points to the `nuxt-frontend` skill. If the generated skill is missing — `cd services/frontend && npm run postinstall` (or `nuxt prepare`).

**Nuxt UI MCP:** `get_component_metadata` / `get_component` before using unfamiliar components; `search_icons` for icons (`i-lucide-*`).

---

## Python (backend + parser)

### Dependencies and environment

- **uv only** (`uv run`, `uv add`, `uv sync`) — not pip
- Each service has its own `pyproject.toml` and `uv.lock`

### Formatting and lint — Ruff only

- **Do not fix style manually** (indentation, quotes, import order, minor lint fixes)
- After Python changes:
  ```bash
  uv run ruff check --fix .
  uv run ruff format .
  ```
- Config: `[tool.ruff]` in the service `pyproject.toml` (line-length 79, double quotes)

### Code documentation

- **Docstrings** — public modules, classes, non-trivial functions (DAO, Celery tasks, orchestrator pipeline, complex business logic)
- **Comments** — only where logic is non-obvious (anti-bot workarounds, timeouts, status state machines)
- Do not repeat in docstrings what is already clear from the signature

### Logging

- **loguru** — short message + keyword arguments:
  ```python
  logger.info("Search complete", found_domains=len(results))
  ```
- Do not mix `{}` formatting and pipe-separated strings in the message

### Backend conventions

- Routers: `services/backend/api/*/router.py`
- DAO: `services/backend/db/dao/`
- Celery: `services/backend/celery_app/`
- Enums: `services/backend/enums.py`
- FastAPI skill: `Annotated`, lifespan, Pydantic v2

---

## Frontend (Nuxt 4)

- `@nuxt/ui` v4 — semantic colors (`text-default`, `bg-elevated`), wrap app in `UApp`
- API via `useApi()` composable → `runtimeConfig.public.apiBase`
- Types: `services/frontend/shared/types/`
- Design tokens: `services/frontend/design-system/tenderoptima/MASTER.md`
- ESLint via `@nuxt/eslint` — do not fix style manually when eslint fix is enough

---

## Development commands

**Check OS** (Windows / Linux / macOS) before shell commands and use the correct syntax — avoid wasting iterations on `&&` in PowerShell or the reverse.

### Windows (PowerShell)

```powershell
cd services/backend; uv run uvicorn backend.main:app --reload --port 8000
cd services/parser; uv run uvicorn main:app --reload --port 8010
cd services/frontend; npm run dev
cd services/backend; uv run alembic -c alembic.ini upgrade head
```

### Linux / macOS

```bash
cd services/backend && uv run uvicorn backend.main:app --reload --port 8000
cd services/parser && uv run uvicorn main:app --reload --port 8010
cd services/frontend && npm run dev
cd services/backend && uv run alembic -c alembic.ini upgrade head
```

### Docker (from repo root)

```bash
docker compose up -d --build
```

| Service                    | Dockerfile                     | Port |
| -------------------------- | ------------------------------ | ---- |
| api, worker, beat, migrate | `services/backend/Dockerfile`  | 8000 |
| parser                     | `services/parser/Dockerfile`   | 8010 |
| frontend                   | `services/frontend/Dockerfile` | 3000 |

For worker in Docker: `PARSER_URL=http://parser:8010/search` (set in `docker-compose.yml` for the worker service)

### Tests

```bash
cd services/backend
uv run ruff check .
uv run pytest
```

Run lint before tests.

---

## Environment

- Root `.env` — docker-compose (PostgreSQL, Redis, SMTP, `PARSER_URL`, …)
- `services/backend/.env.example` — backend template
- Parser: `YANDEX_API_KEY`, `YANDEX_FOLDER_ID`
- Frontend: `services/frontend/.env` — `API_BASE` / `NUXT_PUBLIC_*`

Required services: **PostgreSQL**, **Redis**.

---

## MCP servers (`.cursor/mcp.json`)

| Server        | Purpose                                                         |
| ------------- | --------------------------------------------------------------- |
| `codegraph`   | Symbol index, callers/callees, impact — **primary code search** |
| `agentmemory` | Long-term session context, recall/remember                      |
| `nuxt-ui`     | @nuxt/ui component API                                          |
| `nuxt`        | Nuxt documentation                                              |

Context7 (`plugin-context7`) — external library docs when not covered by skills/MCP.

---

## Change principles

1. **Minimal diff** — do not touch unrelated code
2. **Existing patterns** — read surrounding code before adding new code
3. **Commits** — only when the user explicitly asks
4. **Secrets** — never commit `.env`, keys, or credentials
