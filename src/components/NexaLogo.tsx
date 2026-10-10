import Link from "next/link";

type Props = {
  size?: number;
  showWordmark?: boolean;
  href?: string | null;
  className?: string;
  wordmarkClassName?: string;
};

/**
 * Official Nexa mark (blue curve) — not the old letter "N".
 * SVG with a version query so browsers pick up logo changes quickly.
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
        className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:ring-zinc-700"
        style={{ width: size, height: size }}
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon.svg?v=nexa-mark-2"
          alt=""
          width={size}
          height={size}
          className="h-full w-full object-contain p-[8%]"
          draggable={false}
        />
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
