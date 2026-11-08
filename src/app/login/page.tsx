import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { PRODUCT_NAME } from "@/lib/config/brand";
import { env } from "@/lib/env";
import { LoginForm } from "@/features/auth/login-form";
import { LoginHero } from "@/features/auth/login-hero";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  expired: "That sign-in link has expired or was already used. Request a new one.",
  invalid: "That sign-in link is not valid. Request a new one.",
};

/**
 * PNG 04/05 (desktop) and 17 (mobile): hero left with its caption, form right.
 * Mobile stacks the hero on top. Daywise branding only — this is the admin product.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const session = await getSession();
  if (session) redirect(session.tenant ? "/app" : "/admin");

  const { error } = await searchParams;
  const support = env.SUPPORT_EMAIL;
  const talk = (
    <a href={`mailto:${support}?subject=New%20to%20Daywise`} className="focus-ring rounded-sm">
      <span className="text-ink-secondary">New to {PRODUCT_NAME}?</span>{" "}
      <span className="text-ink-secondary underline underline-offset-4 md:no-underline">
        Talk to us
      </span>
    </a>
  );

  return (
    <div className="flex min-h-dvh flex-col md:h-dvh md:flex-row">
      <div className="p-4 md:w-1/2 md:p-5 md:pr-0 lg:w-[51%]">
        <LoginHero className="h-[270px] md:h-full" />
      </div>

      <div className="flex flex-1 flex-col px-4 pt-6 pb-8 md:px-[8%] md:py-14 lg:pr-[100px] lg:pl-[132px]">
        <header className="text-body flex items-center justify-between">
          <span className="text-heading-2 text-ink">{PRODUCT_NAME}</span>
          <span className="hidden md:inline">{talk}</span>
        </header>

        <div className="flex flex-1 flex-col justify-center py-8 md:py-16">
          <LoginForm
            initialError={error ? (ERRORS[error] ?? ERRORS.invalid) : undefined}
            supportEmail={support}
          />
        </div>

        <footer className="text-body-sm text-ink-muted hidden items-center justify-between md:flex">
          <span>Itineraries for travel agents, drafted day by day.</span>
          <a
            href={`mailto:${support}`}
            className="focus-ring text-ink-secondary rounded-sm underline underline-offset-4"
          >
            {support}
          </a>
        </footer>
        <footer className="text-body-sm mt-auto flex items-center justify-between md:hidden">
          {talk}
          <a
            href={`mailto:${support}`}
            className="focus-ring text-ink-secondary rounded-sm underline underline-offset-4"
          >
            Help
          </a>
        </footer>
      </div>
    </div>
  );
}
