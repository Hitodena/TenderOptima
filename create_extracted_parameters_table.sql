-- Create table for supplier extracted parameters
CREATE TABLE IF NOT EXISTS supplier_extracted_parameters (
  id SERIAL PRIMARY KEY,
  supplier_id INTEGER NOT NULL REFERENCES analysis_suppliers(id) ON DELETE CASCADE,
  parameter_name VARCHAR(255) NOT NULL,
  parameter_value TEXT NOT NULL,
  confidence DECIMAL(3,2) DEFAULT 0.8,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_supplier_extracted_parameters_supplier_id ON supplier_extracted_parameters(supplier_id);
