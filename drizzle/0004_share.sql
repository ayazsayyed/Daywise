CREATE TABLE "share_views" (
	"link_id" uuid NOT NULL,
	"visitor" text NOT NULL,
	"hour" timestamp with time zone NOT NULL,
	CONSTRAINT "share_views_link_id_visitor_hour_pk" PRIMARY KEY("link_id","visitor","hour")
);
--> statement-breakpoint
ALTER TABLE "share_links" ADD COLUMN "last_viewed_device" text;--> statement-breakpoint
ALTER TABLE "share_views" ADD CONSTRAINT "share_views_link_id_share_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."share_links"("id") ON DELETE cascade ON UPDATE no action;