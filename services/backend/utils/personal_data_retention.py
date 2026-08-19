"""Retention periods for personal-data processing purposes (days)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class PersonalDataPurpose:
    """One row from the personal-data processing purposes register."""

    purpose_number: int
    purpose: str
    subjects: str
    data_list: str
    legal_basis: str
    retention_text: str
    retention_days_after_user_deletion: int | None
    cleanup_supported: bool
    cleanup_task_name: str | None
    cleanup_description: str | None


PERSONAL_DATA_PURPOSES: tuple[PersonalDataPurpose, ...] = (
    PersonalDataPurpose(
        purpose_number=1,
        purpose=(
            "Регистрация и доступ в Личный кабинет "
            "(создание учётной записи, вход в систему, защита аккаунта)"
        ),
        subjects=(
            "Пользователи Сервиса — физические лица, прошедшие процедуру "
            "регистрации на Сайте"
        ),
        data_list="Логин; Пароль",
        legal_basis=(
            "Обработка необходима для исполнения обязательств по договору"
        ),
        retention_text=(
            "В течение срока существования учетной записи. "
            "В случае удаления учетной записи — 1 год с момента получения "
            "запроса на удаление, если иное не предусмотрено законодательством"
        ),
        retention_days_after_user_deletion=365,
        cleanup_supported=True,
        cleanup_task_name="retention.cleanup_purpose_1",
        cleanup_description=(
            "Финализирует регистрационные/access-данные tombstone-пользователя "
            "через 365 дней после users.deleted_at"
        ),
    ),
    PersonalDataPurpose(
        purpose_number=2,
        purpose=(
            "Направление запросов Поставщикам и получение коммерческих "
            "предложений"
        ),
        subjects=(
            "Пользователи Сервиса — физические лица, инициировавшие отправку "
            "запроса Поставщикам"
        ),
        data_list=(
            "Фамилия, имя, отчество (ФИО); Должность; Наименование организации"
        ),
        legal_basis=(
            "Обработка необходима для исполнения обязательств по договору"
        ),
        retention_text=(
            "В течение срока существования учетной записи. "
            "В случае удаления учетной записи — 30 дней с момента получения "
            "запроса на удаление, если иное не предусмотрено законодательством"
        ),
        retention_days_after_user_deletion=30,
        cleanup_supported=True,
        cleanup_task_name="retention.cleanup_purpose_2",
        cleanup_description=(
            "Очищает тексты запросов, письма и вложения, связанные с "
            "удалённым пользователем, через 30 дней после users.deleted_at"
        ),
    ),
    PersonalDataPurpose(
        purpose_number=3,
        purpose=(
            "Информирование о работе Сервиса (статусы запросов, новые "
            "предложения, изменения и обновления)"
        ),
        subjects=(
            "Пользователи Сервиса — физические лица, зарегистрированные на Сайте"
        ),
        data_list="Логин; ФИО (при наличии в учетной записи)",
        legal_basis=(
            "Обработка необходима для исполнения обязательств по договору"
        ),
        retention_text=(
            "В течение срока существования учетной записи. "
            "В случае удаления учетной записи — 30 дней с момента получения "
            "запроса на удаление"
        ),
        retention_days_after_user_deletion=30,
        cleanup_supported=False,
        cleanup_task_name=None,
        cleanup_description=None,
    ),
    PersonalDataPurpose(
        purpose_number=4,
        purpose=(
            "Анализ и улучшение работы Сервиса (обезличенная статистика "
            "использования, контроль качества, отчётность)"
        ),
        subjects=(
            "Пользователи Сервиса — физические лица, зарегистрированные на Сайте"
        ),
        data_list=(
            "Логин; ФИО (при наличии в учетной записи); "
            "Наименование организации (при наличии в учетной записи)"
        ),
        legal_basis=(
            "Обработка необходима для исполнения обязательств по договору"
        ),
        retention_text=(
            "3 года с момента удаления учетной записи, если иное не "
            "предусмотрено законодательством"
        ),
        retention_days_after_user_deletion=1095,
        cleanup_supported=True,
        cleanup_task_name="retention.cleanup_purpose_4",
        cleanup_description=(
            "Обезличивает историю поиска и аналитику удалённого пользователя "
            "через 1095 дней после users.deleted_at"
        ),
    ),
    PersonalDataPurpose(
        purpose_number=5,
        purpose=(
            "Направление обязательных сервисных уведомлений (информирование о "
            "статусе запросов, поступлении новых коммерческих предложений в "
            "Личный кабинет, изменениях в работе Платформы, важных обновлениях, "
            "влияющих на использование Сервиса)"
        ),
        subjects=(
            "Пользователи Сервиса — физические лица, направившие обращение, "
            "запрос или жалобу Оператору"
        ),
        data_list=(
            "ФИО; Логин; Иные данные, указанные Пользователем в обращении"
        ),
        legal_basis=(
            "Обработка необходима для исполнения обязательств по договору"
        ),
        retention_text=(
            "3 года с момента окончания рассмотрения обращения, если иное не "
            "предусмотрено законодательством"
        ),
        retention_days_after_user_deletion=1095,
        cleanup_supported=True,
        cleanup_task_name="retention.cleanup_purpose_5",
        cleanup_description=(
            "Удаляет обращения/ошибки удалённого пользователя "
            "(ideas, frontend errors) через 1095 дней после users.deleted_at"
        ),
    ),
    PersonalDataPurpose(
        purpose_number=6,
        purpose=(
            "Рассмотрение обращений, запросов и жалоб, связанных с "
            "персональными данными и правами потребителя, в том числе "
            "внесённых в книгу замечаний и предложений"
        ),
        subjects=(
            "Пользователи Сервиса — физические лица, чьи данные обрабатываются "
            "в рамках спора"
        ),
        data_list=(
            "Все персональные данные, обрабатываемые Оператором в отношении "
            "конкретного Пользователя"
        ),
        legal_basis=(
            "Выполнение обязанностей, предусмотренных законодательными актами"
        ),
        retention_text=(
            "5 лет после окончания ведения и передачи в архив организации"
        ),
        retention_days_after_user_deletion=1825,
        cleanup_supported=False,
        cleanup_task_name=None,
        cleanup_description=None,
    ),
    PersonalDataPurpose(
        purpose_number=7,
        purpose=(
            "Информирование о новых продуктах, услугах, специальных "
            "предложениях, акциях и новостях Платформы"
        ),
        subjects=(
            "Пользователи, явно выразившие согласие на получение "
            "маркетинговых сообщений (чек-бокс «Согласен на рассылку»)"
        ),
        data_list="Адрес электронной почты, имя (ФИО при наличии в профиле)",
        legal_basis="Согласие Пользователя",
        retention_text="3 года",
        retention_days_after_user_deletion=1095,
        cleanup_supported=True,
        cleanup_task_name="retention.cleanup_purpose_7",
        cleanup_description=(
            "Снимает маркетинговое согласие и контактные поля удалённого "
            "пользователя через 1095 дней после users.deleted_at"
        ),
    ),
)

CLEANUP_SUPPORTED_PURPOSE_NUMBERS: frozenset[int] = frozenset(
    p.purpose_number for p in PERSONAL_DATA_PURPOSES if p.cleanup_supported
)


def get_purpose(purpose_number: int) -> PersonalDataPurpose | None:
    """Return a purpose row by number."""
    for purpose in PERSONAL_DATA_PURPOSES:
        if purpose.purpose_number == purpose_number:
            return purpose
    return None
