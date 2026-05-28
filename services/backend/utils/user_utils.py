from backend.db.models import User


def build_business_info(user: User) -> str:
    """Default business card/signature for emails.

    Format: 'С Уважением, специалист отдела закупок\nFull Name\n(Email для связи: ...)' if contact.
    """
    name = user.full_name or user.company_name or "специалист отдела закупок"
    contact = (
        f"\n(Email для связи: {user.contact_email})"
        if user.contact_email
        else ""
    )
    return f"С Уважением,\nспециалист отдела закупок\n{name}{contact}"
