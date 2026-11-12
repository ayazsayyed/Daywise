import type { Metadata } from "next";
import Link from "next/link";

import { PRODUCT_NAME } from "@/lib/config/brand";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: `Privacy · ${PRODUCT_NAME}` };

const UPDATED = "12 Nov 2026";

/**
 * Privacy policy (Day 5 brief 6; PRD: client PII under the DPDP Act 2023).
 * Plain statements of what the code actually does — keep in sync when data
 * handling changes. Needs a lawyer's read before it is called final.
 */
export default function PrivacyPage() {
  const support = env.SUPPORT_EMAIL;
  return (
    <main className="px-4 pt-10 pb-24 sm:px-8 lg:pt-16 xl:px-24">
      <article className="flex max-w-[720px] flex-col gap-8">
        <header className="flex flex-col gap-2">
          <Link href="/" className="text-heading-2 text-ink">
            {PRODUCT_NAME}
          </Link>
          <h1 className="text-display-2 text-ink mt-6">Privacy policy</h1>
          <p className="text-body-sm text-ink-muted">Last updated {UPDATED}</p>
        </header>

        <S title="Who this covers">
          <p>
            {PRODUCT_NAME} is software that travel agencies use to draft and share itineraries.
            Agencies are our customers. Their clients (the travellers) see itineraries through links
            and PDFs the agency sends. For travellers&apos; details the agency decides what is
            entered and why; {PRODUCT_NAME} processes that data on the agency&apos;s behalf, as a
            data processor under India&apos;s Digital Personal Data Protection Act, 2023.
          </p>
        </S>

        <S title="What we store">
          <ul>
            <li>
              <b>Agency account:</b> agency name, contact details, logo and branding, and the email
              address used to sign in.
            </li>
            <li>
              <b>Itineraries:</b> trip requests, days, places, hotels, prices the agent typed, and
              the traveller details the agent enters (name, phone, email, city, number of
              travellers).
            </li>
            <li>
              <b>Link views:</b> when a shared link is opened we record the time and whether it was
              a phone or a computer. To count a device once per hour we keep a salted one-way hash
              of its IP address and browser; the IP address itself is never stored, and these rows
              are deleted within hours.
            </li>
            <li>
              <b>Activity log:</b> sign-ins and important changes (share links turned on or off,
              deletions, account changes), with the user who made them.
            </li>
            <li>
              <b>Usage counts:</b> how many drafts, AI calls, place lookups and PDFs an agency uses
              each month, for limits and billing.
            </li>
          </ul>
          <p>
            Photos of places are not stored. They are fetched from Google when an itinerary is
            viewed, with the photographer credited. PDFs are generated on request and deleted after
            download.
          </p>
        </S>

        <S title="Cookies">
          <p>
            One cookie: a sign-in session for agency users (HTTP-only, secure, 30 days). Travellers
            opening a shared link get no cookies. There is no advertising or analytics tracking.
          </p>
        </S>

        <S title="Who else processes data">
          <ul>
            <li>
              <b>AI drafting</b> (Groq, Google Gemini): the trip request and brief. Traveller names,
              phone numbers and emails are not sent.
            </li>
            <li>
              <b>Google Maps Platform</b>: place and hotel names, to verify them and fetch photos.
            </li>
            <li>
              <b>Resend</b>: the agency user&apos;s email address, to send sign-in links.
            </li>
            <li>
              <b>Cloudflare R2</b>: logos and encrypted-in-transit nightly database backups.
            </li>
            <li>
              <b>Sentry</b>: error reports, which can include the page address and technical details
              of the failure.
            </li>
            <li>
              <b>Hostinger</b>: the server in Mumbai that runs {PRODUCT_NAME} and its database.
            </li>
          </ul>
        </S>

        <S title="How long we keep it">
          <p>
            Agency data is kept while the account is active. Nightly backups are kept for 14 days.
            If an account is suspended, its shared links stay readable for 30 days and then stop
            working; the data stays until the agency asks for deletion. Sign-in links expire after
            15 minutes.
          </p>
        </S>

        <S title="Your choices">
          <p>
            Agencies can download all of their data from Settings → Your data at any time, and can
            ask us to delete their account; deletion removes itineraries, links, logins, usage
            records and logos, and backups containing them expire within 14 days. Travellers who
            want their details corrected or removed should contact the agency that sent the
            itinerary, or write to us and we will pass the request on.
          </p>
        </S>

        <S title="Contact">
          <p>
            Questions or requests:{" "}
            <a href={`mailto:${support}`} className="text-ink underline underline-offset-4">
              {support}
            </a>
            .
          </p>
        </S>
      </article>
    </main>
  );
}

function S({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="text-body text-ink-secondary [&_b]:text-ink flex flex-col gap-3 [&_b]:font-medium [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5">
      <h2 className="text-heading-2 text-ink">{title}</h2>
      {children}
    </section>
  );
}
