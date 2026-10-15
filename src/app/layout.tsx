import type { Metadata, Viewport } from "next";
import { Fredoka, Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { DeployRefresh } from "@/components/DeployRefresh";

const SITE_URL = "https://www.nexaiintelligence.online";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Rounded, blocky — LEGO-style labels in the sidebar only */
const fredoka = Fredoka({
  variable: "--font-lego",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const SEO_DESCRIPTION =
  "Nexa is the AI employee and AI team platform. Hire AI agents, connect Notion, Slack, HubSpot, and Buffer, then run real work with approvals, schedules, and a Work Board.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Nexa — AI Employees & AI Team Platform | Hire AI Agents",
    template: "%s · Nexa",
  },
  description: SEO_DESCRIPTION,
  keywords: [
    "Nexa",
    "Nexa AI",
    "AI employee",
    "AI employees",
    "AI team",
    "AI agent",
    "AI agents",
    "digital workforce",
    "hire AI employees",
    "AI employee builder",
    "AI workflow automation",
    "AI agent platform",
    "Notion AI automation",
    "Slack AI agent",
    "HubSpot AI",
    "Buffer AI",
  ],
  authors: [{ name: "Nexa", url: SITE_URL }],
  creator: "Nexa",
  publisher: "Nexa",
  applicationName: "Nexa",
  category: "technology",
  classification: "Business Software",
  manifest: "/site.webmanifest",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Nexa",
    title: "Nexa — AI Employees & AI Team Platform",
    description: SEO_DESCRIPTION,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Nexa — Hire AI employees and build your AI team",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nexa — AI Employees & AI Team Platform",
    description: SEO_DESCRIPTION,
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
      { url: "/icon?v=official-5", type: "image/png", sizes: "32x32" },
      { url: "/icon.svg?v=official-5", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-icon?v=official-5", sizes: "180x180", type: "image/png" }],
    shortcut: ["/icon?v=official-5"],
  },
  other: {
    "google-site-verification": process.env.GOOGLE_SITE_VERIFICATION || "",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#5B9CF5" },
    { media: "(prefers-color-scheme: dark)", color: "#5B9CF5" },
  ],
  width: "device-width",
  initialScale: 1,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Nexa",
      url: SITE_URL,
      logo: `${SITE_URL}/icon?v=official-5`,
      description: SEO_DESCRIPTION,
      sameAs: [],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "Nexa",
      url: SITE_URL,
      description: SEO_DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en-US",
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#app`,
      name: "Nexa",
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "AI Employee Platform",
      operatingSystem: "Web",
      description: SEO_DESCRIPTION,
      url: SITE_URL,
      offers: [
        {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          name: "Nexa Free",
        },
        {
          "@type": "Offer",
          price: "9",
          priceCurrency: "USD",
          name: "Nexa Pro",
        },
      ],
      featureList: [
        "AI employees",
        "AI team management",
        "AI agent builder",
        "Notion, Slack, HubSpot, Buffer connections",
        "Work Board and approvals",
        "Scheduling and work history",
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${fredoka.variable} min-h-full antialiased bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ThemeProvider>
          <DeployRefresh />
          {children}
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
