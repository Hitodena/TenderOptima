CREATE TABLE "analysis_extracted_requirements" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"section_id" integer,
	"tech_spec_number" text NOT NULL,
	"extracted_value" text NOT NULL,
	"full_section_path" varchar(50),
	"confidence" real DEFAULT 0.8,
	"is_approved" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "analysis_project_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"original_name" text NOT NULL,
	"file_data" text NOT NULL,
	"mimetype" text NOT NULL,
	"file_size" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "analysis_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"procedure_name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'step1_requirements' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "analysis_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"user_id" integer,
	"title" text NOT NULL,
	"date_created" timestamp DEFAULT now(),
	"compared_suppliers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"parameters" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recommended_supplier" text,
	"recommendation_reason" text,
	"analysis_content" text NOT NULL,
	"pdf_url" text
);
--> statement-breakpoint
CREATE TABLE "analysis_suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "compliance_analysis" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"supplier_id" integer NOT NULL,
	"analysis_data" jsonb NOT NULL,
	"compliance_percentage" real NOT NULL,
	"gaps_identified" text[] DEFAULT '{}',
	"recommendations" text[] DEFAULT '{}',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contact_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"name" text NOT NULL,
	"description" text,
	"contact_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contact_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"group_id" integer NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"phone" text,
	"organization" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"group_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"status" text DEFAULT 'created' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extracted_parameters" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"response_id" integer NOT NULL,
	"request_id" integer NOT NULL,
	"supplier_email" text NOT NULL,
	"parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"extraction_date" timestamp DEFAULT now(),
	"last_update_date" timestamp DEFAULT now(),
	"status" text DEFAULT 'completed' NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "improvement_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"request_id" integer NOT NULL,
	"supplier_id" text NOT NULL,
	"supplier_email" text NOT NULL,
	"supplier_name" text NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"request_type" text DEFAULT 'improvement' NOT NULL,
	"tracking_id" text,
	"sent_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "managers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"position" text,
	"email" text NOT NULL,
	"phone" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "managers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "request_parameters" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"request_id" integer NOT NULL,
	"parameters" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "request_supplier_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"request_supplier_id" integer NOT NULL,
	"contact_group_id" integer NOT NULL,
	"added_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "request_supplier_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"request_supplier_id" integer NOT NULL,
	"content" text NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"direction" text NOT NULL,
	"sent_date" timestamp NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"request_id" integer NOT NULL,
	"supplier_id" text NOT NULL,
	"supplier_email" text NOT NULL,
	"supplier_name" text NOT NULL,
	"supplier_website" text,
	"supplier_phone" text,
	"tracking_id" text NOT NULL,
	"sent_at" timestamp DEFAULT now(),
	"email_subject" text NOT NULL,
	"email_content" text NOT NULL,
	"has_responded" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "requirement_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"section_number" varchar(10) NOT NULL,
	"section_title" text NOT NULL,
	"parent_section_id" integer,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "search_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"order_number" text NOT NULL,
	"product_name" text NOT NULL,
	"product_description" text NOT NULL,
	"quantity" integer,
	"budget" text,
	"timeline" text NOT NULL,
	"additional_requirements" text,
	"matched_suppliers" integer[],
	"use_db_search" boolean DEFAULT true,
	"use_api_search" boolean DEFAULT false,
	"status" text DEFAULT 'sent' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "search_requests_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "semantic_blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"block_title" text NOT NULL,
	"content_hash" text NOT NULL,
	"semantic_essence" jsonb NOT NULL,
	"token_count" integer NOT NULL,
	"processing_method" text NOT NULL,
	"order_index" integer NOT NULL,
	"search_vector" text,
	"optimized_requirements" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "staging_suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_engine" text NOT NULL,
	"search_query" text NOT NULL,
	"region" text,
	"raw_title" text,
	"raw_description" text,
	"raw_url" text NOT NULL,
	"raw_emails" text[],
	"raw_phones" text[],
	"status" text DEFAULT 'new',
	"matched_supplier_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"plan" text DEFAULT 'trial' NOT NULL,
	"requests_limit" integer DEFAULT 10,
	"requests_used" integer DEFAULT 0,
	"requests_rest" integer,
	"expiry_date" timestamp,
	"status" text DEFAULT 'active' NOT NULL,
	"start_date" timestamp DEFAULT now(),
	"end_date" timestamp,
	"max_requests" integer DEFAULT 10,
	"max_suppliers" integer DEFAULT -1,
	"manager_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "supplier_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer NOT NULL,
	"filename" text NOT NULL,
	"file_data" text NOT NULL,
	"mimetype" text NOT NULL,
	"file_size" integer NOT NULL,
	"upload_date" timestamp DEFAULT now(),
	"is_deleted" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "supplier_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"request_id" integer NOT NULL,
	"request_supplier_id" integer,
	"supplier_id" text NOT NULL,
	"supplier_name" text NOT NULL,
	"supplier_email" text NOT NULL,
	"response_date" timestamp DEFAULT now(),
	"subject" text NOT NULL,
	"content" text NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_read" boolean DEFAULT false,
	"is_replied_to" boolean DEFAULT false,
	"message_id" text,
	"is_favorite" boolean DEFAULT false,
	"is_analyzed" boolean DEFAULT false,
	"processing_status" text DEFAULT 'pending',
	"processing_started_at" timestamp,
	"processing_completed_at" timestamp,
	"processing_error" text
);
--> statement-breakpoint
CREATE TABLE "supplier_search_keywords" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer NOT NULL,
	"keyword" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"website" text NOT NULL,
	"email" text NOT NULL,
	"phone" varchar(20) NOT NULL,
	"categories" text[] NOT NULL,
	"response_rate" real,
	"total_requests" integer DEFAULT 0,
	"successful_matches" integer DEFAULT 0,
	"region" text,
	"last_response_time" timestamp,
	CONSTRAINT "suppliers_website_unique" UNIQUE("website")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"business_card" text,
	"logo_url" text,
	"role" text DEFAULT 'user' NOT NULL,
	"language" text DEFAULT 'ru' NOT NULL,
	"preferred_mode" text DEFAULT 'supplier_search',
	"onboarding_completed" boolean DEFAULT false,
	"reset_token" text,
	"reset_token_expiry" timestamp,
	"email_account" text,
	"email_password" text,
	"smtp_host" text DEFAULT 'smtp.mail.ru',
	"smtp_port" integer DEFAULT 587,
	"imap_host" text DEFAULT 'imap.mail.ru',
	"imap_port" integer DEFAULT 993,
	"email_configured" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"last_login" timestamp,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "winner_selections" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"winner_email" text NOT NULL,
	"winner_name" text NOT NULL,
	"selected_date" timestamp DEFAULT now(),
	"notification_sent" boolean DEFAULT false,
	"user_id" integer,
	"notification_subject" text,
	"notification_content" text,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analysis_extracted_requirements" ADD CONSTRAINT "analysis_extracted_requirements_project_id_analysis_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."analysis_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_extracted_requirements" ADD CONSTRAINT "analysis_extracted_requirements_section_id_requirement_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."requirement_sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_project_files" ADD CONSTRAINT "analysis_project_files_project_id_analysis_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."analysis_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_projects" ADD CONSTRAINT "analysis_projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_results" ADD CONSTRAINT "analysis_results_request_id_search_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."search_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_results" ADD CONSTRAINT "analysis_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_suppliers" ADD CONSTRAINT "analysis_suppliers_project_id_analysis_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."analysis_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_analysis" ADD CONSTRAINT "compliance_analysis_project_id_analysis_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."analysis_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_analysis" ADD CONSTRAINT "compliance_analysis_supplier_id_analysis_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."analysis_suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_groups" ADD CONSTRAINT "contact_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_items" ADD CONSTRAINT "contact_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_items" ADD CONSTRAINT "contact_items_group_id_contact_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."contact_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_requests" ADD CONSTRAINT "email_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_requests" ADD CONSTRAINT "email_requests_group_id_contact_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."contact_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_parameters" ADD CONSTRAINT "extracted_parameters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_parameters" ADD CONSTRAINT "extracted_parameters_response_id_supplier_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."supplier_responses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_parameters" ADD CONSTRAINT "extracted_parameters_request_id_search_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."search_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "improvement_requests" ADD CONSTRAINT "improvement_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "improvement_requests" ADD CONSTRAINT "improvement_requests_request_id_search_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."search_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_parameters" ADD CONSTRAINT "request_parameters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_parameters" ADD CONSTRAINT "request_parameters_request_id_search_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."search_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_supplier_groups" ADD CONSTRAINT "request_supplier_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_supplier_groups" ADD CONSTRAINT "request_supplier_groups_request_supplier_id_request_suppliers_id_fk" FOREIGN KEY ("request_supplier_id") REFERENCES "public"."request_suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_supplier_groups" ADD CONSTRAINT "request_supplier_groups_contact_group_id_contact_groups_id_fk" FOREIGN KEY ("contact_group_id") REFERENCES "public"."contact_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_supplier_messages" ADD CONSTRAINT "request_supplier_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_supplier_messages" ADD CONSTRAINT "request_supplier_messages_request_supplier_id_request_suppliers_id_fk" FOREIGN KEY ("request_supplier_id") REFERENCES "public"."request_suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_suppliers" ADD CONSTRAINT "request_suppliers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_suppliers" ADD CONSTRAINT "request_suppliers_request_id_search_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."search_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_sections" ADD CONSTRAINT "requirement_sections_project_id_analysis_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."analysis_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_sections" ADD CONSTRAINT "requirement_sections_parent_section_id_requirement_sections_id_fk" FOREIGN KEY ("parent_section_id") REFERENCES "public"."requirement_sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_requests" ADD CONSTRAINT "search_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "semantic_blocks" ADD CONSTRAINT "semantic_blocks_project_id_analysis_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."analysis_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staging_suppliers" ADD CONSTRAINT "staging_suppliers_matched_supplier_id_suppliers_id_fk" FOREIGN KEY ("matched_supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_manager_id_managers_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."managers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_files" ADD CONSTRAINT "supplier_files_supplier_id_analysis_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."analysis_suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_responses" ADD CONSTRAINT "supplier_responses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_responses" ADD CONSTRAINT "supplier_responses_request_id_search_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."search_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_responses" ADD CONSTRAINT "supplier_responses_request_supplier_id_request_suppliers_id_fk" FOREIGN KEY ("request_supplier_id") REFERENCES "public"."request_suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_search_keywords" ADD CONSTRAINT "supplier_search_keywords_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "winner_selections" ADD CONSTRAINT "winner_selections_request_id_search_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."search_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "winner_selections" ADD CONSTRAINT "winner_selections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_keyword_idx" ON "supplier_search_keywords" USING btree ("supplier_id","keyword");