import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen / browser dropdown icon */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FAFAFA",
          borderRadius: 36,
        }}
      >
        <div
          style={{
            fontSize: 110,
            fontWeight: 800,
            color: "#09D59A",
            fontFamily: "system-ui, -apple-system, sans-serif",
            letterSpacing: "-0.04em",
            lineHeight: 1,
          }}
        >
          N
        </div>
      </div>
    ),
    { ...size }
  );
}
