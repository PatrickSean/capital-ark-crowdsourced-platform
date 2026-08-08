import { cn } from "@/lib/cn";
import { contributionLimitFor } from "@/lib/compliance/attestations";
import type { CandidateView } from "@/lib/domain/types";

/**
 * The who-may-give rules for a set of races, stated before anyone clicks.
 *
 * This exists because of a specific failure mode. A coalition organized around
 * an industry naturally reads as "our businesses are backing these candidates",
 * and in North Carolina that reading is a crime: G.S. 163-278.19 bars every
 * corporation, LLC, partnership, professional association and union from
 * contributing to a state candidate, and makes aiding such a contribution a
 * Class 2 misdemeanor for the person who arranged it as well as the giver.
 *
 * The attestation checkbox in the contribute flow covers the individual at the
 * moment of giving. It does nothing for the organizer who is about to send this
 * page to a mailing list of member companies, which is why the warning also
 * belongs here, on the page they share.
 */
export function SourceOfFundsNotice({
  candidates,
  className,
}: {
  candidates: Pick<CandidateView, "jurisdiction" | "state">[];
  className?: string;
}) {
  const hasNcState = candidates.some(
    (c) => c.jurisdiction === "STATE" && c.state?.toUpperCase() === "NC",
  );
  const hasFederal = candidates.some((c) => c.jurisdiction === "FEDERAL");

  if (!hasNcState && !hasFederal) return null;

  const nc = contributionLimitFor({ jurisdiction: "STATE", state: "NC" });
  const federal = contributionLimitFor({ jurisdiction: "FEDERAL" });

  return (
    <section
      aria-labelledby="source-of-funds-heading"
      className={cn(
        "rounded-card bg-amber-50 p-5 ring-1 ring-inset ring-amber-200",
        className,
      )}
    >
      <h2
        id="source-of-funds-heading"
        className="text-sm font-bold tracking-tight text-amber-900"
      >
        Personal funds only — this is not a business contribution drive
      </h2>

      {hasNcState && (
        <p className="mt-2 text-sm leading-relaxed text-amber-900">
          North Carolina prohibits contributions to state candidates from
          corporations, LLCs, partnerships, and any other business entity, as
          well as from unions, professional associations, and insurance
          companies. Give as an individual, from a personal account or card, and
          never let a business reimburse you for it. Arranging a business
          contribution is a misdemeanor for the organizer as well as the giver.
        </p>
      )}

      <ul className="mt-3 space-y-1.5 text-sm text-amber-900">
        {hasNcState && nc && (
          <li>
            <span className="font-semibold">NC state candidates:</span>{" "}
            {nc.label} per individual ({nc.authority}). Primary and general
            count separately.
          </li>
        )}
        {hasFederal && federal && (
          <li>
            <span className="font-semibold">Federal candidates:</span>{" "}
            {federal.label} per individual ({federal.authority}).
          </li>
        )}
        {hasNcState && (
          <li>
            Lobbyists registered in North Carolina may not contribute to
            legislators or Council of State members at all, and those candidates
            cannot accept lobbyist-connected money while the General Assembly is
            in session.
          </li>
        )}
      </ul>

      <p className="mt-3 text-xs leading-relaxed text-amber-800">
        Capital Ark is software, not counsel. Limits and eligibility are
        enforced by each committee and its processor. If your group is
        coordinating giving at scale, have a campaign finance attorney look at
        your plan first.
      </p>
    </section>
  );
}
