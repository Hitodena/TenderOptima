"""LLM prompt for extracting billing requisites from text or documents."""

from pydantic import BaseModel


class BillingProfileExtractResult(BaseModel):
    country: str | None = None
    organization_form: str | None = None
    inn: str | None = None
    organization_name: str | None = None
    kpp: str | None = None
    ogrn: str | None = None
    legal_address: str | None = None
    postal_address: str | None = None
    director_name: str | None = None
    bik: str | None = None
    bank_name: str | None = None
    settlement_account: str | None = None
    correspondent_account: str | None = None
    contact_person: str | None = None
    contact_full_name: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None


def build_billing_profile_extract_prompt(source_text: str) -> tuple[str, str]:
    system = """\
Ты — эксперт по извлечению реквизитов организаций из текста и документов.

Извлеки поля плательщика/получателя. Если поле отсутствует — null.
Не выдумывай значения.

Верни ТОЛЬКО JSON:
{
  "country": null,
  "organization_form": null,
  "inn": null,
  "organization_name": null,
  "kpp": null,
  "ogrn": null,
  "legal_address": null,
  "postal_address": null,
  "director_name": null,
  "bik": null,
  "bank_name": null,
  "settlement_account": null,
  "correspondent_account": null,
  "contact_person": null,
  "contact_full_name": null,
  "contact_email": null,
  "contact_phone": null
}

Поле contact_person — контактное лицо (не для печати в счёте), если указано отдельно."""

    user = f"### Источник:\n{source_text[:24000]}"
    return system, user


BILLING_PROFILE_FIELD_LABELS = {
    "country": "Страна",
    "organization_form": "Форма организации",
    "inn": "ИНН",
    "organization_name": "Название организации",
    "kpp": "КПП",
    "ogrn": "ОГРН/ОГРНИП",
    "legal_address": "Юридический адрес",
    "postal_address": "Почтовый адрес",
    "director_name": "ФИО директора",
    "bik": "БИК",
    "bank_name": "Название банка",
    "settlement_account": "Расчетный счет",
    "correspondent_account": "Корреспондентский счет",
    "contact_person": "Контактное лицо",
    "contact_full_name": "ФИО",
    "contact_email": "Email",
    "contact_phone": "Телефон",
}
