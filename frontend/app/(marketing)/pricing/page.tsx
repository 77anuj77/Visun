"use client";

import Link from "next/link";
import {
  ArrowRight,
  Check,
  Minus,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { DemoLink, SignUpCta } from "@/components/auth/AuthActions";
import { ClosingCta } from "@/components/marketing/ClosingCta";
import { Faq } from "@/components/marketing/Faq";
import { Kicker, Reveal } from "@/components/marketing/Motion";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Plan data — proposed scope only, no invented prices or quotas              */
/* -------------------------------------------------------------------------- */

type Plan = {
  id: "free" | "pro" | "team";
  name: string;
  price: string;
  priceNote: string;
  summary: string;
  features: string[];
  cta: "demo" | "sales";
  recommended?: boolean;
  tone: "light" | "accent" | "dark";
};

const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    priceNote: "No card · seeded demo",
    summary:
      "Explore the workspace and the approval model with sample records.",
    features: [
      "Basic workspace management",
      "Limited AI assistant interactions",
      "Basic calendar and task management",
      "Single workspace",
      "Seeded demo data",
    ],
    cta: "demo",
    tone: "light",
  },
  {
    id: "pro",
    name: "Pro",
    price: "Let’s talk",
    priceNote: "Pricing not configured",
    summary:
      "Proposed scope for freelancers and solo professionals running real client work.",
    features: [
      "Everything in Free",
      "Expanded AI assistant usage",
      "Voice AI interactions",
      "Smart deadlines and automation",
      "AI-generated reports",
      "Payment and client management",
      "Single workspace, full modules",
    ],
    cta: "sales",
    recommended: true,
    tone: "accent",
  },
  {
    id: "team",
    name: "Team",
    price: "Let’s talk",
    priceNote: "Pricing not configured",
    summary:
      "Proposed scope for small studios that need shared context and team-level reporting.",
    features: [
      "Everything in Pro",
      "Shared workspaces",
      "Team collaboration",
      "Advanced agentic automation",
      "Higher usage · proposed, not metered",
      "Team-level reporting",
      "Central workspace management",
    ],
    cta: "sales",
    tone: "dark",
  },
];

const comparison = [
  {
    group: "Workspace",
    rows: [
      { label: "Workspace management", free: "Basic", pro: "Full", team: "Full + shared" },
      { label: "Calendar and tasks", free: "Basic", pro: "Full", team: "Full" },
      { label: "Shared workspaces", free: "—", pro: "—", team: "Included" },
      { label: "Team collaboration", free: "—", pro: "—", team: "Included" },
    ],
  },
  {
    group: "Assistant",
    rows: [
      { label: "AI assistant interactions", free: "Limited", pro: "Expanded", team: "Higher" },
      { label: "Voice AI", free: "—", pro: "Included", team: "Included" },
      { label: "Smart deadlines", free: "—", pro: "Included", team: "Included" },
      { label: "Agentic automation", free: "—", pro: "Approval-gated", team: "Advanced" },
    ],
  },
  {
    group: "Business",
    rows: [
      { label: "AI-generated reports", free: "—", pro: "Included", team: "Team-level" },
      { label: "Payment tracking", free: "—", pro: "Included", team: "Included" },
      { label: "Client sync", free: "—", pro: "Included", team: "Shared context" },
      { label: "Usage limits", free: "Not configured", pro: "Not configured", team: "Not configured" },
    ],
  },
] as const;

