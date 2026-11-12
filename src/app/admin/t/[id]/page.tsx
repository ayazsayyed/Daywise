import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { Page, PageTitle, StatusDot } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { loginAsTenant, unsuspendTenant } from "@/features/admin/actions";
import { loadTenantDetail } from "@/features/admin/data";
import { CnameChecker, DeleteTenant, TenantSettingsForm } from "@/features/admin/tenant-detail";
import { tenantSubdomain } from "@/lib/config/brand";
import { SUSPENDED_GRACE_DAYS } from "@/lib/db/share";
import { formatDate, formatMonthYear, formatNumber, formatTime } from "@/lib/format";

export const metadata: Metadata = { title: "Tenant · Admin" };
export const dynamic = "force-dynamic";

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const d = await loadTenantDetail(id);
  if (!d) notFound();
  const { tenant: t, usage } = d;
  const suspended = t.status === "suspended";
  const graceEnds =
    suspended && t.suspendedAt
      ? new Date(t.suspendedAt.getTime() + SUSPENDED_GRACE_DAYS * 86_400_000)
      : null;

  return (
    <Page>
      <div className="max-w-[880px]">
        <Link href="/admin" className="text-body-sm text-ink-secondary hover:text-ink">
          ← Tenants
        </Link>
        <PageTitle
          className="mt-4"
          title={t.name}
          subtitle={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <StatusDot kind="tenant" status={t.status} />
              <span>·</span>
              <span>{tenantSubdomain(t.slug)}</span>
              {t.customDomain && (
                <>
                  <span>·</span>
                  <span>{t.customDomain}</span>
                </>
              )}
              <span>·</span>
              <span>since {formatDate(t.createdAt)}</span>
            </span>
          }
        />
        {suspended && (
          <p className="text-body-sm text-ink-secondary mt-4">
            Suspended {t.suspendedAt ? formatDate(t.suspendedAt) : ""}. Shared links stay readable
            until {graceEnds ? formatDate(graceEnds) : "the grace period ends"}, then show the
            unavailable page.
          </p>
        )}

        <Section title="Usage" description={`${formatMonthYear()} so far, IST.`}>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
            <Stat
              label="AI calls"
              value={`${formatNumber(usage.ai)} of ${formatNumber(t.monthlyAiCap)}`}
            />
            <Stat label="AI tokens" value={formatNumber(usage.tokens)} />
            <Stat
              label="Drafts today"
              value={`${formatNumber(d.generationsToday)} of ${formatNumber(t.dailyGenCap)}`}
            />
            <Stat label="Places searches" value={formatNumber(usage.placesSearch)} />
            <Stat
              label="PDFs"
              value={`${formatNumber(usage.pdf)} of ${formatNumber(t.monthlyPdfCap)}`}
            />
            <Stat label="Itineraries" value={formatNumber(d.itineraries)} />
          </dl>
          <p className="text-caption text-ink-muted">
            Places photos go through the shared photo proxy and are counted for all tenants together
            on the Tenants page.
          </p>
        </Section>

        <Section title="Limits and domain" description="Checked when a draft is queued.">
          <TenantSettingsForm
            tenantId={t.id}
            initial={{
              plan: t.plan,
              customDomain: t.customDomain ?? "",
              dailyGenCap: t.dailyGenCap,
              monthlyAiCap: t.monthlyAiCap,
              monthlyPdfCap: t.monthlyPdfCap,
            }}
          />
        </Section>

        <Section
          title="Custom domain DNS"
          description={
            t.customDomain
              ? `${t.customDomain} should CNAME to ${tenantSubdomain(t.slug)}.`
              : "Set a custom domain above first."
          }
        >
          <CnameChecker tenantId={t.id} hasDomain={Boolean(t.customDomain)} />
        </Section>

        <Section title="Access" description="Logins and support access.">
          <ul className="text-body-sm text-ink-secondary flex flex-col gap-1">
            {d.users.map((u) => (
              <li key={u.email}>
                <span className="text-ink">{u.email}</span> · {u.role}
              </li>
            ))}
            {d.users.length === 0 && <li>No logins.</li>}
          </ul>
          <div className="flex flex-wrap gap-3">
            <form action={loginAsTenant.bind(null, t.id)}>
              <Button variant="secondary" type="submit">
                Open as {t.name}
              </Button>
            </form>
            {suspended && (
              <form
                action={async () => {
                  "use server";
                  await unsuspendTenant(t.id);
                }}
              >
                <Button variant="secondary" type="submit">
                  Reactivate
                </Button>
              </form>
            )}
          </div>
          <p className="text-caption text-ink-muted">
            Opening as the agency is recorded in its activity log.
          </p>
        </Section>

        <Section title="Activity" description="Last 20 entries of the audit log.">
          {d.audit.length === 0 ? (
            <p className="text-body-sm text-ink-muted">Nothing recorded yet.</p>
          ) : (
            <ol className="flex flex-col">
              {d.audit.map((a) => (
                <li
                  key={a.id}
                  className="border-line text-body-sm grid grid-cols-[140px_1fr] gap-4 border-b py-2"
                >
                  <span className="text-ink-muted tnum">
                    {formatDate(a.createdAt)} {formatTime(a.createdAt)}
                  </span>
                  <span className="text-ink-secondary">
                    <span className="text-ink">{a.action}</span>
                    {a.email ? ` · ${a.email}` : ""}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Section>

        <Section title="Data" description="Export, or remove the agency.">
          <div>
            <Button variant="secondary" asChild>
              <a href={`/admin/t/${t.id}/export`} download>
                Download data (.zip)
              </a>
            </Button>
          </div>
          <DeleteTenant tenantId={t.id} name={t.name} />
        </Section>
      </div>
    </Page>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="border-line grid gap-6 border-t py-8 first-of-type:mt-8 lg:grid-cols-[200px_minmax(0,1fr)] lg:py-10"
    >
      <div className="flex min-w-0 flex-col gap-1 pr-6">
        <h2 className="text-heading-3 text-ink">{title}</h2>
        <p className="text-body-sm text-ink-secondary break-words">{description}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-label text-ink-secondary">{label}</dt>
      <dd className="text-numeric text-ink">{value}</dd>
    </div>
  );
}
