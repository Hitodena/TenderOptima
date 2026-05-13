from fastapi import APIRouter

from app.api.auth.router import router as auth_router

api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router)


@api_router.get("/")
async def root():
    return {"message": "SupplierFinder API"}


__all__ = ["api_router"]
