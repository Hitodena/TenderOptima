-- Добавляем поля для отслеживания статуса обработки
ALTER TABLE supplier_responses 
ADD COLUMN processing_status TEXT DEFAULT 'pending',
ADD COLUMN processing_started_at TIMESTAMP,
ADD COLUMN processing_completed_at TIMESTAMP,
ADD COLUMN processing_error TEXT;

-- Добавляем индекс для быстрого поиска по статусу обработки
CREATE INDEX idx_supplier_responses_processing_status ON supplier_responses(processing_status);
CREATE INDEX idx_supplier_responses_user_processing ON supplier_responses(user_id, processing_status);
