import mimetypes
import uuid
from pathlib import Path
from typing import Annotated
from urllib.parse import unquote

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import (
    get_admin,
    get_config_instance,
    get_current_user,
    get_current_user_optional,
    get_session,
)
from backend.api.feedback.schemas import (
    FrontendErrorLogCreate,
    FrontendErrorLogPageResponse,
    FrontendErrorLogResponse,
    IdeaAttachment,
    IdeaSuggestionPageResponse,
    IdeaSuggestionResponse,
    UserBriefResponse,
)
from backend.core.config import ALLOWED_CONTENT_TYPES, Config
from backend.db.dao import FrontendErrorLogDAO, IdeaSuggestionDAO
from backend.db.models import FrontendErrorLog, IdeaSuggestion, User

router = APIRouter(prefix="/feedback", tags=["Feedback"])


def _user_brief(user: User | None) -> UserBriefResponse | None:
    if user is None:
        return None
    return UserBriefResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
    )


def _error_response(row: FrontendErrorLog) -> FrontendErrorLogResponse:
    return FrontendErrorLogResponse(
        id=row.id,
        user_id=row.user_id,
        user=_user_brief(row.user),
        message=row.message,
        backend_response=row.backend_response,
        page_url=row.page_url,
        request_method=row.request_method,
        request_url=row.request_url,
        status_code=row.status_code,
        created_at=row.created_at,
    )


def _original_filename(stored_name: str) -> str:
    """Strip leading ``{uuid.hex}_`` prefix from a stored filename."""
    if "_" in stored_name:
        prefix, rest = stored_name.split("_", 1)
        if len(prefix) == 32 and rest:
            return rest
    return stored_name


def _attachment_from_path(path_str: str) -> IdeaAttachment:
    path = Path(path_str)
    size = path.stat().st_size if path.is_file() else None
    filename = _original_filename(path.name)
    media_type = mimetypes.guess_type(filename)[0]
    return IdeaAttachment(
        filename=filename,
        content_type=media_type,
        size=size,
        path=path_str,
    )


def _idea_response(row: IdeaSuggestion) -> IdeaSuggestionResponse:
    paths = row.attachment_paths or []
    return IdeaSuggestionResponse(
        id=row.id,
        user_id=row.user_id,
        user=_user_brief(row.user),
        message=row.message,
        attachments=[_attachment_from_path(p) for p in paths if p],
        created_at=row.created_at,
    )


def _resolve_idea_attachment_path(
    raw_path: str, upload_dir: str
) -> Path | None:
    """Sanitize path and ensure it lives under ``idea_suggestions/``."""
    try:
        decoded = unquote(raw_path)
        p = Path(decoded)
        if "uploads" in p.parts:
            idx = p.parts.index("uploads")
            rel = Path(*p.parts[idx + 1 :])
        else:
            rel = p
        if not rel.parts or rel.parts[0] != "idea_suggestions":
            return None
        base = Path(upload_dir).resolve()
        candidate = (base / rel).resolve(strict=False)
        if not str(candidate).startswith(str(base)):
            return None
        if candidate.is_file():
            return candidate
        return None
    except Exception:
        return None


@router.post(
    "/errors",
    status_code=status.HTTP_201_CREATED,
    response_model=FrontendErrorLogResponse,
    summary="Log a frontend error (optional auth)",
)
async def log_frontend_error(
    body: FrontendErrorLogCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User | None, Depends(get_current_user_optional)],
) -> FrontendErrorLogResponse:
    row = await FrontendErrorLogDAO.create(
        session,
        user_id=current_user.id if current_user else None,
        message=body.message,
        backend_response=body.backend_response,
        page_url=body.page_url,
        request_method=body.request_method,
        request_url=body.request_url,
        status_code=body.status_code,
    )
    return _error_response(row)


