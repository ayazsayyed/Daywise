"use client";

import { useActionState, useState, useTransition } from "react";

import { Field } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TENANT_DOMAIN_SUFFIX } from "@/lib/config/brand";
import { cn } from "@/lib/utils";

import {
  checkCname,
  deleteTenant,
  updateTenantSettings,
  type CnameCheck,
  type FormResult,
} from "./actions";

export function TenantSettingsForm({
  tenantId,
  initial,
}: {
  tenantId: string;
  initial: {
    name: string;
    slug: string;
    plan: string;
    customDomain: string;
    dailyGenCap: number;
    monthlyAiCap: number;
    monthlyPdfCap: number;
  };
}) {
  const [state, action, pending] = useActionState<FormResult | null, FormData>(
    updateTenantSettings.bind(null, tenantId),
    null,
  );
  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Agency name" htmlFor="t-name">
          <Input id="t-name" name="name" defaultValue={initial.name} maxLength={80} />
        </Field>
        <Field
          label="Subdomain"
          htmlFor="t-slug"
          hint={`.${TENANT_DOMAIN_SUFFIX} · changing it stops share links already sent on the old address`}
        >
          <Input
            id="t-slug"
            name="slug"
            defaultValue={initial.slug}
            maxLength={32}
            spellCheck={false}
            autoCapitalize="none"
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Drafts / day" htmlFor="t-gen">
          <Input
            id="t-gen"
            name="dailyGenCap"
            type="number"
            min={0}
            defaultValue={initial.dailyGenCap}
            className="tnum"
          />
        </Field>
        <Field label="AI calls / month" htmlFor="t-ai">
          <Input
            id="t-ai"
            name="monthlyAiCap"
            type="number"
            min={0}
            defaultValue={initial.monthlyAiCap}
            className="tnum"
          />
        </Field>
        <Field label="PDFs / month" htmlFor="t-pdf">
          <Input
            id="t-pdf"
            name="monthlyPdfCap"
            type="number"
            min={0}
            defaultValue={initial.monthlyPdfCap}
            className="tnum"
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
        <Field label="Plan" htmlFor="t-plan">
          <select
            id="t-plan"
            name="plan"
            defaultValue={initial.plan === "trial" ? "trial" : "standard"}
            className="border-line-strong bg-surface-raised text-body text-ink focus-ring h-10 rounded-md border px-3"
          >
            <option value="trial">Trial</option>
            <option value="standard">Standard</option>
          </select>
        </Field>
        <Field label="Custom domain" htmlFor="t-domain" optional>
          <Input
            id="t-domain"
            name="customDomain"
            defaultValue={initial.customDomain}
            placeholder="itinerary.agency.com"
            spellCheck={false}
          />
        </Field>
      </div>
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        {state && (
          <p
            role={state.ok ? "status" : "alert"}
            className={cn("text-body-sm", state.ok ? "text-green" : "text-danger")}
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

export function CnameChecker({ tenantId, hasDomain }: { tenantId: string; hasDomain: boolean }) {
  const [result, setResult] = useState<CnameCheck | { error: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button
          variant="secondary"
          disabled={!hasDomain || pending}
          onClick={() => start(async () => setResult(await checkCname(tenantId)))}
        >
          {pending ? "Looking up DNS…" : "Check DNS"}
        </Button>
      </div>
      {result && "error" in result && <p className="text-body-sm text-danger">{result.error}</p>}
      {result && !("error" in result) && (
        <div className="flex flex-col gap-3">
          <p
            className={cn(
              "text-body-sm font-medium",
              result.verdict.ok ? "text-green" : "text-danger",
            )}
            role="status"
          >
            {result.verdict.ok ? "Correct" : "Not yet"} · {result.verdict.summary}
          </p>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-sunken h-10 text-left">
                <th scope="col" className="text-label text-ink-secondary px-4 font-medium">
                  Record
                </th>
                <th scope="col" className="text-label text-ink-secondary px-4 font-medium">
                  Expected
                </th>
                <th scope="col" className="text-label text-ink-secondary px-4 font-medium">
                  Actual
                </th>
              </tr>
            </thead>
            <tbody className="text-body-sm text-ink-secondary">
              <tr className="border-line h-11 border-b">
                <td className="text-ink px-4">CNAME {result.domain}</td>
                <td className="px-4 break-all">{result.expected.cname.join(", ")}</td>
                <td className="px-4 break-all">{result.actual.cname.join(", ") || "none"}</td>
              </tr>
              <tr className="border-line h-11 border-b">
                <td className="text-ink px-4">A (apex only)</td>
                <td className="px-4">{result.expected.a.join(", ") || "unknown"}</td>
                <td className="px-4">{result.actual.a.join(", ") || "none"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function DeleteTenant({ tenantId, name }: { tenantId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!open)
    return (
      <div>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          Delete tenant…
        </Button>
      </div>
    );
  return (
    <form
      className="border-danger bg-surface-raised flex flex-col gap-4 rounded-md border p-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await deleteTenant(tenantId, value);
          if (r && !r.ok) setError(r.message);
        });
      }}
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-heading-3 text-ink">Delete {name} permanently?</h3>
        <p className="text-body-sm text-ink-secondary">
          Every itinerary, share link, login, usage record and logo is deleted and cannot be
          restored except from a nightly backup. Download the data first if the agency wants it.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="del-confirm">Type the agency name to confirm</Label>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            id="del-confirm"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="off"
            className="w-full sm:w-[320px]"
          />
          <Button variant="destructive" type="submit" disabled={pending}>
            {pending ? "Deleting…" : "Delete tenant"}
          </Button>
          <Button variant="ghost" type="button" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
        {error && (
          <p className="text-caption text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
