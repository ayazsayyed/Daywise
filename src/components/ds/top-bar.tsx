import { TopBarMenu } from "./top-bar-menu";
import { TopNav, type NavItem } from "./top-nav";

export const TOP_BAR_SLOT_ID = "topbar-slot";

/**
 * 56px top bar on surface with a hairline below: brand (left), text nav,
 * page action slot + initials (right). No sidebar. Pages mount their one
 * primary action into the slot with <TopBarAction>.
 */
export function TopBar({
  brand,
  brandHref,
  nav,
  email,
  initials,
  menuLinks = [],
  action,
}: {
  brand: string;
  brandHref: string;
  nav: NavItem[];
  email: string;
  initials: string;
  /** Extra links in the user menu, e.g. "Admin" or "Open app". */
  menuLinks?: NavItem[];
  /** Server-rendered action; pages can also portal into the slot. */
  action?: React.ReactNode;
}) {
  return (
    <header className="border-line bg-surface sticky top-0 z-20 h-14 border-b">
      <div className="flex h-full items-center gap-6 px-4 sm:px-6 lg:gap-10 lg:px-12">
        <TopBarMenu
          brand={brand}
          brandHref={brandHref}
          email={email}
          initials={initials}
          items={[...nav, ...menuLinks]}
          variant="brand"
        />
        <TopNav items={nav} className="hidden md:flex" />
        <div className="ml-auto flex items-center gap-4">
          <div id={TOP_BAR_SLOT_ID} className="flex items-center gap-4 empty:hidden" />
          {action}
          <TopBarMenu
            brand={brand}
            brandHref={brandHref}
            email={email}
            initials={initials}
            items={[...nav, ...menuLinks]}
            variant="avatar"
          />
        </div>
      </div>
    </header>
  );
}
