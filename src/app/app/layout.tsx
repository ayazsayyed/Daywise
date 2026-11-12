import { stopActingAsTenant } from "@/features/admin/actions";
import { requireTenant } from "@/lib/auth/guards";

/** Every /app route needs a tenant session. Bars differ per area: (main) list/settings, new flow, editor. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireTenant();
  return (
    <>
      {session.impersonating && (
        <div
          role="status"
          className="bg-surface-sunken border-line text-body-sm text-ink flex h-9 items-center justify-between gap-4 border-b px-4 sm:px-6 lg:px-12"
        >
          <span className="truncate">
            Viewing as <span className="font-medium">{session.tenant.name}</span>. Changes you make
            are saved to this agency and recorded.
          </span>
          <form action={stopActingAsTenant}>
            <button
              type="submit"
              className="text-indigo focus-ring rounded-sm font-medium whitespace-nowrap hover:underline hover:underline-offset-4"
            >
              Return to admin
            </button>
          </form>
        </div>
      )}
      {children}
    </>
  );
}
