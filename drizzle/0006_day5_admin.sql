ALTER TABLE "sessions" ADD COLUMN "acting_tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "monthly_ai_cap" integer DEFAULT 600 NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_acting_tenant_id_tenants_id_fk" FOREIGN KEY ("acting_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;