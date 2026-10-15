import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Create account — Hire AI Employees",
  description:
    "Create a free Nexa account to hire AI employees, build your AI team, and connect tools like Notion and Slack.",
  alternates: { canonical: "/signup" },
  openGraph: {
    title: "Create a Nexa account — Hire AI employees",
    description:
      "Start free. Hire AI agents, connect your tools, and run real work.",
    url: "https://www.nexaiintelligence.online/signup",
  },
};

export default function SignupLayout({ children }: { children: ReactNode }) {
  return children;
}