@router.get(
    "/errors",
    response_model=FrontendErrorLogPageResponse,
    summary="List frontend errors (admin)",
)
async def list_frontend_errors(
    session: Annotated[AsyncSession, Depends(get_session)],
    _admin: Annotated[User, Depends(get_admin)],
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> FrontendErrorLogPageResponse:
    rows, total = await FrontendErrorLogDAO.list_page(
        session, page=page, size=size
    )
    return FrontendErrorLogPageResponse(
        items=[_error_response(r) for r in rows],
        page=page,
        size=size,
        total=total,
    )


@router.post(
    "/ideas",
    status_code=status.HTTP_201_CREATED,
    response_model=IdeaSuggestionResponse,
    summary="Submit an idea or problem report (requires auth)",
)
async def submit_idea(
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
    config: Annotated[Config, Depends(get_config_instance)],
    message: Annotated[str, Form(min_length=1, max_length=4000)],
    files: Annotated[list[UploadFile] | None, File()] = None,
) -> IdeaSuggestionResponse:
    uploads = files or []
    if len(uploads) > config.max_idea_upload_files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Maximum {config.max_idea_upload_files} files "
                "allowed per submission"
            ),
        )

    cleaned_message = message.strip()
    if not cleaned_message:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Message must not be empty",
        )

    # Validate all uploads before creating the DB row.
    for file in uploads:
        if file.size and file.size > config.max_idea_upload_size:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=(
                    f"File exceeds "
                    f"{config.max_idea_upload_size // (1024 * 1024)} MB"
                ),
            )
        if (
            file.content_type
            and file.content_type not in ALLOWED_CONTENT_TYPES
        ):
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"Unsupported file type: {file.content_type}",
            )
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Filename is required",
            )

    row = await IdeaSuggestionDAO.create(
        session,
        user_id=current_user.id,
        message=cleaned_message,
        attachment_paths=[],
    )

    saved_paths: list[str] = []
    if uploads:
        idea_dir = Path(config.upload_dir) / "idea_suggestions" / str(row.id)
        idea_dir.mkdir(parents=True, exist_ok=True)

        for file in uploads:
            safe_filename = Path(file.filename or "file").name.replace(
                "..", "_"
            )
            unique_filename = f"{uuid.uuid4().hex}_{safe_filename}"
            file_path = idea_dir / unique_filename
            content = await file.read()
            if len(content) > config.max_idea_upload_size:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=(
                        f"File exceeds "
                        f"{config.max_idea_upload_size // (1024 * 1024)} MB"
                    ),
                )
            file_path.write_bytes(content)
            saved_paths.append(str(file_path))

        await IdeaSuggestionDAO.update_fields(
            session, row.id, attachment_paths=saved_paths
        )
        row.attachment_paths = saved_paths

    row.user = current_user
    return _idea_response(row)


@router.get(
    "/ideas",
    response_model=IdeaSuggestionPageResponse,
    summary="List idea suggestions (admin)",
)
async def list_ideas(
    session: Annotated[AsyncSession, Depends(get_session)],
    _admin: Annotated[User, Depends(get_admin)],
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> IdeaSuggestionPageResponse:
    rows, total = await IdeaSuggestionDAO.list_page(
        session, page=page, size=size
    )
    return IdeaSuggestionPageResponse(
        items=[_idea_response(r) for r in rows],
        page=page,
        size=size,
        total=total,
    )


@router.get(
    "/ideas/attachments/serve",
    summary="Download an idea attachment (admin)",
)
async def serve_idea_attachment(
    _admin: Annotated[User, Depends(get_admin)],
    config: Annotated[Config, Depends(get_config_instance)],
    attachment_path: Annotated[
        str,
        Query(description="Stored attachment path (full or relative)"),
    ],
) -> FileResponse:
    """Stream an idea attachment after path sanitization (admin only)."""
    candidate = _resolve_idea_attachment_path(
        attachment_path, config.upload_dir
    )
    if candidate is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found",
        )

    filename = _original_filename(candidate.name)
    media_type = (
        mimetypes.guess_type(filename)[0] or "application/octet-stream"
    )
    return FileResponse(
        path=str(candidate),
        filename=filename,
        media_type=media_type,
    )
