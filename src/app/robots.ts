import type { MetadataRoute } from "next";

const SITE_URL = "https://www.nexaiintelligence.online";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/home", "/agents", "/settings", "/vault", "/connections"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
