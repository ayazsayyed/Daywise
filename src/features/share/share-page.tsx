import { CarFront, Phone } from "lucide-react";

import { cn } from "@/lib/utils";

import "./share.css";
import { DesktopIndex, MobileNav, type NavDay } from "./nav";
import { ContactTable, HotelPhoto, Photo, tenantStyle, WhatsAppButton, Wordmark } from "./parts";
import type { ShareDay, ShareView } from "./view";

/**
 * The client itinerary page (DESIGN.md Part 2 structure 1–9; PNG 23–26 mobile,
 * 29–34 desktop). The PDF prints this same page (`print`): print-only blocks
 * use `hidden print:block`, interactive ones carry `data-noprint`.
 */
export function SharePage({ view, print = false }: { view: ShareView; print?: boolean }) {
  const { agency } = view;
  const navDays: NavDay[] = view.days.map((d) => ({
    n: d.n,
    anchor: d.anchor,
    city: d.city,
    nightLine: d.nightLine,
    date: d.dateShort
      ? `${d.eyebrow.split(" · ")[1]?.slice(0, 3) ?? ""} ${d.dateShort}`.trim()
      : "",
  }));
  const nights = view.days.filter((d) => d.hotel);

  return (
    <div
      className="share-root bg-paper text-ink min-h-dvh pb-24 md:pb-0"
      style={tenantStyle(agency.accent)}
      data-print={print ? "1" : undefined}
    >
      {print ? <RunningFooter left={`${agency.name} · ${view.footerTitle}`} /> : null}

      {/* 1. Header */}
      <header className="share-header mx-auto max-w-[1104px] px-5 pt-5 md:px-8 md:pt-6">
        <div className="flex items-center justify-between gap-4 pb-4 md:pb-5">
          <Wordmark agency={agency} size={print ? 34 : 32} />
          <div className="flex items-center gap-5" data-noprint>
            {agency.phoneHref ? (
              <>
                <a
                  href={agency.phoneHref}
                  className="text-ink inline-flex h-9 items-center gap-1.5 text-[14px] font-medium md:hidden"
                >
                  <Phone className="size-4" aria-hidden />
                  Call
                </a>
                <a
                  href={agency.phoneHref}
                  className="text-ink hidden items-center gap-2 text-[13px] md:inline-flex"
                >
                  <Phone className="size-3.5" aria-hidden />
                  {agency.phone}
                </a>
              </>
            ) : null}
            <WhatsAppButton
              href={agency.whatsappHref}
              size="sm"
              className="hidden md:inline-flex"
            />
          </div>
          <div className="text-ink-secondary hidden text-[10.5pt] print:block">
            Itinerary · {view.printedOn}
          </div>
        </div>
        <hr className="border-tenant/70 border-t" />
      </header>

      <main className="share-main mx-auto max-w-[1104px] px-5 md:px-8">
        {/* 2. Cover */}
        <section className="share-cover pt-10 md:pt-14 print:pt-6">
          <div className="grid gap-6 md:grid-cols-[1fr_300px] md:gap-12 print:block">
            <div>
              {view.preparedFor ? (
                <p className="text-label text-ink-secondary mb-3">{view.preparedFor}</p>
              ) : null}
              <h1 className="text-ink text-[34px] leading-[38px] font-semibold tracking-[-0.026em] md:text-[52px] md:leading-[56px] print:text-[36pt] print:leading-[1.1]">
                {view.title}
              </h1>
              {view.meta ? (
                <p className="text-ink-secondary mt-3 text-[15px] leading-6 md:text-[17px]">
                  {view.meta}
                </p>
              ) : null}
            </div>
            {view.summary || view.route ? (
              <div className="hidden md:block print:hidden">
                {view.summary ? (
                  <p className="text-ink text-[15px] leading-6">{view.summary}</p>
                ) : null}
                {view.route ? (
                  <p className="text-ink-muted mt-3 text-[12px] leading-4">{view.route}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <Photo
            image={view.cover}
            ratio="cover"
            index={0}
            fallbackLabel={view.days[0]?.city ?? view.title}
            className="mt-8 md:mt-12 print:mt-6 [&>div]:print:aspect-[3/2]"
            eager
          />

          {/* Mobile: WhatsApp first, then the summary and route (PNG 23). */}
          <div className="mt-6 md:hidden print:hidden">
            <WhatsAppButton href={agency.whatsappHref} size="lg" className="w-full" />
            {agency.contactPerson || agency.phone ? (
              <p className="text-ink-muted mt-2 text-center text-[13px] leading-5">
                {[
                  agency.contactPerson,
                  agency.contacts.find((c) => c.label === "WhatsApp")?.value ?? agency.phone,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
          </div>

          <div className="mt-6 grid gap-6 md:hidden print:mt-6 print:grid print:grid-cols-2 print:gap-10">
            <div>
              {view.summary ? (
                <p className="text-ink text-[15px] leading-6 print:text-[11pt]">{view.summary}</p>
              ) : null}
              {view.route ? (
                <p className="text-ink-muted mt-3 text-[13px] leading-5 print:text-[10pt]">
                  {view.route}
                </p>
              ) : null}
            </div>
            {nights.length ? (
              <div>
                <h2 className="text-label text-ink-muted border-line border-b pb-2">
                  Where you stay
                </h2>
                <ul>
                  {nights.map((d, i) => (
                    <li
                      key={d.n}
                      className="border-line grid grid-cols-[64px_1fr] border-b py-2 text-[14px] leading-5 print:text-[10.5pt]"
                    >
                      <span className="text-ink-muted">Night {i + 1}</span>
                      <span className="text-ink">
                        {d.hotel!.name}
                        {d.city ? `, ${d.city}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {/* Print-only contact strip at the foot of the cover (PNG 35). */}
          <div className="border-line mt-8 hidden border-t pt-4 text-[10pt] leading-5 print:flex print:justify-between">
            <div>
              <div className="text-ink-muted">
                Questions or changes
                {agency.contactPerson ? `: ${agency.contactPerson}` : `: ${agency.name}`}
              </div>
              <div className="text-ink">
                {[
                  agency.contacts.find((c) => c.label === "WhatsApp")?.value &&
                    `WhatsApp ${agency.contacts.find((c) => c.label === "WhatsApp")!.value}`,
                  agency.phone && `Phone ${agency.phone}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            <div className="text-ink-secondary text-right">
              {agency.email ? <div>{agency.email}</div> : null}
              {agency.website ? <div>{agency.website}</div> : null}
            </div>
          </div>
        </section>

        {/* 3. Day index (mobile/tablet) */}
        <div className="mt-10 min-[1100px]:mt-0 md:mt-14" data-noprint>
          <MobileNav
            days={navDays}
            countWord={view.countWord}
            dateLine={[view.dateRange, view.nightsLabel].filter(Boolean).join(" · ")}
            hasPrice={!!view.price}
            agencyName={agency.name}
            bar={view.price?.bar ?? null}
            whatsappHref={agency.whatsappHref}
          />
        </div>

        <div className="min-[1100px]:mt-16 min-[1100px]:grid min-[1100px]:grid-cols-[254px_minmax(0,1fr)] min-[1100px]:gap-x-[66px] print:block">
          <DesktopIndex days={navDays} countWord={view.countWord} hasPrice={!!view.price} />

          <div className="mx-auto w-full max-w-[720px] min-[1100px]:max-w-none print:max-w-none">
            {/* 4. Days */}
            {view.days.map((d, i) => (
              <DaySection key={d.n} day={d} first={i === 0} print={print} />
            ))}

            {/* 5 + 6. Price, inclusions, terms */}
            <section
              id="price-and-terms"
              className="share-terms border-line mt-16 border-t pt-8 md:mt-24 print:mt-0 print:border-0"
            >
              <h2 className="text-ink mb-6 hidden text-[22pt] leading-tight font-semibold print:block">
                {view.price ? "Price and terms" : "Inclusions and terms"}
              </h2>
              {view.price ? <PriceBlock price={view.price} /> : null}
              <Sections view={view} priced={!!view.price} />
            </section>
          </div>
        </div>

        {/* 7. Footer */}
        <Footer view={view} />
      </main>
    </div>
  );
}

function DaySection({ day, first, print }: { day: ShareDay; first: boolean; print: boolean }) {
  return (
    <section
      id={day.anchor}
      data-day={day.n}
      className={cn(
        "share-day border-line border-t pt-8",
        first ? "mt-2 min-[1100px]:mt-0" : "mt-16 md:mt-24",
      )}
    >
      <div className="share-day-head">
        <div className="flex items-baseline gap-3">
          <span className="text-tenant tnum text-[28px] leading-8 font-semibold md:text-[24px] print:text-[22pt]">
            {String(day.n).padStart(2, "0")}
          </span>
          <span className="text-label text-ink-secondary">
            <span className="print:hidden">{day.eyebrow}</span>
            <span className="hidden print:inline">{day.eyebrowPrint}</span>
          </span>
        </div>
        <h2 className="text-ink mt-1.5 text-[22px] leading-7 font-semibold tracking-[-0.012em] md:text-[28px] md:leading-[34px] print:text-[18pt] print:leading-tight">
          {day.title}
        </h2>
      </div>

      <Photo
        image={day.hero}
        ratio="3:2"
        index={day.n}
        fallbackLabel={day.city || day.title}
        className="share-day-hero mt-5 md:mt-6"
        eager={print}
      />

      {day.transport ? (
        <p className="text-ink-secondary mt-5 flex items-start gap-2 text-[13px] leading-5 print:text-[10pt]">
          <CarFront className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {day.transport}
        </p>
      ) : null}

      {day.stops.length ? (
        <ol className="border-line mt-4 border-t">
          {day.stops.map((s, i) => (
            <li
              key={i}
              className="share-stop border-line grid grid-cols-[76px_1fr] gap-x-3 border-b py-4 md:grid-cols-[72px_1fr] print:grid-cols-[22mm_1fr] print:py-2.5"
            >
              <span className="text-ink-muted tnum pt-px text-[13px] leading-5 print:text-[10.5pt]">
                {s.time}
              </span>
              <div className="min-w-0">
                <div className="text-ink text-[15px] leading-5 font-semibold print:text-[11pt]">
                  {s.title}
                </div>
                {s.line ? (
                  <p className="share-stop-line text-ink-secondary mt-0.5 text-[15px] leading-[25px]">
                    {s.line}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {day.hotel ? (
        <div className="share-hotel border-line bg-surface-sunken/60 mt-5 rounded-lg border p-3 md:p-3.5 print:bg-white">
          <div className="grid grid-cols-[112px_1fr] gap-x-4 md:grid-cols-[196px_1fr] md:gap-x-5 print:grid-cols-[48mm_1fr]">
            <HotelPhoto image={day.hotel.image} name={day.hotel.name} />
            <div className="min-w-0 py-0.5">
              <div className="text-label text-ink-secondary">{day.hotel.eyebrow}</div>
              <h3 className="text-ink mt-1 text-[18px] leading-6 font-semibold print:text-[13pt]">
                {day.hotel.name}
              </h3>
              {day.hotel.area ? (
                <p className="text-ink-secondary text-[13px] leading-5 print:text-[10pt]">
                  {day.hotel.area}
                </p>
              ) : null}
              <HotelRows rows={day.hotel.rows} className="mt-3 hidden md:grid print:grid" />
            </div>
          </div>
          <HotelRows rows={day.hotel.rows} className="mt-3 md:hidden print:hidden" />
        </div>
      ) : (
        <p className="border-line text-ink-secondary mt-5 border-y py-3 text-[13px] leading-5">
          Departure day · no hotel
        </p>
      )}
    </section>
  );
}

function HotelRows({
  rows,
  className,
}: {
  rows: { label: string; value: string }[];
  className?: string;
}) {
  if (!rows.length) return null;
  return (
    <dl
      className={cn(
        "border-line grid grid-cols-[82px_1fr] gap-x-3 gap-y-1.5 border-t pt-3 text-[14px] leading-5 print:text-[10.5pt]",
        className,
      )}
    >
      {rows.map((r) => (
        <div key={r.label} className="contents">
          <dt className="text-ink-muted">{r.label}</dt>
          <dd className="text-ink">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function PriceBlock({ price }: { price: NonNullable<ShareView["price"]> }) {
  return (
    <div className="share-price border-line grid gap-6 border-b pb-8 md:grid-cols-2 md:gap-10 print:grid-cols-2 print:pb-5">
      <div>
        <div className="text-label text-ink-secondary">Price</div>
        <div className="text-ink tnum mt-2 text-[32px] leading-9 font-semibold print:text-[24pt]">
          {price.amount}
        </div>
        <div className="text-ink-secondary mt-1 text-[15px] leading-6">{price.unitLine}</div>
        {!price.total && price.taxNote ? (
          <p className="share-caption text-ink-muted border-line mt-3 border-t pt-3 text-[12px] leading-4">
            {price.taxNote}
          </p>
        ) : null}
      </div>
      {price.total ? (
        <div className="md:pt-1">
          <dl className="text-[14px] leading-5">
            {price.lines.map((l) => (
              <div key={l.label} className="border-line flex justify-between gap-4 border-b py-2">
                <dt className="text-ink-secondary">{l.label}</dt>
                <dd className="text-ink tnum">{l.amount}</dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-4 pt-3">
              <dt className="text-ink text-[15px] font-semibold">{price.totalLabel}</dt>
              <dd className="text-ink tnum text-[20px] leading-7 font-semibold">{price.total}</dd>
            </div>
          </dl>
          {price.taxNote ? (
            <p className="share-caption text-ink-muted mt-1 text-[12px] leading-4">
              {price.taxNote}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Sections({ view, priced }: { view: ShareView; priced: boolean }) {
  const { included, excluded, payment, cancellation } = view.sections;
  const hasLists = included.length || excluded.length;
  const hasTerms = payment || cancellation;
  if (!hasLists && !hasTerms) return null;
  return (
    <div className={cn("share-sections", priced && "pt-8 print:pt-5")}>
      {hasLists ? (
        <div className="grid gap-8 md:grid-cols-2 md:gap-10 print:grid-cols-2">
          <List title="Included" items={included} />
          <List title="Not included" items={excluded} />
        </div>
      ) : null}
      {hasTerms ? (
        <div
          className={cn(
            "grid gap-8 md:grid-cols-2 md:gap-10 print:grid-cols-2",
            hasLists && "border-line mt-8 border-t pt-6 md:border-0 md:pt-2 print:mt-6",
          )}
        >
          {payment ? (
            <div>
              <h3 className="text-label text-ink-secondary">Payment</h3>
              <p className="text-ink mt-2 text-[15px] leading-6 whitespace-pre-line">{payment}</p>
            </div>
          ) : null}
          {cancellation ? (
            <div>
              <h3 className="text-label text-ink-secondary">Cancellation</h3>
              <p className="text-ink mt-2 text-[15px] leading-6 whitespace-pre-line">
                {cancellation}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return <div />;
  return (
    <div>
      <h3 className="text-label text-ink-secondary">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.map((it, i) => (
          <li key={i} className="text-ink flex gap-2.5 text-[15px] leading-6">
            <span className="text-ink-muted select-none" aria-hidden>
              •
            </span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Footer({ view }: { view: ShareView }) {
  const { agency } = view;
  return (
    <footer id="contact" className="share-footer mt-16 pb-10 md:mt-24 print:pb-0">
      <hr className="border-tenant/70 border-t" />
      <div className="grid gap-8 pt-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] md:gap-12 print:grid-cols-[1fr_1.7fr]">
        <div>
          <Wordmark agency={agency} />
          {agency.footer ? (
            <p className="text-ink-secondary mt-3 max-w-[340px] text-[13px] leading-5 print:text-[10pt]">
              {agency.footer}
            </p>
          ) : null}
          <WhatsAppButton
            href={agency.whatsappHref}
            size="sm"
            className="mt-4 hidden md:inline-flex"
          />
        </div>
        <div className="share-contacts">
          <ContactTable agency={agency} />
        </div>
      </div>
      <div className="border-line text-ink-muted share-caption mt-8 space-y-1 border-t pt-4 text-[12px] leading-4">
        <p>
          Hotels are subject to availability at the time of booking · Last updated{" "}
          {view.lastUpdated}
        </p>
        {view.credits ? <p>{view.credits}</p> : null}
      </div>
    </footer>
  );
}

/** Running footer on every page after the cover: margin boxes, tenant text escaped. */
function RunningFooter({ left }: { left: string }) {
  const css = JSON.stringify(left);
  return (
    <style
      // Strings are JSON-escaped (quotes, backslashes, newlines); `<` cannot close the tag.
      dangerouslySetInnerHTML={{
        __html: `@page{@bottom-left{content:${css.replace(/</g, "\\3c ")};font:9pt Inter,sans-serif;color:#5e5b55;border-top:1px solid #e2ded6;vertical-align:middle}@bottom-right{content:"Page " counter(page) " of " counter(pages);font:9pt Inter,sans-serif;color:#5e5b55;border-top:1px solid #e2ded6;vertical-align:middle}}@page:first{@bottom-left{content:none;border:0}@bottom-right{content:none;border:0}}`,
      }}
    />
  );
}
