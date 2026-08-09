import { ImageResponse } from "next/og";
import { store } from "@/lib/data";
import { formatCentsShort } from "@/lib/money";

export const runtime = "nodejs";
export const alt = "Fundraising drive on Capital Ark";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Share preview.
 *
 * The realistic distribution path is a link pasted into a group chat, so the
 * unfurled card is doing the persuading before anyone reaches the site. It
 * leads with the progress bar because that's the social proof.
 */
export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const target = await store.getTargetBySlug(slug);

  if (!target) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f8fafc",
            fontSize: 48,
            color: "#0f172a",
          }}
        >
          Capital Ark
        </div>
      ),
      size,
    );
  }

  const { progress, candidate, coalition } = target;
  const pct = Math.min(100, progress.percent);
  const confirmedPct =
    progress.goalCents > 0
      ? Math.min(100, (progress.confirmedCents / progress.goalCents) * 100)
      : 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#ffffff",
          padding: 64,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "#0f766e",
                color: "white",
                fontSize: 20,
                fontWeight: 900,
              }}
            >
              CA
            </div>
            <div style={{ fontSize: 24, color: "#64748b", fontWeight: 600 }}>
              {coalition.name}
            </div>
          </div>

          <div
            style={{
              fontSize: 68,
              fontWeight: 800,
              color: "#0f172a",
              lineHeight: 1.1,
              marginTop: 24,
            }}
          >
            {candidate.fullName}
          </div>
          {/* Satori requires an explicit display on any element with more
              than one child, so every text node here is a single string. */}
          <div style={{ fontSize: 30, color: "#475569" }}>
            {`${candidate.office}${candidate.district ? ` · ${candidate.district}` : ""}`}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
            <div style={{ fontSize: 64, fontWeight: 800, color: "#0f172a" }}>
              {formatCentsShort(progress.raisedCents)}
            </div>
            <div style={{ fontSize: 32, color: "#64748b" }}>
              {`raised of ${formatCentsShort(progress.goalCents)}`}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              width: "100%",
              height: 24,
              borderRadius: 999,
              background: "#e2e8f0",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${confirmedPct}%`,
                height: "100%",
                background: "#16a34a",
              }}
            />
            <div
              style={{
                width: `${Math.max(0, pct - confirmedPct)}%`,
                height: "100%",
                background: "#2dd4bf",
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: "#64748b" }}>
            <div>{`${progress.donorCount} ${progress.donorCount === 1 ? "contributor" : "contributors"}`}</div>
            <div>
              {progress.daysRemaining !== null
                ? `${progress.daysRemaining} days left`
                : "Ongoing"}
            </div>
          </div>

          <div style={{ fontSize: 20, color: "#94a3b8", marginTop: 8 }}>
            {"Capital Ark is non-partisan software. Contributions go directly to the committee's own processor."}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
