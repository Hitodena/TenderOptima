from app.db.dao.base_dao import BaseDAO
from app.db.models import SupplierResponse


class SupplierResponseDAO(BaseDAO[SupplierResponse]):
    model = SupplierResponse
