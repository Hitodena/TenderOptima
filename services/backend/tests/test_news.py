from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from backend.api.news.router import acknowledge_news
from backend.api.news.schemas import NewsCreate, NewsUpdate
from backend.db.models import NewsRead


class FakeSession:
    def __init__(self, *, active_news_id):
        self.active_news_id = active_news_id
        self.receipts = {}
        self.pending = None
        self.commits = 0

    async def scalar(self, _statement):
        return self.active_news_id

    async def get(self, model, key):
        assert model is NewsRead
        return self.receipts.get(key)

    def add(self, row):
        self.pending = row

    async def commit(self):
        self.commits += 1
        key = (self.pending.news_id, self.pending.user_id)
        self.receipts[key] = self.pending
        self.pending = None

    async def rollback(self):
        self.pending = None


def test_news_create_trims_content_and_sets_outage_default() -> None:
    news = NewsCreate(
        title="  Модуль временно недоступен  ",
        content="  Ведём работы.  ",
        module_name="  Поиск поставщиков  ",
    )

    assert news.title == "Модуль временно недоступен"
    assert news.content == "Ведём работы."
    assert news.module_name == "Поиск поставщиков"
    assert news.severity == "warning"


def test_news_create_rejects_blank_content_and_unknown_severity() -> None:
    with pytest.raises(ValidationError):
        NewsCreate(title="Сбой", content="   ")

    with pytest.raises(ValidationError):
        NewsCreate(title="Сбой", content="Идут работы", severity="critical")


def test_news_update_allows_deactivation_and_clearing_module_name() -> None:
    update = NewsUpdate(is_active=False, module_name="   ")

    assert update.is_active is False
    assert update.module_name == ""


def test_read_receipt_uses_news_and_user_as_composite_primary_key() -> None:
    primary_key_columns = list(NewsRead.__table__.primary_key.columns)

    assert [column.name for column in primary_key_columns] == [
        "news_id",
        "user_id",
    ]


@pytest.mark.asyncio
async def test_acknowledgement_is_persisted_once_per_user() -> None:
    news_id = uuid4()
    first_user = SimpleNamespace(id=uuid4())
    second_user = SimpleNamespace(id=uuid4())
    session = FakeSession(active_news_id=news_id)

    await acknowledge_news(news_id, session, first_user)
    await acknowledge_news(news_id, session, first_user)
    await acknowledge_news(news_id, session, second_user)

    assert session.commits == 2
    assert (news_id, first_user.id) in session.receipts
    assert (news_id, second_user.id) in session.receipts


@pytest.mark.asyncio
async def test_acknowledgement_rejects_inactive_or_unknown_news() -> None:
    session = FakeSession(active_news_id=None)

    with pytest.raises(HTTPException) as exc_info:
        await acknowledge_news(uuid4(), session, SimpleNamespace(id=uuid4()))

    assert exc_info.value.status_code == 404
    assert session.commits == 0
