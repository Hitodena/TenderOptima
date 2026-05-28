from backend.db.dao.base_dao import BaseDAO
from backend.db.models import SearchHistory


class SearchHistoryDAO(BaseDAO[SearchHistory]):
    model = SearchHistory
