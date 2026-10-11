import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-static";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Official Nexa mark — exact brand logo on clean white background. */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAD90lEQVR4nO2W3W9WRRCHn9095y1CoRQFSgGFylcKUWgqUqIUohHR";