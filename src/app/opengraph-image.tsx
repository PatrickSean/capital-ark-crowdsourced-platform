import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Capital Ark — collective fundraising, clearly tracked";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          color: "#0f172a",
          background:
            "linear-gradient(135deg, #ffffff 0%, #f0fdfa 55%, #ccfbf1 100%)",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 58,
              height: 58,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 15,
              color: "white",
              background: "#0f766e",
              fontSize: 25,
              fontWeight: 900,
            }}
          >
            CA
          </div>
          <div style={{ fontSize: 32, fontWeight: 750 }}>Capital Ark</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              maxWidth: 980,
              fontSize: 72,
              lineHeight: 1.04,
              letterSpacing: -2,
              fontWeight: 850,
            }}
          >
            Collective support, clearly tracked.
          </div>
          <div style={{ maxWidth: 900, fontSize: 30, lineHeight: 1.35, color: "#475569" }}>
            One coalition link. Official campaign processors. Transparent,
            crowdsourced progress.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 24, color: "#0f766e", fontWeight: 700 }}>
          <div style={{ width: 70, height: 8, borderRadius: 999, background: "#0f766e" }} />
          Non-partisan software · Capital Ark never handles contributions
        </div>
      </div>
    ),
    size,
  );
}
