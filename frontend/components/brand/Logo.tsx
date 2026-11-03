import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn("relative block h-9 w-9 shrink-0", className)}
      aria-hidden="true"
    >
      <span className="absolute left-0 top-1 h-6 w-6 rounded-[8px] border border-[#e1c356] bg-yellow" />
      <span className="absolute left-1 top-0 h-7 w-7 rotate-6 rounded-[9px] border border-[#e24f00] bg-orange" />
      <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-[9px] border border-black bg-ink font-serif text-[15px] leading-none text-canvas">
        v
      </span>
    </span>
  );
}

export function Logo({
  href = "/",
  withWordmark = true,
  className,
  onClick,
}: {
  href?: string;
  withWordmark?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "group inline-flex items-center gap-2.5 rounded-lg",
        className,
      )}
      aria-label="Visun home"
    >
      <LogoMark className="transition-transform duration-300 group-hover:-rotate-3" />
      {withWordmark ? (
        <span className="font-serif text-[26px] leading-none tracking-[-0.02em] text-ink">
          visun<span className="text-orange">.</span>
        </span>
      ) : null}
    </Link>
  );
}
