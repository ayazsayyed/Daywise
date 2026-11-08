import type { Metadata } from "next";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { db, schema } from "@/lib/db";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const tenants = await db.select().from(schema.tenants).orderBy(schema.tenants.createdAt);

  return (
    <>
      <PageHeader
        title="Super-admin"
        description="Tenant management, plans, usage and suspension arrive on Day 5. Read-only for now."
      />
      <div className="bg-card overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-muted-foreground text-left text-xs tracking-wide uppercase">
            <tr>
              <th className="px-5 py-3 font-medium">Tenant</th>
              <th className="px-5 py-3 font-medium">Slug</th>
              <th className="px-5 py-3 font-medium">Domain</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tenants.length === 0 && (
              <tr>
                <td colSpan={4} className="text-muted-foreground px-5 py-10 text-center">
                  No tenants yet. Run{" "}
                  <code className="bg-secondary rounded px-1.5 py-0.5">pnpm db:seed</code>.
                </td>
              </tr>
            )}
            {tenants.map((t) => (
              <tr key={t.id}>
                <td className="px-5 py-3 font-medium">{t.name}</td>
                <td className="text-muted-foreground px-5 py-3">{t.slug}</td>
                <td className="text-muted-foreground px-5 py-3">{t.customDomain ?? "—"}</td>
                <td className="px-5 py-3">
                  <Badge variant={t.status === "active" ? "secondary" : "destructive"}>
                    {t.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
