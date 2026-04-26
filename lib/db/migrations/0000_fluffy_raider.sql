CREATE TABLE "auth_run_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" text NOT NULL,
	"subagent" text NOT NULL,
	"status" text NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"model" text,
	"latency_ms" integer,
	"input_tokens" integer,
	"output_tokens" integer,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"prior_auth_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"verdict" text,
	"confidence" numeric(4, 3),
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"total_tokens" integer DEFAULT 0,
	"total_cost_cents" numeric(10, 4) DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "eval_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"eval_run_id" uuid NOT NULL,
	"case_id" text NOT NULL,
	"expected_verdict" text NOT NULL,
	"actual_verdict" text,
	"correct" boolean,
	"groundedness_score" numeric(4, 3),
	"draft_score" numeric(4, 3),
	"calibration_bucket" text,
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eval_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"summary" jsonb
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" text PRIMARY KEY NOT NULL,
	"mrn" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"dob" text NOT NULL,
	"sex" text NOT NULL,
	"plan_id" text NOT NULL,
	"plan_name" text NOT NULL,
	"payer_id" text NOT NULL,
	"dx_codes" text[] DEFAULT '{}' NOT NULL,
	"phone" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "patients_mrn_unique" UNIQUE("mrn")
);
--> statement-breakpoint
CREATE TABLE "policies" (
	"id" text PRIMARY KEY NOT NULL,
	"payer_id" text NOT NULL,
	"name" text NOT NULL,
	"cpb_number" text,
	"last_updated" text,
	"source_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" text NOT NULL,
	"page_number" integer,
	"section_number" integer,
	"section_title" text,
	"text" text NOT NULL,
	"embedding" vector(1536),
	"metadata" jsonb,
	"cpt_codes" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prior_auths" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"cpt_code" text NOT NULL,
	"dx_codes" text[] DEFAULT '{}' NOT NULL,
	"status" text NOT NULL,
	"payer_id" text NOT NULL,
	"plan_name" text NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" text PRIMARY KEY NOT NULL,
	"npi" text NOT NULL,
	"name" text NOT NULL,
	"specialty" text NOT NULL,
	"organization" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "providers_npi_unique" UNIQUE("npi")
);
--> statement-breakpoint
ALTER TABLE "auth_run_events" ADD CONSTRAINT "auth_run_events_run_id_auth_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."auth_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_runs" ADD CONSTRAINT "auth_runs_prior_auth_id_prior_auths_id_fk" FOREIGN KEY ("prior_auth_id") REFERENCES "public"."prior_auths"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_results" ADD CONSTRAINT "eval_results_eval_run_id_eval_runs_id_fk" FOREIGN KEY ("eval_run_id") REFERENCES "public"."eval_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_chunks" ADD CONSTRAINT "policy_chunks_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prior_auths" ADD CONSTRAINT "prior_auths_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prior_auths" ADD CONSTRAINT "prior_auths_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;