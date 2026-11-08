import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Wordmark } from "@/components/brand/wordmark";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  expired: "That sign-in link has expired or was already used. Request a new one.",
  invalid: "That sign-in link isn't valid. Request a new one.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const session = await getSession();
  if (session) redirect(session.tenant ? "/app" : "/admin");

  const { error } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Wordmark className="mb-10" />
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Enter your work email and we&apos;ll send you a one-time sign-in link.
        </p>
        <div className="mt-8">
          <LoginForm initialError={error ? (ERRORS[error] ?? ERRORS.invalid) : undefined} />
        </div>
        <p className="text-muted-foreground mt-10 text-xs">
          Daywise is invite-only. Accounts are set up by your agency&apos;s administrator.
        </p>
      </div>
    </main>
  );
}
