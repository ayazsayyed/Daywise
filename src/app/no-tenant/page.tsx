import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";

export default function NoTenantPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <Wordmark className="mb-8 justify-center" />
        <h1 className="text-xl font-semibold">No agency linked to this account</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Your login works, but it isn&apos;t attached to an agency yet. Ask the Daywise
          administrator to link your account.
        </p>
        <form action="/logout" method="post" className="mt-8">
          <Button variant="outline" type="submit">
            Sign out
          </Button>
        </form>
      </div>
    </main>
  );
}
