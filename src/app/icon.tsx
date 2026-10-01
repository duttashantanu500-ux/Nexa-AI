import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Browser tab favicon — official Nexa green N */
export default function Icon() {
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
          borderRadius: 7,
        }}
      >
        <div
          style={{
            fontSize: 22,
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
