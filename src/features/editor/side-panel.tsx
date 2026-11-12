"use client";

import { useState } from "react";

import { SegmentedControl, Switch } from "@/components/ds";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialsOf } from "@/lib/config/brand";
import { formatINR } from "@/lib/format";
import type { EditorClient, EditorDoc, EditorOp, EditorSections } from "@/lib/itinerary/doc";
import { computePricing, parseRupees, type Pricing } from "@/lib/itinerary/pricing";

/**
 * Right panel (PNG 11), raised, 320px on desktop; "Details and price" tab on
 * phones (PNG 19). Client, dates and travellers, pricing, then the four
 * sections prefilled from the agency defaults.
 */
export function SidePanel({
  doc,
  dispatch,
  defaults,
}: {
  doc: EditorDoc;
  dispatch: (op: EditorOp) => void;
  defaults: EditorSections;
}) {
  const client = doc.client!;
  const setClient = (patch: Partial<EditorClient>) =>
    dispatch({ op: "client.set", client: { ...client, ...patch } });

  return (
    <div className="flex flex-col">
      <ClientBlock client={client} onChange={setClient} />
      <DatesTravellers doc={doc} client={client} dispatch={dispatch} setClient={setClient} />
      <PricingBlock
        pricing={doc.pricing}
        pax={client.pax}
        onChange={(pricing) => dispatch({ op: "pricing.set", pricing })}
      />
      {(
        [
          ["inclusions", "Inclusions", "list"],
          ["exclusions", "Exclusions", "list"],
          ["payment_terms", "Payment terms", "text"],
          ["cancellation", "Cancellation", "text"],
        ] as const
      ).map(([key, title, kind]) => (
        <SectionBlock
          key={key}
          title={title}
          kind={kind}
          value={doc.sections[key]}
          fromDefaults={doc.sections[key].trim() === defaults[key].trim() && !!defaults[key].trim()}
          onChange={(v) =>
            dispatch({ op: "sections.set", sections: { ...doc.sections, [key]: v } })
          }
        />
      ))}
    </div>
  );
}

