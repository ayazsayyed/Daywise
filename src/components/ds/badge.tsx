import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";

/** Verified (green-soft), Verify before sending (amber-soft), neutral (sunken). */
export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <Badge variant="verified" className={className}>
      <Check aria-hidden /> Verified
    </Badge>
  );
}

export function VerifyBadge({ className }: { className?: string }) {
  return (
    <Badge variant="verify" className={className}>
      Verify before sending
    </Badge>
  );
}

export function NeutralBadge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Badge variant="default" className={className}>
      {children}
    </Badge>
  );
}
