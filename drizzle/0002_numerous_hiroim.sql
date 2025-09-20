ALTER TABLE "suppliers" ADD COLUMN "legal_name" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "tax_id" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "legal_address" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "bank_details" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "contact_person" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "updated_at" timestamp DEFAULT now();