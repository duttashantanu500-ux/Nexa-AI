import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

const SITE_URL = "https://www.nexaiintelligence.online";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Nexa — AI Agent Operating System",
    template: "%s · Nexa",
  },
  description:
    "Nexa is an AI agent operating system. Connect your tools, build agents, and let them run the work — with Vault, scheduling, and run history.",
  keywords: [
    "Nexa",
    "AI agents",
    "agent operating system",
    "workflow automation",
    "AI automation",
    "connect tools",
    "Notion Slack Buffer",
    "agent builder",
  ],
  authors: [{ name: "Nexa" }],
  creator: "Nexa",
  applicationName: "Nexa",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Nexa",
    title: "Nexa — AI Agent Operating System",
    description:
      "Connect your tools. Build agents. Let them handle the work. Nexa is the operating system for AI agents.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nexa — AI Agent Operating System",
    description:
      "Connect your tools. Build agents. Let them handle the work.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico" },
    ],
    apple: [{ url: "/apple-icon" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-full antialiased bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50`}
      >
        <ThemeProvider>{children}</ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
