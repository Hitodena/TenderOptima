CREATE TABLE "excluded_domains" (
	"id" serial PRIMARY KEY NOT NULL,
	"domain" text NOT NULL,
	"reason" text,
	"added_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "excluded_domains_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
ALTER TABLE "excluded_domains" ADD CONSTRAINT "excluded_domains_added_by_id_users_id_fk" FOREIGN KEY ("added_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;