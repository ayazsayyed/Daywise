import { Button } from "@/components/ui/button";
import { PRODUCT_NAME } from "@/lib/config/brand";
import { env } from "@/lib/env";

export default function SuspendedPage() {
  return (
    <main className="flex min-h-dvh flex-col px-4 py-6 md:px-24 md:py-14">
      <span className="text-heading-2 text-ink">{PRODUCT_NAME}</span>
      <div className="flex max-w-[560px] flex-1 flex-col justify-center gap-6 py-16">
        <h1 className="text-display-1 text-ink">This account is suspended.</h1>
        <p className="text-body text-ink-secondary">
          Your agency&apos;s Daywise access is paused. Links you have already shared stay readable
          for 30 days. Write to{" "}
          <a href={`mailto:${env.SUPPORT_EMAIL}`} className="text-ink underline underline-offset-4">
            {env.SUPPORT_EMAIL}
          </a>{" "}
          to restore access.
        </p>
        <form action="/logout" method="post">
          <Button variant="secondary" type="submit">
            Sign out
          </Button>
        </form>
      </div>
    </main>
  );
}
