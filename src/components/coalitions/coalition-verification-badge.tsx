import { Badge } from "@/components/ui/primitives";
import type { CoalitionView } from "@/lib/domain/types";

export function CoalitionVerificationBadge({
  status,
}: {
  status: CoalitionView["verificationStatus"];
}) {
  const isPlatformReviewed = status === "PLATFORM_VERIFIED";

  return (
    <Badge tone={isPlatformReviewed ? "verified" : "warn"}>
      {isPlatformReviewed
        ? "Platform reviewed"
        : "Community-created, unverified"}
    </Badge>
  );
}
