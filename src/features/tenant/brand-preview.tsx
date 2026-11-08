import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";

type Props = {
  tenantName: string;
  logoUrl: string | null;
  themeColor: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  footer: string;
};

/** Client-facing header + contact card, rendered with the tenant's own brand only. */
export function BrandPreview({
  tenantName,
  logoUrl,
  themeColor,
  phone,
  whatsapp,
  email,
  address,
  footer,
}: Props) {
  return (
    <div className="overflow-hidden rounded-xl border bg-white text-[#1f2430] shadow-xs">
      <div className="h-1.5" style={{ backgroundColor: themeColor }} />
      <div className="flex items-center gap-3 px-5 py-4">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-9 max-w-32 object-contain" />
        ) : (
          <span
            className="grid size-9 place-items-center rounded-md text-sm font-bold text-white"
            style={{ backgroundColor: themeColor }}
            aria-hidden
          >
            {tenantName.trim().charAt(0).toUpperCase() || "A"}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{tenantName}</p>
          <p className="text-xs text-neutral-500">Your 5-day Kashmir itinerary</p>
        </div>
      </div>

      <div
        className="mx-5 h-28 rounded-lg bg-[linear-gradient(135deg,#e9edf5,#f6f1e7)]"
        aria-hidden
      />

      <div className="space-y-2 px-5 py-4">
        <div className="h-2.5 w-2/3 rounded bg-neutral-200" aria-hidden />
        <div className="h-2.5 w-1/2 rounded bg-neutral-200" aria-hidden />
        <div className="h-2.5 w-3/5 rounded bg-neutral-200" aria-hidden />
      </div>

      <div
        className="mx-5 mb-4 rounded-lg border p-4 text-sm"
        style={{ borderColor: `${themeColor}33` }}
      >
        <p
          className="mb-2 text-xs font-semibold tracking-wide uppercase"
          style={{ color: themeColor }}
        >
          Contact {tenantName}
        </p>
        <ul className="space-y-1.5 text-[13px] text-neutral-700">
          <li className="flex items-center gap-2">
            <Phone className="size-3.5 shrink-0" style={{ color: themeColor }} />{" "}
            {phone || <Placeholder>Phone</Placeholder>}
          </li>
          <li className="flex items-center gap-2">
            <MessageCircle className="size-3.5 shrink-0" style={{ color: themeColor }} />{" "}
            {whatsapp || <Placeholder>WhatsApp</Placeholder>}
          </li>
          <li className="flex items-center gap-2">
            <Mail className="size-3.5 shrink-0" style={{ color: themeColor }} />{" "}
            {email || <Placeholder>Email</Placeholder>}
          </li>
          <li className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-3.5 shrink-0" style={{ color: themeColor }} />
            <span className="whitespace-pre-line">
              {address || <Placeholder>Address</Placeholder>}
            </span>
          </li>
        </ul>
      </div>

      <div className="border-t px-5 py-3 text-[11px] leading-relaxed whitespace-pre-line text-neutral-500">
        {footer || <Placeholder>Footer / terms line</Placeholder>}
      </div>
    </div>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return <span className="text-neutral-400 italic">{children}</span>;
}
