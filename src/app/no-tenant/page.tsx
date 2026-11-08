import { Button } from "@/components/ui/button";
import { PRODUCT_NAME } from "@/lib/config/brand";

export default function NoTenantPage() {
  return (
    <main className="flex min-h-dvh flex-col px-4 py-6 md:px-24 md:py-14">
      <span className="text-heading-2 text-ink">{PRODUCT_NAME}</span>
      <div className="flex max-w-[560px] flex-1 flex-col justify-center gap-6 py-16">
        <h1 className="text-display-1 text-ink">No agency is linked to this account.</h1>
        <p className="text-body text-ink-secondary">
          Your sign-in works, but it is not attached to an agency yet. Ask the Daywise administrator
          to link your account, then sign in again.
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
