import { Card, relativeTime } from "@/components/ui/primitives";
import { ActivityType } from "@/generated/prisma/enums";
import { formatCentsShort } from "@/lib/money";
import type { ActivityItem } from "@/lib/domain/types";

/**
 * Recent activity.
 *
 * Anonymous contributors show as "Someone" — we never had a name for them, and
 * inventing one would be a privacy leak dressed up as a nicety.
 */
export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <Card className="p-5">
      <h2 className="text-sm font-bold tracking-tight text-ink-900">
        Recent activity
      </h2>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-ink-500">
          Nothing yet. The first confirmed contribution will show up here.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-ink-100">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <Dot type={item.type} />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug text-ink-800">
                  {renderMessage(item)}
                </p>
                <p className="mt-0.5 text-xs text-ink-400">
                  {relativeTime(item.createdAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function renderMessage(item: ActivityItem) {
  switch (item.type) {
    case ActivityType.PLEDGE_CONFIRMED:
      return (
        <>
          <span className="font-semibold text-ink-900">
            {item.actorLabel ?? "Someone"}
          </span>{" "}
          contributed{" "}
          {item.amountCents !== null && (
            <span className="font-semibold text-ink-900 tabular-nums">
              {formatCentsShort(item.amountCents)}
            </span>
          )}
          {item.candidateName ? ` to ${item.candidateName}` : ""}
        </>
      );
    case ActivityType.GOAL_REACHED:
      return (
        <>
          Goal reached for{" "}
          <span className="font-semibold text-ink-900">
            {item.candidateName ?? item.targetTitle}
          </span>
        </>
      );
    case ActivityType.TARGET_CREATED:
      return (
        <>
          New drive started:{" "}
          <span className="font-semibold text-ink-900">
            {item.message ?? item.targetTitle}
          </span>
        </>
      );
    case ActivityType.MEMBER_JOINED:
      return (
        <>
          <span className="font-semibold text-ink-900">
            {item.actorLabel ?? "Someone"}
          </span>{" "}
          joined the coalition
        </>
      );
    default:
      return item.message ?? "Activity";
  }
}

function Dot({ type }: { type: ActivityType }) {
  const color =
    type === ActivityType.PLEDGE_CONFIRMED
      ? "bg-verified"
      : type === ActivityType.GOAL_REACHED
        ? "bg-brand-600"
        : "bg-ink-300";

  return (
    <span
      aria-hidden="true"
      className={`mt-1.5 size-2 shrink-0 rounded-full ${color}`}
    />
  );
}
