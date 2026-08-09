import { ImageResponse } from "next/og";
import { store } from "@/lib/data";
import { formatCentsShort } from "@/lib/money";

export const runtime = "nodejs";
export const alt = "Coalition fundraising campaign on Capital Ark";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function CoalitionOpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const coalition = await store.getCoalitionBySlug(slug);

  if (!coalition) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#0f172a",
            background: "#f8fafc",
            fontFamily: "Arial, Helvetica, sans-serif",
            fontSize: 52,
            fontWeight: 800,
          }}
        >
          Capital Ark
        </div>
      ),
      size,
    );
  }

  const targets = await store.listTargetsForCoalition(coalition.id);
  const totals = targets.reduce(
    (sum, target) => ({
      raised: sum.raised + target.progress.raisedCents,
      goal: sum.goal + target.goalCents,
    }),
    { raised: 0, goal: 0 },
  );
  const percent =
    totals.goal > 0 ? Math.min(100, (totals.raised / totals.goal) * 100) : 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          color: "#0f172a",
          background:
            "linear-gradient(135deg, #ffffff 0%, #f0fdfa 55%, #ccfbf1 100%)",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 46,
              height: 46,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              color: "white",
              background: "#0f766e",
              fontSize: 20,
              fontWeight: 900,
            }}
          >
            CA
          </div>
          <div style={{ fontSize: 25, color: "#475569", fontWeight: 700 }}>
            Capital Ark
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              maxWidth: 1050,
              fontSize: 64,
              lineHeight: 1.08,
              letterSpacing: -1.5,
              fontWeight: 850,
            }}
          >
            {coalition.name}
          </div>
          <div style={{ maxWidth: 1020, fontSize: 27, lineHeight: 1.35, color: "#475569" }}>
            {coalition.description ??
              "Follow this coalition’s fundraising progress on Capital Ark."}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
            <div style={{ fontSize: 58, fontWeight: 850 }}>
              {formatCentsShort(totals.raised)}
            </div>
            <div style={{ fontSize: 28, color: "#64748b" }}>
              {`raised toward ${formatCentsShort(totals.goal)} across ${targets.length} drives`}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              width: "100%",
              height: 20,
              overflow: "hidden",
              borderRadius: 999,
              background: "#cbd5e1",
            }}
          >
            <div
              style={{
                width: `${percent}%`,
                height: "100%",
                background: "#0f766e",
              }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", fontSize: 21 }}>
            <div>Contributions go directly to official campaign processors</div>
            <div>{`${Math.round(percent * 10) / 10}%`}</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
