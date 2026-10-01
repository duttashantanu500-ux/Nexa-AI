import Link from "next/link";

type Props = {
  size?: number;
  showWordmark?: boolean;
  href?: string | null;
  className?: string;
  wordmarkClassName?: string;
};

/**
 * Official Nexa mark — green N (matches browser favicon / brand assets).
 */
export function NexaLogo({
  size = 28,
  showWordmark = true,
  href = "/",
  className = "",
  wordmarkClassName = "",
}: Props) {
  const mark = (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[#FAFAFA] ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:ring-zinc-700"
        style={{ width: size, height: size }}
        aria-hidden
      >
        <svg
          width={Math.round(size * 0.72)}
          height={Math.round(size * 0.72)}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <text
            x="16"
            y="23"
            textAnchor="middle"
            fontFamily="system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
            fontSize="20"
            fontWeight="800"
            fill="#09D59A"
          >
            N
          </text>
        </svg>
      </span>
      {showWordmark && (
        <span
          className={
            wordmarkClassName ||
            "text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
          }
        >
          Nexa
        </span>
      )}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center no-underline">
        {mark}
      </Link>
    );
  }
  return mark;
}
