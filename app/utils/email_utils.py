from app.db.models import Request, User


def build_request_email_body(
    request: Request,
    user: User,
) -> str:
    """Build email body for supplier request.

    Args:
        request: The request object
        user: The user who created the request

    Returns:
        Formatted email body string
    """
    labels_block = ""

    params = request.additional_params
    if params:
        if isinstance(params, list) and params:
            labels_block = (
                "\n" + "\n".join(f"- {label}" for label in params) + "\n"
            )

    plain_body = (
        "Запрос коммерческого предложения\n\n"
        "Добрый день.\n\n"
        "Направляем запрос для получения вашего коммерческого предложения на:\n\n"
        f"{request.description}\n\n"
        "! В вашем ответе обязательно укажите:\n"
        "-------------------------------------"
        f"{labels_block}"
        "-------------------------------------\n\n"
        "С Уважением,\n"
        f"{user.full_name or user.company_name or 'Менеджер по закупкам'}\n"
        f"{user.email}"
    )

    return plain_body
