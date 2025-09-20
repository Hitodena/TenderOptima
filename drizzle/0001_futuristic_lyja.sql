ALTER TABLE "supplier_responses" ADD COLUMN "verification_status" text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "supplier_responses" ADD COLUMN "verification_notes" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "verified_responses" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "unverified_responses" integer DEFAULT 0;