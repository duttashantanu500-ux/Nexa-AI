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
    default: "Nexa — Build your AI Team",
    template: "%s · Nexa",
  },
  description:
    "Nexa is where you build your AI team. Hire AI employees, connect their tools, and let them handle the work — with Vault, schedules, and work history.",
  keywords: [
    "Nexa",
    "AI employees",
    "AI team",
    "workflow automation",
    "AI automation",
    "connect tools",
    "Notion Slack Buffer",
    "AI employee builder",
  ],
  authors: [{ name: "Nexa" }],
  creator: "Nexa",
  applicationName: "Nexa",
  manifest: "/site.webmanifest",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Nexa",
    title: "Nexa — Build your AI Team",
    description:
      "Connect your tools. Build your AI team. Let them handle the work.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Nexa — Build your AI Team",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nexa — Build your AI Team",
    description:
      "Connect your tools. Build your AI team. Let them handle the work.",
    images: ["/twitter-image"],
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
      { url: "/icon", type: "image/png", sizes: "32x32" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
    shortcut: ["/icon"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#09D59A" },
    { media: "(prefers-color-scheme: dark)", color: "#09D59A" },
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
