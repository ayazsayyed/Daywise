ALTER TABLE "pdf_jobs" ALTER COLUMN "itinerary_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "itineraries" ADD COLUMN "cover" jsonb;--> statement-breakpoint
ALTER TABLE "pdf_jobs" ADD COLUMN "preview" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "pdf_style" text DEFAULT 'editorial' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "accent_color" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "title_font" text DEFAULT 'inter' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "cover_backdrop_key" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "cover_backdrop_meta" jsonb;