function Block({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-line flex flex-col gap-4 border-b px-4 py-5 lg:px-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-heading-3 text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function EditToggle({ editing, onClick }: { editing: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={editing}
      className="focus-ring text-body-sm text-ink rounded-sm font-medium"
    >
      {editing ? "Done" : "Edit"}
    </button>
  );
}

function ClientBlock({
  client,
  onChange,
}: {
  client: EditorClient;
  onChange: (patch: Partial<EditorClient>) => void;
}) {
  const [editing, setEditing] = useState(!client.name);
  const rows: [string, string | undefined][] = [
    ["Phone", client.phone],
    ["Email", client.email],
    ["City", client.city],
  ];
  return (
    <Block
      title="Client"
      action={<EditToggle editing={editing} onClick={() => setEditing((e) => !e)} />}
    >
      {editing ? (
        <div className="flex flex-col gap-3">
          {(
            [
              ["name", "Name", "Ananya & Rohit Kapoor", 120],
              ["phone", "Phone", "+91 98200 41736", 40],
              ["email", "Email", "name@example.com", 160],
              ["city", "City", "Mumbai", 80],
              ["referred_by", "Referred by", "Optional", 120],
            ] as const
          ).map(([key, label, ph, max]) => (
            <div key={key} className="flex flex-col gap-1.5">
              <Label htmlFor={`client-${key}`}>{label}</Label>
              <Input
                id={`client-${key}`}
                value={client[key] ?? ""}
                placeholder={ph}
                maxLength={max}
                type={key === "email" ? "email" : key === "phone" ? "tel" : "text"}
                onChange={(e) => onChange({ [key]: e.target.value })}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="border-line bg-surface-sunken text-ink grid size-8 shrink-0 place-items-center rounded-full border text-[12px] font-semibold">
              {initialsOf(client.name || "?")}
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-heading-3 text-ink truncate">{client.name}</span>
              {client.referred_by && (
                <span className="text-caption text-ink-muted truncate">
                  Referred by {client.referred_by}
                </span>
              )}
            </div>
          </div>
          <dl className="grid grid-cols-[64px_1fr] gap-x-4 gap-y-1.5">
            {rows
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-body-sm text-ink-secondary">{k}</dt>
                  <dd className="text-body-sm text-ink truncate">{v}</dd>
                </div>
              ))}
          </dl>
        </div>
      )}
    </Block>
  );
}

function DatesTravellers({
  doc,
  client,
  dispatch,
  setClient,
}: {
  doc: EditorDoc;
  client: EditorClient;
  dispatch: (op: EditorOp) => void;
  setClient: (patch: Partial<EditorClient>) => void;
}) {
  const nights = Math.max(0, doc.days.length - 1);
  const setPax = (k: "adults" | "children" | "infants", n: number) => {
    const pax = { ...client.pax, [k]: n };
    if (k === "children") pax.child_ages = client.pax.child_ages.slice(0, n);
    setClient({ pax });
  };
  return (
    <Block title="Travel dates and travellers">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="start-date">Start date</Label>
        <Input
          id="start-date"
          type="date"
          value={doc.startDate ?? ""}
          onChange={(e) => dispatch({ op: "itinerary.set", startDate: e.target.value || null })}
        />
        <p className="text-caption text-ink-muted">
          {nights} {nights === 1 ? "night" : "nights"}. Changing the date re-dates every day.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {(
          [
            ["adults", "Adults", 1, 40],
            ["children", "Children", 0, 20],
            ["infants", "Infants", 0, 10],
          ] as const
        ).map(([k, label, min, max]) => (
          <div key={k} className="flex flex-col gap-1.5">
            <Label htmlFor={`pax-${k}`}>{label}</Label>
            <Input
              id={`pax-${k}`}
              type="number"
              inputMode="numeric"
              min={min}
              max={max}
              value={client.pax[k] ?? 0}
              onChange={(e) => {
                const n = Math.round(Number(e.target.value));
                if (Number.isFinite(n)) setPax(k, Math.min(max, Math.max(min, n)));
              }}
              className="tnum"
            />
          </div>
        ))}
      </div>
    </Block>
  );
}

function PricingBlock({
  pricing,
  pax,
  onChange,
}: {
  pricing: Pricing;
  pax: { adults: number; children: number };
  onChange: (p: Pricing) => void;
}) {
  const summary = computePricing(pricing, pax);
  const set = (patch: Partial<Pricing>) => onChange({ ...pricing, ...patch });
  const preview = summary.headline
    ? `Client sees “${formatINR(summary.headline.amount)}${summary.headline.unit === "total" ? " total" : ` ${summary.headline.unit}`}”`
    : "Enter a price first";

  return (
    <Block title="Pricing">
      <SegmentedControl
        ariaLabel="Pricing mode"
        value={pricing.mode}
        onChange={(mode) => set({ mode })}
        segments={[
          { value: "total", label: "Total" },
          { value: "per_person", label: "Per person" },
          { value: "per_adult_child", label: "Adult + child" },
        ]}
        className="w-full [&>button]:flex-1 [&>button]:px-1"
      />
      {pricing.mode === "total" && (
        <MoneyInput
          id="price-total"
          label="Total price"
          value={pricing.total}
          onChange={(total) => set({ total })}
        />
      )}
      {pricing.mode === "per_person" && (
        <MoneyInput
          id="price-pp"
          label="Price per person"
          value={pricing.per_person}
          onChange={(per_person) => set({ per_person })}
        />
      )}
      {pricing.mode === "per_adult_child" && (
        <div className="grid grid-cols-2 gap-3">
          <MoneyInput
            id="price-adult"
            label="Per adult"
            value={pricing.per_adult}
            onChange={(per_adult) => set({ per_adult })}
          />
          <MoneyInput
            id="price-child"
            label="Per child"
            value={pricing.per_child}
            onChange={(per_child) => set({ per_child })}
          />
        </div>
      )}

      <dl className="flex flex-col gap-1.5">
        {summary.lines.map((l) => (
          <div key={l.label} className="text-body-sm flex justify-between gap-3">
            <dt className="text-ink-secondary">
              {l.label} × {formatINR(l.unit)}
            </dt>
            <dd className="text-ink tnum">{formatINR(l.amount)}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 pt-1">
          <dt className="text-heading-3 text-ink">Total</dt>
          <dd className="text-numeric text-ink text-[18px] font-semibold">
            {summary.total === null ? "—" : formatINR(summary.total)}
          </dd>
        </div>
      </dl>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tax-note">Tax note (optional)</Label>
        <Input
          id="tax-note"
          value={pricing.tax_note ?? ""}
          maxLength={160}
          placeholder="Includes 5% GST"
          onChange={(e) => set({ tax_note: e.target.value })}
        />
      </div>

      <div className="flex items-start justify-between gap-4">
        <label htmlFor="show-price" className="flex flex-col">
          <span className="text-body-sm text-ink">Show price on shared itinerary</span>
          <span className="text-caption text-ink-muted">
            {pricing.show ? preview : "Client sees “Ask for price”"}
          </span>
        </label>
        <Switch
          id="show-price"
          label="Show price on shared itinerary"
          checked={pricing.show}
          onChange={(show) => set({ show })}
        />
      </div>
    </Block>
  );
}

function MoneyInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const [text, setText] = useState(value === null ? "" : formatINR(value));
  const [invalid, setInvalid] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="numeric"
        value={text}
        placeholder="₹0"
        aria-invalid={invalid}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseRupees(e.target.value);
          setInvalid(n === undefined);
          if (n !== undefined) onChange(n);
        }}
        onBlur={() => {
          const n = parseRupees(text);
          if (n !== undefined) setText(n === null ? "" : formatINR(n));
        }}
        className="tnum"
      />
      {invalid && <p className="text-caption text-danger">Whole rupees only, like 42,250.</p>}
    </div>
  );
}

function SectionBlock({
  title,
  kind,
  value,
  fromDefaults,
  onChange,
}: {
  title: string;
  kind: "list" | "text";
  value: string;
  fromDefaults: boolean;
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const lines = value
    .split("\n")
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
  return (
    <Block
      title={title}
      action={<EditToggle editing={editing} onClick={() => setEditing((e) => !e)} />}
    >
      {editing ? (
        <Textarea
          autoFocus
          aria-label={title}
          value={value}
          rows={kind === "list" ? 6 : 4}
          maxLength={4000}
          onChange={(e) => onChange(e.target.value)}
          className="text-body-sm"
        />
      ) : value.trim() ? (
        kind === "list" ? (
          <ul className="flex flex-col gap-1.5">
            {lines.map((l, i) => (
              <li key={i} className="text-body-sm text-ink flex gap-2">
                <span aria-hidden className="text-ink-muted">
                  •
                </span>
                {l}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body-sm text-ink whitespace-pre-line">{value}</p>
        )
      ) : (
        <p className="text-body-sm text-ink-muted">Nothing yet.</p>
      )}
      {kind === "list" && editing && (
        <p className="text-caption text-ink-muted">One item per line.</p>
      )}
      {fromDefaults && !editing && (
        <p className="text-caption text-ink-muted">From agency defaults</p>
      )}
    </Block>
  );
}
