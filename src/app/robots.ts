import type { MetadataRoute } from "next";

const SITE_URL = "https://www.nexaiintelligence.online";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/plans", "/login", "/signup", "/forgot-password"],
        disallow: [
          "/api/",
          "/home",
          "/agents",
          "/agents/",
          "/activity",
          "/settings",
          "/vault",
          "/connections",
          "/connections/",
          "/onboarding",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
