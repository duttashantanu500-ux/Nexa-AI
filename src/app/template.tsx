"use client";

import { ReactNode } from "react";

/**
 * App Router template — remounts on navigation so each page enters smoothly.
 * Respects prefers-reduced-motion via CSS.
 */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="nexa-page-enter">{children}</div>;
}
