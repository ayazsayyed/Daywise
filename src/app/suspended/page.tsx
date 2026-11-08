import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";

export default function SuspendedPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <Wordmark className="mb-8 justify-center" />
        <h1 className="text-xl font-semibold">This account is suspended</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Your agency&apos;s Daywise access is paused. Shared client links stay readable for 30
          days. Contact Daywise support to restore access.
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
