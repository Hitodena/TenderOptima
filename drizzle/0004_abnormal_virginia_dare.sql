CREATE TABLE "email_reply_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"content" text NOT NULL,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unprocessed_emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"message_id" text NOT NULL,
	"sender_email" text NOT NULL,
	"sender_name" text,
	"subject" text NOT NULL,
	"content" text NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"received_at" timestamp NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"linked_request_id" integer,
	"replied_at" timestamp,
	"reply_content" text,
	"processed_by" integer,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unprocessed_emails_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
ALTER TABLE "search_requests" ADD COLUMN "search_session_id" text;--> statement-breakpoint
ALTER TABLE "staging_suppliers" ADD COLUMN "user_id" integer;--> statement-breakpoint
ALTER TABLE "staging_suppliers" ADD COLUMN "search_session_id" text;--> statement-breakpoint
ALTER TABLE "email_reply_templates" ADD CONSTRAINT "email_reply_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unprocessed_emails" ADD CONSTRAINT "unprocessed_emails_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unprocessed_emails" ADD CONSTRAINT "unprocessed_emails_linked_request_id_search_requests_id_fk" FOREIGN KEY ("linked_request_id") REFERENCES "public"."search_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unprocessed_emails" ADD CONSTRAINT "unprocessed_emails_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staging_suppliers" ADD CONSTRAINT "staging_suppliers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN "expiry_date";