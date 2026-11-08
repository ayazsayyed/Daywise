"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, ImagePlus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { TenantBranding, TenantDefaults } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { removeLogo, saveSettings, uploadLogo, type SaveState, type UploadState } from "./actions";
import { BrandPreview } from "./brand-preview";

type Props = {
  tenantName: string;
  branding: TenantBranding;
  defaults: TenantDefaults;
  customDomain: string | null;
};

const HEX = /^#([0-9a-fA-F]{6})$/;

export function SettingsForm({ tenantName, branding, defaults, customDomain }: Props) {
  const [form, setForm] = useState({ ...branding, ...defaults });
  const [saveState, saveAction, saving] = useActionState<SaveState, FormData>(saveSettings, {
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
  const errorField = saveState.status === "error" ? saveState.field : undefined;

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-6">
        {/* Logo */}
        <Card>
          <CardHeader>
            <CardTitle>Logo</CardTitle>
            <CardDescription>
              PNG or SVG, up to 1 MB. Shown on shared itineraries and PDFs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={uploadAction} className="flex flex-wrap items-center gap-4">
              <div className="grid h-20 w-40 place-items-center overflow-hidden rounded-lg border bg-white">
                {form.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.logo_url}
                    alt={`${tenantName} logo`}
                    className="max-h-16 max-w-36 object-contain"
                  />
                ) : (
                  <span className="text-muted-foreground text-xs">No logo yet</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  id="logo"
                  name="logo"
                  type="file"
                  accept="image/png,image/svg+xml"
                  className="sr-only"
                  onChange={(e) => {
                    if (e.target.files?.[0]) e.target.form?.requestSubmit();
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  <ImagePlus />{" "}
                  {uploading ? "Uploading…" : form.logo_url ? "Replace logo" : "Upload logo"}
                </Button>
                {form.logo_url && (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={uploading || removing}
                    onClick={() => startRemove(() => removeLogo())}
                  >
                    <Trash2 /> {removing ? "Removing…" : "Remove"}
                  </Button>
                )}
              </div>
              {uploadState.status === "error" && (
                <p className="text-destructive basis-full text-sm" role="alert">
                  {uploadState.message}
                </p>
              )}
              {uploadState.status === "uploaded" && (
                <p className="text-muted-foreground basis-full text-sm" role="status">
                  Logo uploaded.
                </p>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Branding + defaults */}
        <form action={saveAction} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
              <CardDescription>
                Colour and contact details printed on client output.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Theme colour"
                htmlFor="theme_color"
                error={errorField === "theme_color"}
                className="sm:col-span-2"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    aria-label="Pick theme colour"
                    value={themeValid ? form.theme_color : "#2E3A8C"}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, theme_color: e.target.value.toUpperCase() }))
                    }
                    className="bg-card size-9 cursor-pointer rounded-md border p-0.5"
                  />
                  <Input
                    id="theme_color"
                    name="theme_color"
                    value={form.theme_color}
                    onChange={set("theme_color")}
                    placeholder="#2E3A8C"
                    className="max-w-40 font-mono uppercase"
                    aria-invalid={!themeValid || undefined}
                    spellCheck={false}
                  />
                  {!themeValid && (
                    <span className="text-destructive text-xs">Use a 6-digit hex like #2E3A8C</span>
                  )}
                </div>
              </Field>
              <Field label="Phone" htmlFor="phone" error={errorField === "phone"}>
                <Input
                  id="phone"
                  name="phone"
                  value={form.phone}
                  onChange={set("phone")}
                  placeholder="+91 98XXX XXXXX"
                  inputMode="tel"
                />
              </Field>
              <Field label="WhatsApp" htmlFor="whatsapp" error={errorField === "whatsapp"}>
                <Input
                  id="whatsapp"
                  name="whatsapp"
                  value={form.whatsapp}
                  onChange={set("whatsapp")}
                  placeholder="+91 98XXX XXXXX"
                  inputMode="tel"
                />
              </Field>
              <Field label="Email" htmlFor="email" error={errorField === "email"}>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  placeholder="hello@agency.com"
                />
              </Field>
              <Field
                label="Client-facing domain"
                htmlFor="domain"
                hint="Set up by Daywise during onboarding."
              >
                <Input
                  id="domain"
                  value={customDomain ?? "planner.smallsoftware.in"}
                  readOnly
                  disabled
                />
              </Field>
              <Field
                label="Address"
                htmlFor="address"
                error={errorField === "address"}
                className="sm:col-span-2"
              >
                <Textarea
                  id="address"
                  name="address"
                  value={form.address}
                  onChange={set("address")}
                  rows={2}
                />
              </Field>
              <Field
                label="Footer / terms line"
                htmlFor="footer"
                hint="One or two lines printed at the bottom of every itinerary."
                error={errorField === "footer"}
                className="sm:col-span-2"
              >
                <Textarea
                  id="footer"
                  name="footer"
                  value={form.footer}
                  onChange={set("footer")}
                  rows={2}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Itinerary defaults</CardTitle>
              <CardDescription>
                Pre-filled on every new itinerary. The agent can edit them per trip.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <Field label="Inclusions" htmlFor="inclusions" error={errorField === "inclusions"}>
                <Textarea
                  id="inclusions"
                  name="inclusions"
                  value={form.inclusions}
                  onChange={set("inclusions")}
                  rows={6}
                  placeholder={"Accommodation as per itinerary\nDaily breakfast\n…"}
                />
              </Field>
              <Field label="Exclusions" htmlFor="exclusions" error={errorField === "exclusions"}>
                <Textarea
                  id="exclusions"
                  name="exclusions"
                  value={form.exclusions}
                  onChange={set("exclusions")}
                  rows={6}
                  placeholder={"Airfare / train tickets\nPersonal expenses\n…"}
                />
              </Field>
              <Field
                label="Payment terms"
                htmlFor="payment_terms"
                error={errorField === "payment_terms"}
              >
                <Textarea
                  id="payment_terms"
                  name="payment_terms"
                  value={form.payment_terms}
                  onChange={set("payment_terms")}
                  rows={5}
                />
              </Field>
              <Field
                label="Cancellation policy"
                htmlFor="cancellation"
                error={errorField === "cancellation"}
              >
                <Textarea
                  id="cancellation"
                  name="cancellation"
                  value={form.cancellation}
                  onChange={set("cancellation")}
                  rows={5}
                />
              </Field>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit" disabled={saving || !themeValid}>
              {saving ? "Saving…" : "Save settings"}
            </Button>
            {saveState.status === "saved" && (
              <span
                className="text-muted-foreground inline-flex items-center gap-1.5 text-sm"
                role="status"
              >
                <CheckCircle2 className="text-primary size-4" /> Saved
              </span>
            )}
            {saveState.status === "error" && (
              <span className="text-destructive text-sm" role="alert">
                {saveState.message}
              </span>
            )}
          </div>
        </form>
      </div>

      <aside className="xl:sticky xl:top-10 xl:self-start">
        <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
          Live preview
        </p>
        <BrandPreview
          tenantName={tenantName}
          logoUrl={form.logo_url}
          themeColor={themeValid ? form.theme_color : "#2E3A8C"}
          phone={form.phone}
          whatsapp={form.whatsapp}
          email={form.email}
          address={form.address}
          footer={form.footer}
        />
        <Separator className="my-4" />
        <p className="text-muted-foreground text-xs">
          This is how your brand header and contact block will look on shared itineraries. Daywise
          branding never appears on client output.
        </p>
      </aside>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor} className={cn(error && "text-destructive")}>
        {label}
      </Label>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}
