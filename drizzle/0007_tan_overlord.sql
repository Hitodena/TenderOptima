ALTER TABLE "email_improvement_templates" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "email_improvement_templates" CASCADE;--> statement-breakpoint
ALTER TABLE "email_reply_templates" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "email_reply_templates" ADD COLUMN "type" text DEFAULT 'reply' NOT NULL;