"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowRight, Check } from "lucide-react";

import { Field } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestMagicLink, type LoginState } from "./actions";

const RESEND_AFTER_S = 60;

export function LoginForm({
  initialError,
  supportEmail,
}: {
  initialError?: string;
  supportEmail: string;
}) {
  const [state, action, pending] = useActionState<LoginState, FormData>(requestMagicLink, {
    status: "idle",
  });
  // "Use a different email" returns to the form even though the last action state is "sent".
  const [view, setView] = useState<"form" | "sent">("form");
  const [email, setEmail] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(RESEND_AFTER_S);
  const resendRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "sent") {
      setEmail(state.email);
      setView("sent");
      setSecondsLeft(RESEND_AFTER_S);
    }
  }, [state]);

  useEffect(() => {
    if (view !== "sent" || secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [view, secondsLeft]);

  if (view === "sent") {
    const mm = Math.floor(secondsLeft / 60);
    const ss = String(secondsLeft % 60).padStart(2, "0");
    return (
      <div className="flex max-w-[420px] flex-col gap-4" role="status" aria-live="polite">
        <p className="text-body-sm text-green inline-flex items-center gap-2">
          <Check className="size-4" aria-hidden /> Link sent
        </p>
        <h1 className="text-display-1 text-ink">Check your inbox</h1>
        <p className="text-body text-ink-secondary">
          We sent a sign-in link to <span className="text-ink font-medium">{email}</span>. Open it
          on this device within 15 minutes.
        </p>

        <div className="divide-line border-line mt-4 flex flex-col divide-y border-y">
          <div className="text-body flex items-center justify-between gap-4 py-5">
            <span className="text-ink-secondary">Nothing yet? Check spam, or</span>
            <form ref={resendRef} action={action}>
              <input type="hidden" name="email" value={email} />
              {secondsLeft > 0 ? (
                <span className="text-ink-muted/70 tnum">
                  Resend in {mm}:{ss}
                </span>
              ) : (
                <button
                  type="submit"
                  disabled={pending}
                  className="focus-ring text-ink disabled:text-ink-muted rounded-sm font-semibold"
                >
                  {pending ? "Sending…" : "Resend link"}
                </button>
              )}
            </form>
          </div>
          <div className="text-body flex items-center justify-between gap-4 py-5">
            <span className="text-ink-secondary">Wrong address?</span>
            <button
              type="button"
              onClick={() => setView("form")}
              className="focus-ring text-ink rounded-sm font-semibold"
            >
              Use a different email
            </button>
          </div>
        </div>
        {state.status === "error" && (
          <p className="text-caption text-danger" role="alert">
            {state.message}
          </p>
        )}

        <div className="text-body-sm text-ink-muted mt-10 flex flex-col gap-3">
          <p>The link works once. Signing in on a new device asks for a fresh link.</p>
          <a
            href={`mailto:${supportEmail}`}
            className="focus-ring text-ink-secondary w-fit rounded-sm underline underline-offset-4"
          >
            {supportEmail}
          </a>
        </div>
      </div>
    );
  }

  const error = state.status === "error" ? state.message : initialError;

  return (
    <form action={action} className="flex max-w-[420px] flex-col gap-6" noValidate>
      <div className="flex flex-col gap-4">
        <h1 className="text-display-1 text-ink">Welcome back</h1>
        <p className="text-body text-ink-secondary">
          Sign in with your work email. We send a one-time link, so there is no password to
          remember.
        </p>
      </div>
      <Field
        label="Work email"
        htmlFor="email"
        hint="Use the address your agency was set up with."
        error={error}
      >
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          required
          defaultValue={email}
          placeholder="you@agency.com"
          className="h-12 text-[17px]"
          aria-invalid={error ? true : undefined}
          aria-describedby="email-hint"
        />
      </Field>
      <Button type="submit" size="lg" className="w-full text-[16px]" disabled={pending}>
        {pending ? "Sending…" : "Email me a sign-in link"}
        {!pending && <ArrowRight aria-hidden />}
      </Button>
    </form>
  );
}
