ALTER TYPE "public"."tenant_status" ADD VALUE 'trial' BEFORE 'active';--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "monthly_pdf_cap" integer DEFAULT 200 NOT NULL;--> statement-breakpoint
UPDATE "tenants" SET "branding" = '{"website":"","gstin":"","licence_no":""}'::jsonb || "branding";
