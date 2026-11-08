"use client";

import { useActionState } from "react";
import { MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestMagicLink, type LoginState } from "./actions";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(requestMagicLink, {
    status: "idle",
  });

  if (state.status === "sent") {
    return (
      <div className="bg-card rounded-xl border p-6 shadow-xs" role="status" aria-live="polite">
        <MailCheck className="text-primary size-6" aria-hidden />
        <h2 className="mt-3 font-semibold">Check your inbox</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          If <span className="text-foreground font-medium">{state.email}</span> has a Daywise
          account, a sign-in link is on its way. It works once and expires in 15 minutes.
        </p>
      </div>
    );
  }

  const error = state.status === "error" ? state.message : initialError;

  return (
    <form action={action} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          required
          placeholder="you@agency.com"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "email-error" : undefined}
        />
        {error && (
          <p id="email-error" className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send sign-in link"}
      </Button>
    </form>
  );
}
