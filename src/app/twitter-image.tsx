import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Nexa — Build your AI Team";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          background: "#FAFAFA",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ width: 14, height: "100%", background: "#09D59A" }} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "0 72px",
            gap: 52,
          }}
        >
          <div
            style={{
              width: 200,
              height: 200,
              borderRadius: 44,
              background: "#FFFFFF",
              border: "2px solid #E4E4E7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 12px 40px rgba(9, 213, 154, 0.12)",
            }}
          >
            <div
              style={{
                fontSize: 120,
                fontWeight: 800,
                color: "#09D59A",
                letterSpacing: "-0.04em",
                lineHeight: 1,
              }}
            >
              N
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                fontSize: 76,
                fontWeight: 750,
                color: "#18181B",
                letterSpacing: "-0.03em",
                lineHeight: 1.05,
              }}
            >
              Nexa
            </div>
            <div
              style={{
                width: 72,
                height: 5,
                borderRadius: 4,
                background: "#09D59A",
              }}
            />
            <div style={{ fontSize: 34, color: "#52525B", marginTop: 4 }}>
              Build your AI Team
            </div>
            <div style={{ fontSize: 28, color: "#A1A1AA" }}>
              Hire AI employees · Connect tools · Let them work
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
