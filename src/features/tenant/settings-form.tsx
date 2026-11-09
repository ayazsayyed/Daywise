"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Upload } from "lucide-react";

import { Field, SaveState, SectionLabel, TopBarAction } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { contrastRatio, darkenToReadable, readableOnSurface, SURFACE_HEX } from "@/lib/color";
import { initialsOf, THEME_PRESETS } from "@/lib/config/brand";
import { FOOTER_MAX } from "@/lib/db/json";
import type { TenantBranding, TenantDefaults } from "@/lib/db/schema";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  removeLogo,
  saveSettings,
  uploadLogo,
  type SaveState as Save,
  type UploadState,
} from "./actions";
import { BrandPreview } from "./brand-preview";

type Props = {
  tenantName: string;
  branding: TenantBranding;
  defaults: TenantDefaults;
};

const HEX = /^#([0-9a-fA-F]{6})$/;
const FORM_ID = "agency-settings";

/** PNG 15: two-column form with section labels in the left gutter, live preview on the right. */
export function SettingsForm({ tenantName, branding, defaults }: Props) {
  const initial = useMemo(
    () => ({ name: tenantName, ...branding, ...defaults }),
    [tenantName, branding, defaults],
  );
  const [form, setForm] = useState(initial);
  const [saveState, saveAction, saving] = useActionState<Save, FormData>(saveSettings, {
    status: "idle",
  });
  const [uploadState, uploadAction, uploading] = useActionState<UploadState, FormData>(uploadLogo, {
    status: "idle",
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const [removing, startRemove] = useTransition();

  // Server is the source of truth for the logo URL after upload/remove.
  useEffect(() => {
    setForm((f) => ({ ...f, logo_url: branding.logo_url }));
  }, [branding.logo_url]);

  const set =
    (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const themeValid = HEX.test(form.theme_color);
  const themeReadable = themeValid && readableOnSurface(form.theme_color);
  const themeFix = themeValid && !themeReadable ? darkenToReadable(form.theme_color) : null;
  const errorField = saveState.status === "error" ? saveState.field : undefined;
  const errorFor = (field: string) =>
    saveState.status === "error" && errorField === field ? saveState.message : undefined;

  const dirty = useMemo(() => {
    const { logo_url: _a, ...a } = form;
    const { logo_url: _b, ...b } = initial;
    return JSON.stringify(a) !== JSON.stringify(b);
  }, [form, initial]);

  const saveIndicator: React.ComponentProps<typeof SaveState>["state"] = saving
    ? "saving"
    : saveState.status === "error" && !errorField
      ? "failed"
      : dirty
        ? "unsaved"
        : saveState.status === "saved"
          ? "saved"
          : "idle";

  return (
    <>
      <TopBarAction>
        <SaveState
          state={saveIndicator}
          at={saveState.status === "saved" ? formatTime(saveState.at) : undefined}
        />
        <Button type="submit" form={FORM_ID} disabled={saving || !themeReadable || !dirty}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </TopBarAction>

      <div className="border-line mt-8 grid gap-16 border-t xl:grid-cols-[minmax(0,1fr)_424px]">
        <form id={FORM_ID} action={saveAction} className="divide-line flex flex-col divide-y">
          {/* Brand */}
          <Section title="Brand" description="Shown at the top of the client page and the PDF.">
            <div className="flex flex-col gap-2">
              <SectionLabel>Logo</SectionLabel>
              <div className="flex flex-wrap items-start gap-3">
                <div className="border-line bg-surface-raised grid h-[78px] w-[116px] place-items-center rounded-md border">
                  {form.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={form.logo_url}
                      alt={`${form.name} logo`}
                      className="max-h-14 max-w-24 object-contain"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="text-on-indigo grid size-12 place-items-center rounded-md text-[15px] font-semibold"
                      style={{ backgroundColor: themeValid ? form.theme_color : "#2E3A8C" }}
                    >
                      {initialsOf(form.name, "A")}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex items-center gap-3">
                    <input
                      ref={fileRef}
                      id="logo"
                      name="logo"
                      type="file"
                      accept="image/png,image/svg+xml,image/jpeg"
                      className="sr-only"
                      form="logo-upload"
                      onChange={(e) => {
                        if (e.target.files?.[0]) e.target.form?.requestSubmit();
                      }}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                    >
                      <Upload aria-hidden />
                      {uploading ? "Uploading…" : form.logo_url ? "Replace" : "Upload"}
                    </Button>
                    {form.logo_url && (
                      <button
                        type="button"
                        disabled={uploading || removing}
                        onClick={() => startRemove(() => removeLogo())}
                        className="focus-ring text-body-sm text-ink-secondary hover:text-ink disabled:text-ink-muted rounded-sm"
                      >
                        {removing ? "Removing…" : "Remove"}
                      </button>
                    )}
                  </div>
                  <p className="text-caption text-ink-muted">
                    {form.logo_url ? `${fileNameOf(form.logo_url)} · ` : ""}PNG, SVG or JPG up to 2
                    MB
                  </p>
                  {uploadState.status === "error" && (
                    <p className="text-caption text-danger" role="alert">
                      {uploadState.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <SectionLabel as="span" id="theme-label">
                Theme colour
              </SectionLabel>
              <div className="flex flex-wrap items-center gap-3">
                <div role="radiogroup" aria-labelledby="theme-label" className="flex gap-2">
                  {THEME_PRESETS.map((hex) => {
                    const active = form.theme_color.toUpperCase() === hex;
                    return (
                      <button
                        key={hex}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={hex}
                        onClick={() => setForm((f) => ({ ...f, theme_color: hex }))}
                        className={cn(
                          "focus-ring border-line size-9 rounded-md border",
                          active && "ring-ink ring-offset-surface ring-2 ring-offset-2",
                        )}
                        style={{ backgroundColor: hex }}
                      />
                    );
                  })}
                </div>
                <Input
                  id="theme_color"
                  name="theme_color"
                  value={form.theme_color}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, theme_color: e.target.value.toUpperCase() }))
                  }
                  aria-label="Theme colour hex"
                  className="tnum w-[120px] uppercase"
                  aria-invalid={!themeValid || undefined}
                  spellCheck={false}
                  maxLength={7}
                />
              </div>
              {!themeValid ? (
                <p className="text-caption text-danger">Use a 6-digit hex like #2E3A8C.</p>
              ) : themeFix ? (
                <p className="text-caption text-danger">
                  Too light to read on off-white (
                  {contrastRatio(form.theme_color, SURFACE_HEX).toFixed(1)}:1, needs 4.5:1).{" "}
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, theme_color: themeFix }))}
                    className="focus-ring text-ink rounded-sm font-medium underline underline-offset-4"
                  >
                    Use {themeFix}
                  </button>
                </p>
              ) : (
                <p className="text-caption text-ink-muted">
                  Used for your name, headings and buttons on the client page. Must be dark enough
                  to read on off-white.
                </p>
              )}
            </div>
          </Section>

          {/* Contact details */}
          <Section
            title="Contact details"
            description="Printed in the header and footer of every itinerary."
          >
            <Field label="Agency name" htmlFor="name" error={errorFor("name")}>
              <Input id="name" name="name" value={form.name} onChange={set("name")} required />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Tagline"
                htmlFor="tagline"
                optional
                hint="One short line under your name on the client page."
                error={errorFor("tagline")}
              >
                <Input
                  id="tagline"
                  name="tagline"
                  value={form.tagline}
                  onChange={set("tagline")}
                  placeholder="Holidays planned personally since 1998"
                  maxLength={80}
                />
              </Field>
              <Field
                label="Contact person"
                htmlFor="contact_person"
                optional
                hint="Named under the WhatsApp button and in the PDF."
                error={errorFor("contact_person")}
              >
                <Input
                  id="contact_person"
                  name="contact_person"
                  value={form.contact_person}
                  onChange={set("contact_person")}
                  placeholder="Nikhil Joshi"
                  maxLength={80}
                />
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Phone" htmlFor="phone" error={errorFor("phone")}>
                <Input
                  id="phone"
                  name="phone"
                  value={form.phone}
                  onChange={set("phone")}
                  placeholder="+91 22 0000 0000"
                  inputMode="tel"
                />
              </Field>
              <Field label="WhatsApp" htmlFor="whatsapp" error={errorFor("whatsapp")}>
                <Input
                  id="whatsapp"
                  name="whatsapp"
                  value={form.whatsapp}
                  onChange={set("whatsapp")}
                  placeholder="+91 98000 00000"
                  inputMode="tel"
                />
              </Field>
              <Field label="Email" htmlFor="email" error={errorFor("email")}>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  placeholder="holidays@agency.com"
                />
              </Field>
              <Field label="Website" htmlFor="website" error={errorFor("website")}>
                <Input
                  id="website"
                  name="website"
                  value={form.website}
                  onChange={set("website")}
                  placeholder="agency.com"
                  inputMode="url"
                />
              </Field>
            </div>
            <Field label="Address" htmlFor="address" error={errorFor("address")}>
              <Input id="address" name="address" value={form.address} onChange={set("address")} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="GSTIN" htmlFor="gstin" optional error={errorFor("gstin")}>
                <Input
                  id="gstin"
                  name="gstin"
                  value={form.gstin}
                  onChange={set("gstin")}
                  className="uppercase"
                  spellCheck={false}
                />
              </Field>
              <Field
                label="IATA or licence no."
                htmlFor="licence_no"
                optional
                error={errorFor("licence_no")}
              >
                <Input
                  id="licence_no"
                  name="licence_no"
                  value={form.licence_no}
                  onChange={set("licence_no")}
                  placeholder="Shown in the footer if added"
                />
              </Field>
            </div>
          </Section>

          {/* Footer text */}
          <Section
            title="Footer text"
            description="One or two lines at the end of every itinerary."
          >
            <Field
              label="Footer"
              htmlFor="footer"
              error={errorFor("footer")}
              hint={
                <span className={cn("tnum", form.footer.length > FOOTER_MAX && "text-danger")}>
                  {form.footer.length} of {FOOTER_MAX} characters
                </span>
              }
            >
              <Textarea
                id="footer"
                name="footer"
                value={form.footer}
                onChange={set("footer")}
                rows={2}
                maxLength={FOOTER_MAX + 20}
              />
            </Field>
          </Section>

          {/* Default texts */}
          <Section
            title="Default texts"
            description="New itineraries start with these. Changing them does not touch itineraries you have already made."
            last
          >
            <Field
              label="Inclusions"
              htmlFor="inclusions"
              hint="One item per line. Shown as a list."
              error={errorFor("inclusions")}
            >
              <Textarea
                id="inclusions"
                name="inclusions"
                value={form.inclusions}
                onChange={set("inclusions")}
                rows={4}
                placeholder={"Accommodation on twin sharing as listed\nDaily breakfast"}
              />
            </Field>
            <Field label="Exclusions" htmlFor="exclusions" error={errorFor("exclusions")}>
              <Textarea
                id="exclusions"
                name="exclusions"
                value={form.exclusions}
                onChange={set("exclusions")}
                rows={4}
                placeholder={"Airfare and train tickets\nAnything not listed under inclusions"}
              />
            </Field>
            <Field label="Payment terms" htmlFor="payment_terms" error={errorFor("payment_terms")}>
              <Textarea
                id="payment_terms"
                name="payment_terms"
                value={form.payment_terms}
                onChange={set("payment_terms")}
                rows={2}
              />
            </Field>
            <Field label="Cancellation" htmlFor="cancellation" error={errorFor("cancellation")}>
              <Textarea
                id="cancellation"
                name="cancellation"
                value={form.cancellation}
                onChange={set("cancellation")}
                rows={3}
              />
            </Field>
          </Section>

          {saveState.status === "error" && (
            <p className="text-body-sm text-danger pt-6" role="alert">
              {saveState.message}
            </p>
          )}
        </form>

        {/* Separate form so choosing a file uploads without submitting the settings. */}
        <form id="logo-upload" action={uploadAction} className="hidden" />

        <aside className="xl:sticky xl:top-[88px] xl:self-start">
          <div className="flex items-center justify-between pt-6 xl:pt-4">
            <SectionLabel>Live preview</SectionLabel>
            <span className="text-caption text-ink-muted">Client page header</span>
          </div>
          <BrandPreview
            className="mt-3"
            tenantName={form.name}
            logoUrl={form.logo_url}
            themeColor={themeValid ? form.theme_color : "#2E3A8C"}
            phone={form.phone}
            whatsapp={form.whatsapp}
            email={form.email}
            website={form.website}
            gstin={form.gstin}
            licenceNo={form.licence_no}
            tagline={form.tagline}
            contactPerson={form.contact_person}
            footer={form.footer}
          />
          <p className="text-caption text-ink-muted mt-3">
            Updates as you type. The full client page is designed separately.
          </p>
        </aside>
      </div>
    </>
  );
}

function Section({
  title,
  description,
  last,
  children,
}: {
  title: string;
  description: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        "grid gap-6 py-8 lg:grid-cols-[200px_minmax(0,560px)] lg:py-10",
        last && "pb-0",
      )}
    >
      <div className="flex flex-col gap-1 pr-6">
        <h2 className="text-heading-3 text-ink">{title}</h2>
        <p className="text-body-sm text-ink-secondary">{description}</p>
      </div>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  );
}

function fileNameOf(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
  } catch {
    return "";
  }
}
