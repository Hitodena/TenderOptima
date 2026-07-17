from fastapi import APIRouter

from backend.api.admin.router import router as admin_router
from backend.api.auth.router import router as auth_router
from backend.api.billing.router import router as billing_router
from backend.api.blacklist_domains.router import (
    router as blacklist_domains_router,
)
from backend.api.consultations.router import router as consultations_router
from backend.api.email_templates.router import router as email_templates_router
from backend.api.feedback.router import router as feedback_router
from backend.api.response_analysis.router import (
    router as response_analysis_router,
)
from backend.api.responses.router import router as responses_router
from backend.api.search_history.router import router as search_history_router
from backend.api.supplier_bookmarks.router import (
    router as supplier_bookmarks_router,
)
from backend.api.suppliers.router import (
    request_suppliers_router,
)
from backend.api.suppliers.router import (
    router as suppliers_router,
)
from backend.api.tz_analysis.router import router as tz_analysis_router
from backend.api.tz_creation.router import router as tz_creation_router
from backend.api.user_requests.router import router as user_requests_router

api_router = APIRouter(prefix="/api")
api_router.include_router(admin_router)
api_router.include_router(consultations_router)
api_router.include_router(feedback_router)
api_router.include_router(billing_router)
api_router.include_router(email_templates_router)
api_router.include_router(supplier_bookmarks_router)
api_router.include_router(auth_router)
api_router.include_router(user_requests_router)
api_router.include_router(responses_router)
api_router.include_router(response_analysis_router)
api_router.include_router(tz_analysis_router)
api_router.include_router(tz_creation_router)
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
