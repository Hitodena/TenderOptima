-- Добавляем индексы для ускорения batch запросов
CREATE INDEX IF NOT EXISTS idx_supplier_responses_request_user ON supplier_responses(request_id, user_id);
CREATE INDEX IF NOT EXISTS idx_supplier_responses_user_request ON supplier_responses(user_id, request_id);
CREATE INDEX IF NOT EXISTS idx_supplier_responses_response_date ON supplier_responses(response_date DESC);

-- Индексы для других часто используемых запросов
CREATE INDEX IF NOT EXISTS idx_supplier_responses_user_id ON supplier_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_supplier_responses_request_id ON supplier_responses(request_id);
CREATE INDEX IF NOT EXISTS idx_supplier_responses_message_id ON supplier_responses(message_id);

-- Индексы для search_requests
CREATE INDEX IF NOT EXISTS idx_search_requests_user_id ON search_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_search_requests_status ON search_requests(status);
CREATE INDEX IF NOT EXISTS idx_search_requests_user_status ON search_requests(user_id, status);

-- Индексы для request_suppliers
CREATE INDEX IF NOT EXISTS idx_request_suppliers_request_id ON request_suppliers(request_id);
CREATE INDEX IF NOT EXISTS idx_request_suppliers_user_id ON request_suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_request_suppliers_user_request ON request_suppliers(user_id, request_id);
