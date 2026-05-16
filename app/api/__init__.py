from fastapi import APIRouter

from app.api.auth.router import router as auth_router
from app.api.blacklist_domains.router import router as blacklist_domains_router
from app.api.search_history.router import router as search_history_router
from app.api.user_requests.router import router as user_requests_router

api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router)
api_router.include_router(user_requests_router)
api_router.include_router(blacklist_domains_router)
api_router.include_router(search_history_router)


@api_router.get("/")
async def root():
    return {"message": "SupplierFinder API"}


@api_router.get("/health")
async def health() -> dict:
    return {"status": "ok"}


__all__ = ["api_router"]
