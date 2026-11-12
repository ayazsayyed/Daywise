"use client";

import Link from "next/link";
import { Fragment, useState, useTransition } from "react";

import { StatusDot, type TenantStatus } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import { suspendTenant, unsuspendTenant } from "./actions";

export type TenantRow = {
  id: string;
  name: string;
  domain: string;
  status: TenantStatus;
  itineraries: number;
  ai: number;
  aiCap: number;
  places: number;
  pdf: number;
  users: number;
  links: number;
};

/** PNG 16 table: row action Suspend (inline type-to-confirm panel) / Reactivate. */
export function TenantsTable({ rows, query }: { rows: TenantRow[]; query: string }) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {notice && (
        <p role="status" className="text-body-sm text-ink-secondary mb-4">
          {notice}
        </p>
      )}
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="bg-surface-sunken h-10 text-left">
            <Th className="rounded-l-sm pl-5">Agency</Th>
            <Th align="right">Itineraries</Th>
            <Th align="right">AI calls</Th>
            <Th align="right">Places</Th>
            <Th align="right">PDFs</Th>
            <Th className="pl-8">Status</Th>
            <Th className="rounded-r-sm pr-5">
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="text-body-sm text-ink-muted py-10 pl-5">
                {query
                  ? `No tenants match “${query}”.`
                  : "No tenants yet. Create the first one on the right."}
              </td>
            </tr>
          )}
          {rows.map((t) => {
            const aiShare = t.aiCap > 0 ? t.ai / t.aiCap : 0;
            const suspended = t.status === "suspended";
            return (
              <Fragment key={t.id}>
                <tr className="border-line hover:bg-surface-sunken h-[60px] border-b">
                  <td className="py-2 pl-5">
                    <Link href={`/admin/t/${t.id}`} className="group flex flex-col">
                      <span
                        className={cn(
                          "text-heading-3 max-w-[260px] truncate group-hover:underline group-hover:underline-offset-4",
                          suspended ? "text-ink-muted" : "text-ink",
                        )}
                      >
                        {t.name}
                      </span>
                      <span className="text-caption text-ink-muted">{t.domain}</span>
                    </Link>
                  </td>
                  <Td align="right">{formatNumber(t.itineraries)}</Td>
                  <Td align="right" className={cn(aiShare >= 0.8 && "text-amber")}>
                    {formatNumber(t.ai)}
                    {aiShare >= 0.8 && ` · ${Math.round(aiShare * 100)}%`}
                  </Td>
                  <Td align="right">{formatNumber(t.places)}</Td>
                  <Td align="right">{formatNumber(t.pdf)}</Td>
                  <td className="pl-8">
                    <StatusDot kind="tenant" status={t.status} />
                  </td>
                  <td className="pr-5 text-right">
                    {suspended ? (
                      <button
                        type="button"
                        disabled={pending}
                        className="text-body-sm text-ink focus-ring rounded-sm font-medium hover:underline hover:underline-offset-4"
                        onClick={() =>
                          start(async () => {
                            const r = await unsuspendTenant(t.id);
                            setNotice(r.message ?? null);
                          })
                        }
                      >
                        Reactivate
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="text-body-sm text-ink-secondary hover:text-ink focus-ring rounded-sm font-medium"
                        aria-expanded={confirming === t.id}
                        onClick={() => setConfirming(confirming === t.id ? null : t.id)}
                      >
                        Suspend
                      </button>
                    )}
                  </td>
                </tr>
                {confirming === t.id && (
                  <tr>
                    <td colSpan={7} className="p-0">
                      <SuspendPanel
                        row={t}
                        onCancel={() => setConfirming(null)}
                        onDone={(m) => {
                          setConfirming(null);
                          setNotice(m);
                        }}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SuspendPanel({
  row,
  onCancel,
  onDone,
}: {
  row: TenantRow;
  onCancel: () => void;
  onDone: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const id = `confirm-${row.id}`;
  return (
    <form
      className="border-danger bg-surface-raised flex flex-col gap-4 border px-5 py-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await suspendTenant(row.id, name);
          if (r.ok) onDone(r.message ?? "Suspended");
          else setError(r.message);
        });
      }}
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-heading-3 text-ink">Suspend {row.name}?</h3>
        <p className="text-body-sm text-ink-secondary">
          Their {row.users === 1 ? "login is" : `${row.users} logins are`} signed out and{" "}
          {formatNumber(row.links)} shared {row.links === 1 ? "link stays" : "links stay"} readable
          for 30 days. Nothing is deleted.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={id}>Type the agency name to confirm</Label>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            id={id}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            className="w-full sm:w-[320px]"
            aria-describedby={error ? `${id}-err` : undefined}
          />
          <Button variant="destructive" type="submit" disabled={pending}>
            {pending ? "Suspending…" : "Suspend tenant"}
          </Button>
          <Button variant="ghost" type="button" onClick={onCancel}>
            Cancel
          </Button>
        </div>
        {error && (
          <p id={`${id}-err`} className="text-caption text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}

function Th({
  children,
  align = "left",
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "text-label text-ink-secondary px-4 font-medium",
        align === "right" && "text-right",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td
      className={cn(
        "text-body-sm text-ink-secondary tnum px-4",
        align === "right" && "text-right",
        className,
      )}
    >
      {children}
    </td>
  );
}
