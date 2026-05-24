from app.db.models import Request, User
from app.utils.user_utils import build_business_info


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
                "\n"
                + "\n".join(
                    f"{i}. {label}" for i, label in enumerate(params, 1)
                )
                + "\n"
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
        ""
        "Важно: не меняйте тему сообщения в ответе, чтобы не потерять идентификатор отслеживания.\n\n"
        f"{user.business_info or build_business_info(user)}\n"
    )

    return plain_body
