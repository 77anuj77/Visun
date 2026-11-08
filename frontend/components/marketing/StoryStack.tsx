"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  FileText,
  Lock,
  RefreshCw,
  ShieldCheck,
  Wallet,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  {
    index: "01",
    title: "Ask",
    serif: "out loud.",
    body: "Speak or type a question about a real project. Visun shows the listening state, keeps interim audio off the record, and stores only the transcript you confirm.",
    quote: "What changed on Northwind, and what is still unpaid?",
    tone: "bg-white",
    visual: (
      <div className="rounded-[24px] border border-[#ded9cf] bg-ink p-5 text-canvas">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/50">
            Visun · listening
          </span>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8ce0b4]" />
        </div>
        <div className="mt-5 flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-orange text-ink">
            <MicGlyph />
          </span>
          <span className="flex items-end gap-1" aria-hidden="true">
            {[10, 20, 30, 18, 26, 14, 22, 30, 16].map((height, index) => (
              <span
                key={index}
                className="w-[3px] rounded-full bg-white/65"
                style={{ height }}
              />
            ))}
          </span>
        </div>
        <p className="mt-5 font-serif text-[20px] leading-snug tracking-[-0.01em] text-white/85">
          “{stepsQuote()}”
        </p>
      </div>
    ),
  },
  {
    index: "02",
    title: "Read",
    serif: "the record.",
    body: "Read-only tools pull the agreement, the latest client message, and the invoice state. Every call and result is visible before Visun writes a single sentence.",
    quote: "3 tools · 4 sources · read-only",
    tone: "bg-yellow",
    visual: (
      <div className="rounded-[24px] border border-[#e2c455] bg-white/75 p-4">
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#7b671c]">
          Evidence gathered
        </p>
        <ul className="mt-3 space-y-2">
          {[
            { tool: "read_agreement", result: "5 clauses · v1.3" },
            { tool: "search_messages", result: "Rahul · 2 Nov, 14:10" },
            { tool: "get_pending_payments", result: "INV-1044 · $1,800" },
          ].map((row) => (
            <li
              key={row.tool}
              className="flex items-center justify-between gap-3 rounded-xl border border-[#e6e1d8] bg-white px-3 py-2"
            >
              <span className="flex items-center gap-2 font-mono text-[10px] text-[#5f5a53]">
                <Wrench size={11} className="text-orange" aria-hidden="true" />
                {row.tool}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-[#5f5a53]">
                <Check size={11} className="text-success" aria-hidden="true" />
                {row.result}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[10px] leading-relaxed text-[#7b671c]">
          Sources stay attached to the answer. Nothing is inferred from a blank
          field.
        </p>
      </div>
    ),
  },
  {
    index: "03",
    title: "Approve",
    serif: "the exact step.",
    body: "A draft appears with the recipient, amount, and body spelled out. You can edit it; material edits reset approval. Voice alone can never approve an external action.",
    quote: "Recipient · amount · body",
    tone: "bg-[#f3f0e9]",
    visual: (
      <div className="overflow-hidden rounded-[24px] border border-[#d8d2c7] bg-white">
        <div className="flex items-center justify-between border-b border-[#ece8e0] bg-[#fff9e8] px-4 py-3">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7d5d00]">
            <Lock size={11} aria-hidden="true" /> Awaiting approval
          </span>
          <span className="rounded-full border border-[#ecdba4] bg-[#fff3cf] px-2 py-0.5 font-mono text-[8px] font-semibold text-[#775000]">
            Draft
          </span>
        </div>
        <div className="p-4">
          <p className="text-[13px] font-semibold">Scope-change note to Rahul</p>
          <p className="mt-1 text-[11px] text-muted">
            Northwind · clause NW-C5 · 14 Nov demo
          </p>
          <div className="mt-3 space-y-1 rounded-xl bg-[#fbfaf7] p-3 text-[11px] leading-relaxed text-[#5f5a53]">
            <p>“Login and checkout sit outside the agreed scope.”</p>
            <p className="text-muted">Proposal only · no invoice created</p>
          </div>
          <div className="mt-3 flex gap-2">
            <span className="inline-flex h-8 items-center gap-1 rounded-lg bg-ink px-3 text-[10px] font-semibold text-canvas">
              <ShieldCheck size={10} aria-hidden="true" /> Approve &amp; send
            </span>
            <span className="inline-flex h-8 items-center rounded-lg border border-[#e3ded5] px-3 text-[10px] text-muted">
              Edit draft
            </span>
          </div>
        </div>
      </div>
    ),
  },
  {
    index: "04",
    title: "Verify",
    serif: "the outcome.",
    body: "One idempotent request reaches the provider. The confirmation, timestamp, and activity entry come from the provider response, never from a hopeful UI guess.",
    quote: "Provider-confirmed, not assumed",
    tone: "bg-ink text-canvas",
    visual: (
      <div className="rounded-[24px] border border-white/15 bg-white/[0.06] p-4">
        <ul className="space-y-2.5">
          {[
            { icon: CheckCircle2, text: "Message delivered · gmail-18f2c9a1" },
            { icon: CalendarDays, text: "Calendar hold added · 12 Nov" },
            { icon: Wallet, text: "INV-1044 still $1,800 · Sandbox" },
            { icon: FileText, text: "Activity entry logged" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <li
                key={item.text}
                className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[10.5px] text-white/75"
              >
                <Icon size={12} className="text-[#8ce0b4]" aria-hidden="true" />
                {item.text}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 flex items-center gap-1.5 font-mono text-[8.5px] uppercase tracking-[0.12em] text-white/40">
          <RefreshCw size={10} aria-hidden="true" /> Seeded provider responses
        </p>
      </div>
    ),
  },
] as const;

function stepsQuote() {
  return "What changed on Northwind, and what is still unpaid?";
}

function MicGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

/**
 * ScrollTrigger story. On desktop a single viewport is pinned and the card
 * track translates one step at a time, with a short hold on each card. Nothing
 * is stacked, so cards can never overlap or leave stale transforms behind.
 * Below the desktop breakpoint, and whenever reduced motion is requested, the
 * four steps stay in a plain vertical reading flow with no pinning at all.
 */
export function StoryStack() {
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;

    const viewportEl = viewport.current;
    const trackEl = track.current;
    if (!viewportEl || !trackEl) return;

    let cancelled = false;
    let context: { revert: () => void } | undefined;
    let media:
      | { add: (query: string, callback: () => void) => void; revert: () => void }
      | undefined;
    let reverted = false;
    const revert = () => {
      if (reverted) return;
      reverted = true;
      media?.revert();
      context?.revert();
    };

    void (async () => {
      const gsapModule = await import("gsap");
      const scrollTriggerModule = await import("gsap/ScrollTrigger");
      if (cancelled || !viewportEl.isConnected || !trackEl.isConnected) return;

      const gsap = gsapModule.default;
      const { ScrollTrigger } = scrollTriggerModule;
      gsap.registerPlugin(ScrollTrigger);

      context = gsap.context(() => {
        media = gsap.matchMedia();

        media.add("(min-width: 1024px)", () => {
          const stepHeight = () => viewportEl.clientHeight;
          if (stepHeight() <= 0) return;

          // Four scroll pages of travel: ~55% hold, ~45% slide per step.
          const timeline = gsap.timeline({
            defaults: { ease: "power2.inOut" },
            scrollTrigger: {
              trigger: viewportEl,
              start: "top top+=88",
              end: () => "+=" + stepHeight() * steps.length,
              pin: true,
              pinSpacing: true,
              anticipatePin: 1,
              scrub: 0.65,
              invalidateOnRefresh: true,
            },
          });

          timeline.to({}, { duration: 0.55, ease: "none" });
          for (let index = 1; index < steps.length; index += 1) {
            timeline.to(trackEl, {
              y: () => -index * stepHeight(),
              duration: 0.45,
            });
            timeline.to({}, { duration: 0.55, ease: "none" });
          }
        });
      }, viewportEl);

      if (cancelled) {
        revert();
        return;
      }

      await document.fonts.ready;
      if (cancelled) {
        revert();
        return;
      }
      ScrollTrigger.refresh();
    })();

    return () => {
      cancelled = true;
      revert();
    };
  }, [reduce]);

  return (
    <section className="relative py-16 lg:py-24">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr] lg:items-end">
          <div>
            <h2 className="font-serif text-[clamp(2.6rem,5.6vw,5rem)] leading-[0.98] tracking-[-0.03em] text-ink">
              From a question
              <span className="block font-sans font-semibold italic tracking-[-0.04em]">
                to a finished task.
              </span>
            </h2>
          </div>
          <p className="max-w-md text-[13.5px] leading-relaxed text-[#5f5a53] lg:justify-self-end">
            Four moves, one audit trail. Scroll to follow a single request from
            a spoken question to a provider-verified result.
          </p>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-[1320px] px-5 sm:px-6">
        <div
          ref={viewport}
          className="[--mk-step-h:clamp(500px,78vh,760px)] motion-safe:lg:h-[var(--mk-step-h)] motion-safe:lg:overflow-hidden"
        >
          <div
            ref={track}
            className="space-y-5 motion-safe:lg:flex motion-safe:lg:flex-col motion-safe:lg:space-y-0 motion-safe:lg:will-change-transform"
          >
            {steps.map((step) => (
              <div
                key={step.index}
                className="mk-stack-step flex items-center motion-safe:lg:h-[var(--mk-step-h)] motion-safe:lg:flex-none"
              >
                <article
                  className={cn(
                    "w-full rounded-[32px] border border-[#dcd6cb] p-6 shadow-[0_30px_70px_-34px_rgba(35,31,24,0.45)] sm:p-9",
                    step.tone,
                  )}
                >
                  <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
                    <div>
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "font-mono text-[11px] tracking-[0.14em]",
                            step.index === "04" ? "text-white/45" : "text-[#8f8a80]",
                          )}
                        >
                          {step.index}
                        </span>
                        <span
                          className={cn(
                            "h-px flex-1",
                            step.index === "04" ? "bg-white/15" : "bg-[#cfc9bd]",
                          )}
                        />
                      </div>
                      <h3 className="mt-5 font-sans text-[clamp(2.2rem,5vw,3.8rem)] font-semibold leading-[0.95] tracking-[-0.045em]">
                        {step.title}
                        <br />
                        <span className="font-serif font-normal italic tracking-[-0.02em]">
                          {step.serif}
                        </span>
                      </h3>
                      <p
                        className={cn(
                          "mt-5 max-w-lg text-[13px] leading-relaxed",
                          step.index === "04" ? "text-white/60" : "text-[#5f5a53]",
                        )}
                      >
                        {step.body}
                      </p>
                      <p
                        className={cn(
                          "mt-6 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em]",
                          step.index === "04"
                            ? "border-white/20 text-white/50"
                            : "border-[#cec8bc] text-[#7b756b]",
                        )}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-orange" aria-hidden="true" />
                        {step.quote}
                      </p>
                    </div>
                    {step.visual}
                  </div>
                </article>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1320px] px-5 sm:px-6">
        <p className="mt-6 font-mono text-[9.5px] uppercase tracking-[0.16em] text-[#928c82]">
          Walkthrough uses seeded records · no external action is taken
        </p>
      </div>
    </section>
  );
}
