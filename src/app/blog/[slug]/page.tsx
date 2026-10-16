import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NexaLogo } from "@/components/NexaLogo";
import { allSlugs, getPost } from "@/lib/blog/posts";

const SITE_URL = "https://www.nexaiintelligence.online";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return allSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: "Post not found" };

  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url: `${SITE_URL}/blog/${post.slug}`,
      publishedTime: post.date,
      siteName: "Nexa",
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    author: {
      "@type": "Organization",
      name: "Nexa",
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "Nexa",
      url: SITE_URL,
    },
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
    keywords: post.keywords.join(", "),
  };

  return (
    <div className="min-h-screen bg-[#F7F8FC] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
        <NexaLogo size={28} href="/" />
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/blog" className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            Blog
          </Link>
          <Link
            href="/signup"
            className="rounded-xl bg-indigo-600 px-3.5 py-2 text-white hover:bg-indigo-500"
          >
            Get started
          </Link>
        </nav>
      </header>

      <article className="mx-auto max-w-3xl px-4 pb-16 pt-4">
        <Link href="/blog" className="text-xs text-zinc-500 hover:text-indigo-600">
          ← All posts
        </Link>
        <time
          dateTime={post.date}
          className="mt-4 block text-xs font-medium uppercase tracking-wide text-zinc-400"
        >
          {new Date(post.date + "T12:00:00").toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </time>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{post.title}</h1>
        <p className="mt-3 text-base text-zinc-600 dark:text-zinc-400">{post.description}</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          {post.sections.map((section, i) => (
            <section key={i}>
              {section.heading && (
                <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {section.heading}
                </h2>
              )}
              <div className="space-y-3">
                {section.paragraphs.map((p, j) => (
                  <p key={j}>{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-6 dark:border-indigo-900 dark:bg-indigo-950/30">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Hire AI employees on Nexa
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Build your AI team, connect Notion, Slack, HubSpot, and Buffer, and run real work with
            approvals.
          </p>
          <Link
            href="/signup"
            className="mt-4 inline-block rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Start free
          </Link>
        </div>
      </article>

      <footer className="border-t border-zinc-200 py-8 dark:border-zinc-800">
        <div className="mx-auto flex max-w-3xl flex-wrap gap-4 px-4 text-sm text-zinc-500">
          <Link href="/">Home</Link>
          <Link href="/blog">Blog</Link>
          <Link href="/plans">Plans</Link>
        </div>
      </footer>
    </div>
  );
}
