import { PhotoFrame, SectionLabel } from "@/components/ds";
import { initialsOf } from "@/lib/config/brand";
import { cn } from "@/lib/utils";

type Props = {
  tenantName: string;
  logoUrl: string | null;
  themeColor: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  gstin: string;
  licenceNo: string;
  tagline: string;
  contactPerson: string;
  footer: string;
  className?: string;
};

/**
 * PNG 15 "Client page header": tenant logo and theme colour only, never
 * Daywise branding. Sample trip copy is fixed; contact lines come from the form.
 */
export function BrandPreview({
  tenantName,
  logoUrl,
  themeColor,
  phone,
  whatsapp,
  email,
  website,
  gstin,
  licenceNo,
  tagline,
  contactPerson,
  footer,
  className,
}: Props) {
  const name = tenantName.trim() || "Your agency";
  const contact = [contactPerson && `Questions or changes: ${contactPerson}`, phone, email, website]
    .filter(Boolean)
    .join(" · ");
  const registration = [gstin && `GSTIN ${gstin}`, licenceNo && `Licence ${licenceNo}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={cn(
        "border-line bg-surface-raised text-ink overflow-hidden rounded-lg border",
        className,
      )}
      aria-label="Client page header preview"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-7 max-w-28 object-contain" />
        ) : (
          <span
            className="text-on-indigo grid size-7 shrink-0 place-items-center rounded-sm text-[11px] font-semibold"
            style={{ backgroundColor: themeColor }}
            aria-hidden
          >
            {initialsOf(name, "A")}
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-body-sm truncate font-semibold">{name}</span>
          {tagline && <span className="text-caption text-ink-muted truncate">{tagline}</span>}
        </span>
        <span
          className="text-caption text-on-indigo shrink-0 rounded-sm px-2.5 py-1 font-semibold"
          style={{ backgroundColor: themeColor }}
          aria-hidden={!whatsapp}
        >
          WhatsApp us
        </span>
      </div>
      <div className="bg-line h-px" />

      <div className="flex flex-col gap-4 px-4 pt-4 pb-5">
        <PhotoFrame ratio="3:2" index={0} alt="" caption="Dal Lake, Srinagar" />
        <div className="flex flex-col gap-1">
          <SectionLabel style={{ color: themeColor }}>Prepared for Ananya &amp; Rohit</SectionLabel>
          <p className="text-heading-2">Kashmir, five days</p>
          <p className="text-body-sm text-ink-secondary">
            14–18 Mar 2027 · 4 nights · Srinagar, Gulmarg, Pahalgam
          </p>
        </div>
      </div>
      <div className="bg-line h-px" />

      <div className="text-caption text-ink-muted flex flex-col gap-1 px-4 py-3">
        <p className="truncate">{contact || "Phone · email · website appear here"}</p>
        {registration && <p className="truncate">{registration}</p>}
        <p className="line-clamp-3">{footer || "Your footer text appears here."}</p>
      </div>
    </div>
  );
}