const faq = [
  {
    question: "Can I buy Pro or Team today?",
    answer:
      "Not in this build. Checkout, plan prices, and seat billing are not configured. Both paid cards point to the contact form so you can talk through scope instead of paying for something that does not exist yet.",
  },
  {
    question: "Is the Free plan really free?",
    answer:
      "There is nothing to pay. This build opens the seeded demo without a card. It is a demo workspace, not a metered subscription, and no usage is billed.",
  },
  {
    question: "What counts as an AI interaction?",
    answer:
      "No quota is configured or enforced in this build, so we do not publish a number. “Limited”, “Expanded”, and “Higher” describe proposed relative scope only; they are not enforceable limits.",
  },
  {
    question: "Do paid plans include live PayPal billing?",
    answer:
      "No. PayPal runs in Sandbox mode only. Provider responses are simulated or sandboxed, and no live charge is created anywhere in the product.",
  },
  {
    question: "How does team access work?",
    answer:
      "Clerk authentication exists for individual accounts, but shared workspaces and team roles are not implemented in this build. Treat the Team card as proposed scope, not a shipped entitlement.",
  },
  {
    question: "Can I switch plans later?",
    answer:
      "There is no billing system to switch between. Use the contact form and we will explain what is actually available in the current build.",
  },
] as const;

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function PricingPage() {
  return (
    <>
      <section className="relative overflow-hidden pb-10 pt-10 sm:pt-14 lg:pb-14 lg:pt-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-[430px] max-w-[1320px]"
        >
          <span className="absolute -left-24 top-10 h-64 w-64 rounded-full bg-orange/10 blur-3xl" />
          <span className="absolute right-8 top-0 h-56 w-56 rounded-full bg-yellow/40 blur-3xl" />
        </div>

        <div className="relative mx-auto grid max-w-[1320px] gap-10 px-5 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <Kicker>Plans</Kicker>
            <h1 className="mt-5 font-sans text-[clamp(2.8rem,6.6vw,5.6rem)] font-semibold leading-[0.94] tracking-[-0.045em]">
              Start free.
              <span className="mt-1 block font-serif font-normal italic tracking-[-0.03em] text-orange">
                Scale when the work does.
              </span>
            </h1>
            <p className="mt-5 max-w-lg text-[14px] leading-relaxed text-[#5f5a53]">
              Three working scopes, one approval model. Paid pricing and quotas
              are not configured in this build, so Pro and Team route to a
              conversation rather than a checkout.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <SignUpCta className="group inline-flex h-11 items-center gap-2 rounded-2xl border border-[#e24f00] bg-orange px-5 text-[13px] font-semibold text-ink shadow-[0_14px_30px_-14px_rgba(255,90,0,0.85)] transition hover:bg-[#ff6d1f] active:translate-y-px">
                Get started
                <ArrowRight
                  size={14}
                  aria-hidden="true"
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </SignUpCta>
              <Link
                href="/contact?inquiry=sales"
                className="inline-flex h-11 items-center rounded-2xl border border-[#d9d4ca] bg-white/80 px-5 text-[13px] font-medium text-ink transition hover:border-[#c8c1b4] hover:bg-white active:translate-y-px"
              >
                Talk to sales
              </Link>
            </div>
          </div>

          <Reveal delay={0.1}>
            <div className="relative mx-auto max-w-[340px] rotate-[2deg]">
              <div className="rounded-[26px] border border-[#e2c455] bg-yellow p-5 shadow-[0_30px_60px_-28px_rgba(35,31,24,0.45)]">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[#7b671c]">
                    Current build
                  </span>
                  <Wallet size={14} className="text-[#7b671c]" aria-hidden="true" />
                </div>
                <p className="mt-4 font-serif text-[46px] leading-none tracking-[-0.03em] text-ink">
                  $0
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-[#6b581b]">
                  The seeded demo is open without a card. No subscription is
                  active, and no usage is metered.
                </p>
                <div className="mt-4 space-y-1.5 border-t border-[#8a6d00]/25 pt-3 text-[10px] text-[#6b581b]">
                  {[
                    "Billing not configured",
                    "PayPal Sandbox only",
                    "Proposed plan scope, not entitlements",
                  ].map((line) => (
                    <p key={line} className="flex items-center gap-1.5">
                      <Sparkles size={10} aria-hidden="true" />
                      {line}
                    </p>
                  ))}
                </div>
              </div>
              <div
                aria-hidden="true"
                className="absolute -bottom-3 -right-3 -z-10 h-full w-full rounded-[26px] border border-[#d8d2c7] bg-white/70"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Honest pricing disclosure */}
      <section className="mx-auto max-w-[1320px] px-5 pt-2 sm:px-6">
        <div className="flex items-start gap-2.5 rounded-2xl border border-[#e6dfae] bg-yellow/60 px-4 py-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#7b671c] text-yellow">
            <Check size={11} aria-hidden="true" />
          </span>
          <p className="text-[11.5px] leading-relaxed text-[#6d5a13]">
            <strong className="font-semibold">Pricing disclosure:</strong> billing
            is not configured in this build. “$0” is the only real price shown.
            Pro and Team display “Let’s talk” because no plan price, quota, or
            checkout exists. The feature lists below describe proposed scope
            only.
          </p>
        </div>
      </section>

      {/* Plans */}
      <section className="mx-auto max-w-[1320px] px-5 py-10 sm:px-6 lg:py-14">
        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan, index) => (
            <Reveal key={plan.id} delay={index * 0.07} className="h-full">
              <article
                className={cn(
                  "relative flex h-full flex-col rounded-[28px] border p-5 sm:p-6",
                  plan.tone === "light" &&
                    "border-[#ded9cf] bg-white/85 shadow-[0_24px_50px_-30px_rgba(35,31,24,0.35)]",
                  plan.tone === "accent" &&
                    "border-[#e24f00] bg-orange shadow-[0_34px_70px_-30px_rgba(255,90,0,0.7)]",
                  plan.tone === "dark" &&
                    "border-black bg-ink text-canvas shadow-[0_34px_70px_-32px_rgba(0,0,0,0.65)]",
                )}
              >
                {plan.recommended ? (
                  <span className="absolute -top-3 left-5 inline-flex items-center gap-1 rounded-full border border-[#7b2c00] bg-ink px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-yellow">
                    <Sparkles size={9} aria-hidden="true" />
                    Recommended
                  </span>
                ) : null}

                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-[15px] font-semibold tracking-tight">
                      {plan.name}
                    </h2>
                    <p
                      className={cn(
                        "mt-1 text-[11px] leading-relaxed",
                        plan.tone === "dark" ? "text-white/55" : "text-[#6f6a62]",
                        plan.tone === "accent" && "text-[#6a2708]",
                      )}
                    >
                      {plan.summary}
                    </p>
                  </div>
                  {plan.id === "team" ? (
                    <Users size={17} className="shrink-0 text-white/50" aria-hidden="true" />
                  ) : null}
                </div>

                <div className="mt-5 flex items-end gap-2">
                  <p
                    className={cn(
                      "font-serif text-[38px] leading-none tracking-[-0.03em]",
                      plan.id !== "free" && "text-[30px]",
                    )}
                  >
                    {plan.price}
                  </p>
                  <p
                    className={cn(
                      "pb-1 font-mono text-[8.5px] uppercase tracking-[0.1em]",
                      plan.tone === "dark" ? "text-white/45" : "text-[#8f8a80]",
                      plan.tone === "accent" && "text-[#6a2708]/70",
                    )}
                  >
                    {plan.priceNote}
                  </p>
                </div>

                <ul className="mt-5 space-y-2 border-t border-current/10 pt-4">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className={cn(
                        "flex items-start gap-2 text-[11.5px] leading-relaxed",
                        plan.tone === "dark" ? "text-white/70" : "text-[#5f5a53]",
                        plan.tone === "accent" && "text-[#5e2200]",
                      )}
                    >
                      <Check
                        size={12}
                        aria-hidden="true"
                        className={cn(
                          "mt-0.5 shrink-0",
                          plan.tone === "dark" ? "text-[#8ce0b4]" : "text-success",
                          plan.tone === "accent" && "text-ink",
                        )}
                      />
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-5">
                  {plan.cta === "demo" ? (
                    <DemoLink className="group flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-[#d9d4ca] bg-white text-[12.5px] font-semibold text-ink transition hover:border-[#bfb8ab] active:translate-y-px">
                      Open the demo
                      <ArrowRight
                        size={13}
                        aria-hidden="true"
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                    </DemoLink>
                  ) : (
                    <Link
                      href={`/contact?inquiry=sales&plan=${plan.id}`}
                      className={cn(
                        "group flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-[12.5px] font-semibold transition active:translate-y-px",
                        plan.tone === "accent"
                          ? "border border-black bg-ink text-canvas hover:bg-[#2a2a2a]"
                          : "border border-white/20 bg-white text-ink hover:bg-white/90",
                      )}
                    >
                      Contact sales
                      <ArrowRight
                        size={13}
                        aria-hidden="true"
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                    </Link>
                  )}
                  <p
                    className={cn(
                      "mt-2 text-center font-mono text-[7.5px] uppercase tracking-[0.1em]",
                      plan.tone === "dark" ? "text-white/35" : "text-[#8f8a80]",
                      plan.tone === "accent" && "text-[#6a2708]/60",
                    )}
                  >
                    Proposed scope · not billed
                  </p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section className="border-y border-[#e3ddd3] bg-[#f2efe9] py-14 lg:py-20">
        <div className="mx-auto max-w-[1320px] px-5 sm:px-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <Kicker>Side by side</Kicker>
              <h2 className="mt-4 font-serif text-[clamp(2.2rem,4.4vw,3.6rem)] leading-[1] tracking-[-0.025em]">
                Compare the
                <span className="italic text-orange"> proposed scope.</span>
              </h2>
            </div>
            <p className="max-w-sm text-[11.5px] leading-relaxed text-[#6f6a62]">
              These rows describe intended plan differences. They are not
              enforced entitlements, and no quota is metered in this build.
            </p>
          </div>

          <div className="mt-7 overflow-x-auto rounded-[24px] border border-[#ded8ce] bg-white/80">
            <div className="min-w-[620px]">
              <div className="grid grid-cols-[1.55fr_repeat(3,1fr)] border-b border-[#e5e0d7] bg-[#faf9f6] px-4 py-3">
                <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[#8f8a80]">
                  Capability
                </span>
                {plans.map((plan) => (
                  <span
                    key={plan.id}
                    className="text-center font-mono text-[8.5px] uppercase tracking-[0.14em] text-[#8f8a80]"
                  >
                    {plan.name}
                  </span>
                ))}
              </div>

              {comparison.map((group) => (
                <div key={group.group}>
                  <div className="grid grid-cols-[1.55fr_repeat(3,1fr)] border-b border-[#ece8e0] bg-[#f6f3ed] px-4 py-2">
                    <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#a39d93]">
                      {group.group}
                    </span>
                    <span />
                    <span />
                    <span />
                  </div>
                  {group.rows.map((row) => (
                    <div
                      key={row.label}
                      className="grid grid-cols-[1.55fr_repeat(3,1fr)] items-center border-b border-[#ece8e0] px-4 py-2.5 last:border-b-0"
                    >
                      <span className="text-[11.5px] font-medium text-ink">
                        {row.label}
                      </span>
                      {[row.free, row.pro, row.team].map((value, index) => (
                        <span
                          key={`${row.label}-${index}`}
                          className={cn(
                            "text-center text-[10.5px]",
                            value === "—" ? "text-[#c2bcb1]" : "text-[#5f5a53]",
                          )}
                        >
                          {value === "—" ? (
                            <Minus
                              size={11}
                              className="mx-auto text-[#c2bcb1]"
                              aria-label="Not included in the proposed scope"
                            />
                          ) : (
                            value
                          )}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <p className="mt-3 font-mono text-[8.5px] uppercase tracking-[0.14em] text-[#928c82]">
            Proposed scope · billing, quotas, and shared workspaces are not
            configured
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-[1320px] px-5 py-14 sm:px-6 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
          <div>
            <Kicker>Questions</Kicker>
            <h2 className="mt-4 font-sans text-[clamp(2rem,3.8vw,3rem)] font-semibold leading-[1.02] tracking-[-0.035em]">
              Straight answers
              <span className="block font-serif font-normal italic tracking-[-0.02em] text-orange">
                about what ships.
              </span>
            </h2>
            <p className="mt-4 max-w-xs text-[12.5px] leading-relaxed text-[#6f6a62]">
              If something is not configured, it says so here first. No
              invented checkout, no imaginary invoice.
            </p>
            <Link
              href="/contact"
              className="group mt-5 inline-flex items-center gap-1.5 text-[12px] font-medium text-ink underline decoration-[#c8c1b5] underline-offset-4 transition hover:decoration-orange"
            >
              Ask a different question
              <ArrowRight
                size={12}
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </div>

          <div className="rounded-[24px] border border-[#ded9cf] bg-white/85 px-4 py-1 sm:px-6">
            <Faq items={faq.map((item) => ({ ...item }))} />
          </div>
        </div>
      </section>

      <ClosingCta
        title={
          <>
            Start with the demo.
            <span className="block font-serif italic">Then decide on scope.</span>
          </>
        }
        copy="The seeded workspace costs nothing and needs no card. If a paid plan matters to you, tell us what the studio actually needs first."
        secondaryHref="/contact"
        secondaryLabel="Talk to us"
      />
    </>
  );
}
