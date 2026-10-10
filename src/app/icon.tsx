import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Browser tab / favicon — official Nexa mark on white (not the old letter N). */
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
          background: "#FFFFFF",
        }}
      >
        <svg
          width="28"
          height="20"
          viewBox="0 0 120 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M8 68 L8 32 L36 68 L36 12 L68 68 L68 28 C68 28 82 12 100 28 C112 40 110 62 92 68 C76 74 68 56 68 56"
            stroke="#5B9CF5"
            strokeWidth="12"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    {
      ...size,
      headers: {
        // Short cache so logo updates show without hard refresh
        "Cache-Control": "public, max-age=60, must-revalidate",
      },
    }
  );
}
