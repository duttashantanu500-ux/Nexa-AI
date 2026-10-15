import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Plans — Free & Pro for AI Employees",
  description:
    "Nexa Free and Pro plans for hiring AI employees and building your AI team. Start free with up to 3 AI agents; upgrade for more capacity.",
  alternates: { canonical: "/plans" },
  openGraph: {
    title: "Nexa Plans — AI Employees Free & Pro",
    description:
      "Simple pricing for AI employees and AI teams. Start free. Upgrade when you need more capacity.",
    url: "https://www.nexaiintelligence.online/plans",
  },
};

export default function PlansLayout({ children }: { children: ReactNode }) {
  return children;
}
