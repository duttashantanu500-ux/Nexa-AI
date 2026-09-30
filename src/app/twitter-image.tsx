import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Nexa — AI Agent Operating System";
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
          background: "#fafafa",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            width: 12,
            height: "100%",
            background: "#4F46E5",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "0 64px",
            gap: 48,
          }}
        >
          <div
            style={{
              width: 180,
              height: 180,
              borderRadius: 40,
              background: "#4F46E5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 96,
              fontWeight: 700,
            }}
          >
            N
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                fontSize: 72,
                fontWeight: 700,
                color: "#18181b",
                letterSpacing: "-0.02em",
              }}
            >
              Nexa
            </div>
            <div style={{ fontSize: 32, color: "#71717a" }}>
              AI Agent Operating System
            </div>
            <div style={{ fontSize: 28, color: "#a1a1aa" }}>
              Connect tools. Build agents. Run the work.
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
