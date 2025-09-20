-- Manual migration script for schema changes

-- 1. Add region column to suppliers table
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS region text;

-- 2. Add unique constraint to website column in suppliers table
ALTER TABLE suppliers ADD CONSTRAINT IF NOT EXISTS suppliers_website_unique UNIQUE (website);

-- 3. Drop keywordStrength column from suppliers table (if it exists)
ALTER TABLE suppliers DROP COLUMN IF EXISTS keyword_strength;

-- 4. Create staging_suppliers table
CREATE TABLE IF NOT EXISTS staging_suppliers (
    id serial PRIMARY KEY,
    source_engine text NOT NULL,
    search_query text NOT NULL,
    region text,
    raw_title text,
    raw_description text,
    raw_url text NOT NULL,
    raw_emails text[],
    raw_phones text[],
    status text DEFAULT 'new',
    matched_supplier_id integer,
    created_at timestamp DEFAULT now(),
    CONSTRAINT staging_suppliers_matched_supplier_id_suppliers_id_fk 
        FOREIGN KEY (matched_supplier_id) REFERENCES suppliers(id)
);

-- 5. Create supplier_search_keywords table
CREATE TABLE IF NOT EXISTS supplier_search_keywords (
    id serial PRIMARY KEY,
    supplier_id integer NOT NULL,
    keyword text NOT NULL,
    CONSTRAINT supplier_search_keywords_supplier_id_suppliers_id_fk 
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
);

-- 6. Create unique index for supplier_search_keywords
CREATE UNIQUE INDEX IF NOT EXISTS supplier_keyword_idx 
    ON supplier_search_keywords (supplier_id, keyword);
