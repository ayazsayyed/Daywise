import "./share.css";
import { RetryButton } from "./nav";
import { ContactTable, tenantStyle, WhatsAppButton, Wordmark } from "./parts";
import type { ShareAgency } from "./view";

/**
 * PNG 27 (disabled) and PNG 28 (unavailable). Both carry the agency header,
 * never Daywise. When even the agency is unknown (bad token, database down
 * before the tenant loads) the page shows neutral copy with no brand at all.
 */
function Shell({
  agency,
  children,
  foot,
}: {
  agency: ShareAgency | null;
  children: React.ReactNode;
  foot?: React.ReactNode;
}) {
  return (
    <div
      className="share-root bg-paper text-ink flex min-h-dvh flex-col"
      style={agency ? tenantStyle(agency.accent) : undefined}
    >
      <header className="mx-auto w-full max-w-[560px] px-5 pt-6">
        {agency ? <Wordmark agency={agency} /> : null}
      </header>
      <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col justify-center px-5 py-16">
        <hr className="border-tenant mb-6 w-14 border-t" />
        {children}
      </main>
      {foot ? <footer className="mx-auto w-full max-w-[560px] px-5 pb-8">{foot}</footer> : null}
    </div>
  );
}

export function DisabledState({ agency }: { agency: ShareAgency | null }) {
  return (
    <Shell
      agency={agency}
      foot={
        agency?.contacts.length ? (
          <div className="border-line border-t pt-6">
            <ContactTable
              agency={{
                ...agency,
                contacts: agency.contacts.filter((c) =>
                  ["Phone", "WhatsApp", "Email", "Office"].includes(c.label),
                ),
              }}
            />
          </div>
        ) : null
      }
    >
      <h1 className="text-ink text-[34px] leading-[38px] font-semibold tracking-[-0.022em]">
        This itinerary is no longer available
      </h1>
      <p className="text-ink-secondary mt-4 text-[17px] leading-7">
        The plan may have been updated or replaced.{" "}
        {agency
          ? `${agency.name} can send you the latest version.`
          : "Please ask your travel agent for the latest version."}
      </p>
      {agency?.whatsappHref ? (
        <WhatsAppButton
          href={agency.whatsappHref}
          label="Ask on WhatsApp"
          size="lg"
          className="mt-8 w-full"
        />
      ) : null}
    </Shell>
  );
}

export function UnavailableState({ agency }: { agency: ShareAgency | null }) {
  return (
    <Shell
      agency={agency}
      foot={
        agency?.phone ? (
          <div className="border-line border-t pt-6">
            <p className="text-ink-secondary text-[14px] leading-5">
              Need it sooner? Call {agency.name}
            </p>
            <a
              href={agency.phoneHref ?? undefined}
              className="text-tenant mt-1 block text-[18px] leading-7 font-medium"
            >
              {agency.phone}
            </a>
          </div>
        ) : null
      }
    >
      <h1 className="text-ink text-[34px] leading-[38px] font-semibold tracking-[-0.022em]">
        Your itinerary can&rsquo;t be shown right now
      </h1>
      <p className="text-ink-secondary mt-4 text-[17px] leading-7">
        This is temporary and your plan is safe. Please try again in a few minutes.
      </p>
      <div className="mt-8">
        <RetryButton />
      </div>
    </Shell>
  );
}
