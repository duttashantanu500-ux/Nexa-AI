import type { Metadata } from "next";
import Link from "next/link";
import { NexaLogo } from "@/components/NexaLogo";
import { BLOG_POSTS } from "@/lib/blog/posts";

export const metadata: Metadata = {
  title: "Blog — AI Employees, AI Teams & AI Agents",
  description:
    "Guides on AI employees, building an AI team, and AI agents that do real work. From the team behind Nexa.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Nexa Blog — AI Employees & AI Teams",
    description:
      "Practical guides on hiring AI employees, building an AI team, and using AI agents for real work.",
    url: "https://www.nexaiintelligence.online/blog",
  },
};

export default function BlogIndexPage() {
  const posts = [...BLOG_POSTS].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="min-h-screen bg-[#F7F8FC] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
        <NexaLogo size={28} href="/" />
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/blog" className="font-medium text-indigo-600">
            Blog
          </Link>
          <Link href="/plans" className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            Plans
          </Link>
          <Link
            href="/signup"
            className="rounded-xl bg-indigo-600 px-3.5 py-2 text-white hover:bg-indigo-500"
          >
            Get started
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">
        <h1 className="text-3xl font-semibold tracking-tight">Nexa Blog</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Practical writing on AI employees, AI teams, and AI agents — how to hire them, connect
          tools, and run real work.
        </p>

        <ul className="mt-10 space-y-6">
          {posts.map((post) => (
            <li key={post.slug}>
              <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <time
                  dateTime={post.date}
                  className="text-xs font-medium uppercase tracking-wide text-zinc-400"
                >
                  {new Date(post.date + "T12:00:00").toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
                <h2 className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  <Link href={`/blog/${post.slug}`} className="hover:text-indigo-600">
                    {post.title}
                  </Link>
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {post.description}
                </p>
                <Link
                  href={`/blog/${post.slug}`}
                  className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:underline"
                >
                  Read more →
                </Link>
              </article>
            </li>
          ))}
        </ul>
      </main>

      <footer className="border-t border-zinc-200 py-8 dark:border-zinc-800">
        <div className="mx-auto flex max-w-3xl flex-wrap gap-4 px-4 text-sm text-zinc-500">
          <Link href="/">Home</Link>
          <Link href="/plans">Plans</Link>
          <Link href="/signup">Sign up</Link>
        </div>
      </footer>
    </div>
  );
}
