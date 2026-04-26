ALTER TABLE "auth_runs" ADD COLUMN "final_letter" text;--> statement-breakpoint
ALTER TABLE "auth_runs" ADD COLUMN "final_verdict" jsonb;--> statement-breakpoint
CREATE INDEX "auth_runs_prior_auth_started_idx" ON "auth_runs" USING btree ("prior_auth_id","started_at" DESC NULLS LAST);