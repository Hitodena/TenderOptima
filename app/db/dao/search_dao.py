from app.db.dao.base_dao import BaseDAO
from app.db.models import SearchHistory


class SearchHistoryDAO(BaseDAO[SearchHistory]):
    model = SearchHistory
