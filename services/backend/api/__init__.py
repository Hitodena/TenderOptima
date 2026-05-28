from fastapi import APIRouter

from backend.api.auth.router import router as auth_router
from backend.api.blacklist_domains.router import (
    router as blacklist_domains_router,
)
from backend.api.responses.router import router as responses_router
from backend.api.search_history.router import router as search_history_router
from backend.api.suppliers.router import (
    request_suppliers_router,
)
from backend.api.suppliers.router import (
    router as suppliers_router,
)
from backend.api.user_requests.router import router as user_requests_router

api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router)
api_router.include_router(user_requests_router)
api_router.include_router(responses_router)
api_router.include_router(request_suppliers_router)
api_router.include_router(blacklist_domains_router)
api_router.include_router(suppliers_router)
api_router.include_router(search_history_router)


@api_router.get("/")
async def root():
    return {"message": "TenderOptima API"}


@api_router.get("/health")
async def health() -> dict:
    return {"status": "ok"}


__all__ = ["api_router"]
