"""Attach bookmark-list suppliers to a request without running search."""

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.dao import RequestSupplierDAO, SupplierDAO
from backend.db.models.supplier_bookmark import SupplierBookmarkItem
from backend.enums import RequestSupplierStatus, SupplierSource


async def attach_bookmark_item(
    session: AsyncSession,
    *,
    request_id,
    user_id,
    item: SupplierBookmarkItem,
) -> bool:
    """Create or reuse a supplier and attach it as pending+enabled.

    Returns True when a new RequestSupplier row was created.
    """
    normalized_email = (item.email or "").lower().strip()
    if not normalized_email or "@" not in normalized_email:
        logger.warning(
            "Skipping bookmark item without valid email",
            item_id=str(item.id),
        )
        return False

    normalized_domain = item.domain.lower().strip() if item.domain else None
    if normalized_domain is not None and len(normalized_domain) < 3:
        normalized_domain = None

    existing = await SupplierDAO.get_by_domain(session, normalized_domain)
    if existing is None:
        existing = await SupplierDAO.get_by_main_email(
            session, normalized_email
        )
    if existing:
        supplier = existing
    else:
        supplier = await SupplierDAO.create(
            session,
            domain=normalized_domain,
            company_name=item.company_name.strip(),
            main_email=normalized_email,
            extra_emails=None,
            phone=item.phone.strip() if item.phone else None,
            comments=item.notes.strip() if item.notes else None,
            from_source=SupplierSource.MANUAL.value,
            added_by_user_id=user_id,
        )

    existing_rs = await RequestSupplierDAO.get_by_request_and_supplier(
        session, request_id=request_id, supplier_id=supplier.id
    )
    if existing_rs is None:
        existing_rs = await RequestSupplierDAO.get_by_request_and_email(
            session,
            request_id=request_id,
            email=normalized_email,
        )
    if existing_rs is not None:
        return False

    await RequestSupplierDAO.create(
        session,
        request_id=request_id,
        supplier_id=supplier.id,
        sent_to_email=normalized_email,
        sent_status=RequestSupplierStatus.PENDING,
        is_enabled=True,
    )
    return True
