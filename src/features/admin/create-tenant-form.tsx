"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { Field } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TENANT_DOMAIN_SUFFIX } from "@/lib/config/brand";
import { cn } from "@/lib/utils";

import { createTenant, slugAvailable, type FormResult } from "./actions";
import { RESERVED_SLUGS, SLUG_RE } from "./cname";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 32);

/** PNG 16 right card: "Create tenant — The owner gets a sign-in link by email." */
export function CreateTenantForm() {
  const [state, action, pending] = useActionState<FormResult | null, FormData>(createTenant, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [avail, setAvail] = useState<"idle" | "checking" | "yes" | "no">("idle");

  const effectiveSlug = slugTouched ? slug : slugify(name);

  useEffect(() => {
    if (!effectiveSlug) return setAvail("idle");
    if (!SLUG_RE.test(effectiveSlug) || RESERVED_SLUGS.has(effectiveSlug)) return setAvail("no");
    setAvail("checking");
    const t = setTimeout(() => {
      slugAvailable(effectiveSlug).then((ok) => setAvail(ok ? "yes" : "no"));
    }, 300);
    return () => clearTimeout(t);
  }, [effectiveSlug]);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setName("");
      setSlug("");
      setSlugTouched(false);
    }
  }, [state]);

  const err = (f: string) => (state && !state.ok && state.field === f ? state.message : undefined);

  return (
    <section
      aria-labelledby="create-tenant"
      className="border-line bg-surface-raised rounded-lg border"
    >
      <div className="border-line flex flex-col gap-1 border-b px-6 py-5">
        <h2 id="create-tenant" className="text-heading-2 text-ink">
          Create tenant
        </h2>
        <p className="text-body-sm text-ink-secondary">The owner gets a sign-in link by email.</p>
      </div>
      <form ref={formRef} action={action} className="flex flex-col">
        <div className="flex flex-col gap-5 px-6 py-6">
          <Field label="Agency name" htmlFor="ct-name" error={err("name")}>
            <Input
              id="ct-name"
              name="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field
            label="Subdomain"
            htmlFor="ct-slug"
            error={err("slug")}
            hint={
              <>
                {effectiveSlug || "slug"}.{TENANT_DOMAIN_SUFFIX}
                {avail === "yes" && <span className="text-green"> · Available</span>}
                {avail === "no" && <span className="text-danger"> · Not available</span>}
                {avail === "checking" && " · Checking…"}
              </>
            }
          >
            <Input
              id="ct-slug"
              name="slug"
              required
              value={effectiveSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value.toLowerCase());
              }}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <Field label="Owner email" htmlFor="ct-email" error={err("ownerEmail")}>
            <Input id="ct-email" name="ownerEmail" type="email" required autoComplete="off" />
          </Field>
          <Field
            label="Custom domain"
            htmlFor="ct-domain"
            optional
            error={err("customDomain")}
            hint="CNAME it to the subdomain; check it on the tenant page."
          >
            <Input
              id="ct-domain"
              name="customDomain"
              placeholder="itinerary.agency.com"
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <Field label="Plan" htmlFor="ct-plan">
            <select
              id="ct-plan"
              name="plan"
              defaultValue="trial"
              className="border-line-strong bg-surface-raised text-body text-ink focus-ring h-10 rounded-md border px-3"
            >
              <option value="trial">Trial</option>
              <option value="standard">Standard</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <CapField id="ct-ai" name="monthlyAiCap" label="AI calls / month" value={600} />
            <CapField id="ct-pdf" name="monthlyPdfCap" label="PDFs / month" value={200} />
            <CapField id="ct-gen" name="dailyGenCap" label="Drafts / day" value={30} />
          </div>
        </div>
        <div className="border-line flex flex-col gap-3 border-t px-6 py-4">
          {state && (state.ok || !state.field) && (
            <p
              role={state.ok ? "status" : "alert"}
              className={cn("text-body-sm", state.ok ? "text-green" : "text-danger")}
            >
              {state.message}
            </p>
          )}
          <div className="flex items-center justify-end gap-3">
            <Button type="reset" variant="ghost" onClick={() => setName("")}>
              Clear
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create tenant"}
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}

function CapField({
  id,
  name,
  label,
  value,
}: {
  id: string;
  name: string;
  label: string;
  value: number;
}) {
  return (
    <Field label={label} htmlFor={id}>
      <Input
        id={id}
        name={name}
        type="number"
        min={0}
        defaultValue={value}
        required
        className="tnum"
      />
    </Field>
  );
}
