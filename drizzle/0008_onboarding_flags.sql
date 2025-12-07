CREATE TABLE IF NOT EXISTS "onboarding_progress" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "page_key" text NOT NULL,
  "completed_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "onboarding_progress_user_page_key_idx"
  ON "onboarding_progress" ("user_id", "page_key");


