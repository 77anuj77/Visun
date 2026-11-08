import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { DemoLink, SignUpCta } from "@/components/auth/AuthActions";

/**
 * Shared closing band for the three marketing pages. Copy stays factual:
 * the demo is seeded, and nothing is billed or sent from the marketing site.
 */
export function ClosingCta({
  title,
  copy,
  secondaryHref = "/pricing",
  secondaryLabel = "Compare plans",
}: {
  title: ReactNode;
  copy: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <section className="mx-auto max-w-[1320px] px-5 pb-16 pt-4 sm:px-6 lg:pb-24">
      <div className="relative overflow-hidden rounded-[32px] border border-[#e24f00] bg-orange px-6 py-10 shadow-[0_34px_80px_-36px_rgba(255,90,0,0.75)] sm:px-10 lg:px-14 lg:py-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full border-[12px] border-[#ff8a4d]/50"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-yellow/40 blur-2xl"
        />

        <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-[#6a2708]">
              Start with the record you already have
            </p>
            <h2 className="mt-4 max-w-[18ch] font-serif text-[clamp(2.4rem,5.4vw,4.6rem)] leading-[0.96] tracking-[-0.03em] text-ink">
              {title}
            </h2>
            <p className="mt-4 max-w-md text-[13.5px] leading-relaxed text-[#5e2200]">
              {copy}
            </p>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row lg:flex-col lg:items-stretch">
            <SignUpCta className="group inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-black bg-ink px-5 text-[13.5px] font-semibold text-canvas transition hover:bg-[#2a2a2a] active:translate-y-px">
              Get started
              <ArrowRight
                size={15}
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-0.5"
              />
            </SignUpCta>
            <DemoLink className="group inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#b94300]/40 bg-white/80 px-5 text-[13.5px] font-medium text-ink transition hover:bg-white active:translate-y-px">
              Open the demo
              <ArrowUpRight
                size={15}
                aria-hidden="true"
                className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              />
            </DemoLink>
            <Link
              href={secondaryHref}
              className="inline-flex h-9 items-center justify-center gap-1 text-[12px] font-medium text-[#6a2708] underline decoration-[#b94300]/40 underline-offset-4 transition hover:text-ink"
            >
              {secondaryLabel}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
