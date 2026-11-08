"use client";

import Link from "next/link";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CircleDollarSign,
  FileText,
  Mic,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { SignInCta, SignUpCta } from "@/components/auth/AuthActions";
import { LogoMark } from "@/components/brand/Logo";
import { AgentPreview } from "@/components/marketing/AgentPreview";
import { ClosingCta } from "@/components/marketing/ClosingCta";
import { FlipWord, Kicker, Reveal } from "@/components/marketing/Motion";
import { StickerSheet } from "@/components/marketing/StickerSheet";
import { StoryStack } from "@/components/marketing/StoryStack";

/* -------------------------------------------------------------------------- */
/* Hero                                                                       */
/* -------------------------------------------------------------------------- */

function Hero() {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const slow = useTransform(scrollY, [0, 720], [0, -44]);
  const fast = useTransform(scrollY, [0, 720], [0, 30]);

  return (
    <section className="relative overflow-hidden pb-8 pt-10 sm:pt-14 lg:pb-14 lg:pt-20">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-[540px] max-w-[1320px]"
      >
        <span className="absolute -left-16 top-6 h-56 w-56 rounded-full bg-yellow/30 blur-3xl" />
        <span className="absolute right-0 top-24 h-72 w-72 rounded-full bg-orange/15 blur-3xl" />
      </div>

      <div className="relative mx-auto grid max-w-[1320px] items-center gap-12 px-5 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10">
        <div>
          <Kicker>Voice-first operations</Kicker>

          <h1 className="mt-5 font-sans text-[clamp(2.9rem,7.3vw,6.4rem)] font-semibold leading-[0.92] tracking-[-0.045em] text-ink">
            <span className="block">Your studio,</span>
            <span className="mt-1 block font-serif font-normal italic tracking-[-0.03em] text-orange">
              finally{" "}
              <FlipWord
                words={["in sync.", "on time.", "paid up.", "in one place."]}
                widthWord="in one place."
              />
            </span>
          </h1>

          <p className="mt-6 max-w-[30rem] text-[14.5px] leading-relaxed text-[#5f5a53]">
            Ask about a deadline, an invoice, or a client request. Visun reads
            the real record, drafts the exact action, and waits for your
            approval before anything leaves the workspace.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            <SignUpCta className="group inline-flex h-12 items-center gap-2 rounded-2xl border border-[#e24f00] bg-orange px-5 text-[13.5px] font-semibold text-ink shadow-[0_16px_34px_-14px_rgba(255,90,0,0.85)] transition hover:bg-[#ff6d1f] active:translate-y-px">
              Get started
              <ArrowRight
                size={15}
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-0.5"
              />
            </SignUpCta>
            <SignInCta className="inline-flex h-12 items-center rounded-2xl border border-[#d9d4ca] bg-white/80 px-5 text-[13.5px] font-medium text-ink transition hover:border-[#c8c1b4] hover:bg-white active:translate-y-px">
              Sign in
            </SignInCta>
            <a
              href="#features"
              className="group inline-flex h-12 items-center gap-2 rounded-2xl px-3 text-[12.5px] font-medium text-[#5f5a53] transition hover:text-ink"
            >
              Explore features
              <ArrowRight
                size={13}
                aria-hidden="true"
                className="rotate-90 transition-transform group-hover:translate-y-0.5"
              />
            </a>
          </div>

          <ul className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10.5px] text-[#7a756c]">
            {[
              "No card required",
              "Seeded demo available",
              "PayPal Sandbox only",
            ].map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <Check size={11} className="text-success" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <motion.div
          style={{ y: reduce ? 0 : slow }}
          className="relative mx-auto w-full max-w-[540px]"
        >
          <HeroBoard fastY={reduce ? 0 : fast} />
        </motion.div>
      </div>
    </section>
  );
}

function HeroBoard({ fastY }: { fastY: MotionValue<number> | number }) {
  return (
    <div className="relative h-[500px] w-full sm:h-[540px]" aria-hidden="true">
      {/* Dark agent card */}
      <div className="animate-float absolute right-0 top-0 w-[84%] max-w-[430px] [--float-rotate:-3deg]">
        <div className="rounded-[26px] border border-black bg-ink p-4 text-canvas shadow-[0_34px_64px_-30px_rgba(0,0,0,0.7)] sm:p-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <LogoMark className="h-7 w-7 scale-90" />
              <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/45">
                Visun · agent preview
              </span>
            </span>
            <span className="flex h-1.5 w-1.5 animate-pulse rounded-full bg-[#8ce0b4]" />
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.06] p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange text-ink">
              <Mic size={15} />
            </span>
            <span className="flex items-end gap-[3px]">
              {[9, 18, 27, 13, 22, 11, 29, 16, 24, 12].map((height, index) => (
                <span
                  key={index}
                  className="w-[3px] rounded-full bg-white/60"
                  style={{ height }}
                />
              ))}
            </span>
            <span className="ml-auto font-mono text-[8px] uppercase tracking-[0.1em] text-white/40">
              Listening
            </span>
          </div>

          <p className="mt-3.5 font-serif text-[18px] leading-snug text-white/90">
            “What changed on Northwind, and what is still unpaid?”
          </p>
          <p className="mt-2 text-[10px] leading-relaxed text-white/45">
            Read-only checks first. A draft appears. Nothing is sent until you
            approve it.
          </p>
        </div>
      </div>

      {/* Yellow milestone ticket */}
      <div className="animate-float absolute left-0 top-[228px] w-[62%] max-w-[320px] [--float-rotate:3deg] [animation-delay:1.4s]">
        <div className="relative rounded-[20px] border border-[#e2c455] bg-yellow p-4 text-ink shadow-[0_24px_44px_-22px_rgba(35,31,24,0.4)]">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-2 rounded-[13px] border border-dashed border-[#8a6d00]/30"
          />
          <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#7b671c]">
            This week · seeded
          </p>
          <ul className="mt-2.5 space-y-1.5 text-[10.5px]">
            {[
              { label: "Northwind review", meta: "Thu · 15:00", done: true },
              { label: "INV-1044 follow-up", meta: "Unpaid", done: false },
              { label: "Onboarding call", meta: "Fri · 11:00", done: false },
            ].map((row) => (
              <li
                key={row.label}
                className="flex items-center justify-between gap-2 rounded-lg bg-white/55 px-2 py-1.5"
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      row.done ? "bg-[#237a53]" : "bg-[#a3700a]"
                    }`}
                  />
                  {row.label}
                </span>
                <span className="font-mono text-[7.5px] uppercase tracking-[0.08em] text-[#6f5c20]">
                  {row.meta}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Payments card with gentle counter-parallax */}
      <motion.div
        style={{ y: fastY }}
        className="absolute right-0 top-[336px] w-[58%] max-w-[300px] rotate-[-2deg]"
      >
        <div className="rounded-[22px] border border-[#ded9cf] bg-white p-4 shadow-[0_26px_50px_-24px_rgba(35,31,24,0.35)]">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#8f8a80]">
              Payments · sandbox
            </p>
            <Wallet size={12} className="text-orange" aria-hidden="true" />
          </div>
          <p className="mt-2 text-[20px] font-semibold leading-none tracking-tight">
            $1,800
          </p>
          <p className="mt-1 text-[9.5px] text-[#7a756c]">
            INV-1044 · unpaid · due 15 Nov
          </p>
          <div className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-[#fff4e3] px-2 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#986000]" />
            <span className="font-mono text-[7.5px] uppercase tracking-[0.1em] text-[#986000]">
              Provider state verified
            </span>
          </div>
        </div>
      </motion.div>

      {/* Approval badge */}
      <div className="absolute bottom-1 left-[7%] flex items-center gap-2 rounded-full border border-[#dcd6cc] bg-white/90 px-3 py-2 shadow-[0_18px_36px_-18px_rgba(35,31,24,0.35)] backdrop-blur">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#e5f3ec] text-[#1c6142]">
          <ShieldCheck size={12} />
        </span>
        <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-[#6f6a62]">
          Approval required
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Marquee                                                                    */
/* -------------------------------------------------------------------------- */

const marqueeItems = [
  "Voice AI",
  "Smart deadlines",
  "Payment tracking",
  "Client sync",
  "AI reports",
  "Agentic automation",
] as const;

function Marquee() {
  return (
    <div className="border-y border-[#e4dfd6] bg-[#f2efe9] py-4">
      <div className="mk-marquee flex w-max items-center whitespace-nowrap px-4">
        {[0, 1].map((copy) => (
          <ul key={copy} className="flex items-center gap-8 pr-8" aria-hidden={copy === 1}>
            {marqueeItems.map((item) => (
              <li key={item} className="flex items-center gap-8">
                <span className="font-serif text-[19px] italic tracking-tight text-ink">
                  {item}
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-orange" />
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Guardrails                                                                 */
/* -------------------------------------------------------------------------- */

const guardrails = [
  {
    index: "01",
    title: "Read before write",
    body: "Every question starts with read-only tools. You can inspect each call and its result before a sentence is drafted.",
    icon: FileText,
  },
  {
    index: "02",
    title: "Approval, not autonomy",
    body: "External actions wait behind a deliberate click. A material edit resets the gate, and voice alone can never approve.",
    icon: ShieldCheck,
  },
  {
    index: "03",
    title: "Provider-verified",
    body: "Confirmations, timestamps, and references come from the provider response — not from a hopeful UI guess.",
    icon: Sparkles,
  },
  {
    index: "04",
    title: "Honest about gaps",
    body: "When a calendar, source, or payment state is not connected, Visun says so. It never fills a blank with a guess.",
    icon: MessageSquareText,
  },
] as const;

function Guardrails() {
  return (
    <section className="border-y border-[#e3ddd3] bg-[#f2efe9] py-16 lg:py-20">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-6">
        <div className="grid gap-5 lg:grid-cols-[0.78fr_1.22fr] lg:items-start lg:gap-12">
          <div>
            <Kicker>Proof of control</Kicker>
            <h2 className="mt-4 max-w-[15ch] font-serif text-[clamp(2.3rem,4.4vw,3.7rem)] leading-[0.98] tracking-[-0.025em]">
              Nothing happens
              <span className="block italic text-orange">behind your back.</span>
            </h2>
            <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-[#5f5a53]">
              This is not a black box with a friendly voice. The same timeline
              holds the tool calls, sources, draft, approval, and final
              provider response.
            </p>
            <Link
              href="/app?demo=1"
              className="group mt-5 inline-flex items-center gap-2 text-[12px] font-medium text-ink underline decoration-[#c8c1b5] underline-offset-4 transition hover:decoration-orange"
            >
              Walk through the seeded demo
              <ArrowUpRight
                size={13}
                aria-hidden="true"
                className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              />
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {guardrails.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.index}
                  className="group rounded-[22px] border border-[#ded8ce] bg-white/75 p-4 transition duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-neu-md sm:p-5"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e6e1d8] bg-[#faf9f6] text-[#6f6a62]">
                      <Icon size={14} aria-hidden="true" />
                    </span>
                    <span className="font-mono text-[9px] tracking-[0.14em] text-[#a39d93]">
                      {item.index}
                    </span>
                  </div>
                  <h3 className="mt-4 text-[14px] font-semibold tracking-tight">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-[#6f6a62]">
                    {item.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Prompts                                                                    */
/* -------------------------------------------------------------------------- */

const prompts = [
  {
    prompt: "What is due today?",
    label: "Deadlines",
    outcome: "Stored milestones only, with the project and timezone shown.",
    icon: CalendarDays,
  },
  {
    prompt: "How much is still unpaid?",
    label: "Money",
    outcome: "Invoice-level breakdown reconciled against PayPal Sandbox.",
    icon: CircleDollarSign,
  },
  {
    prompt: "What changed on Rahul’s project?",
    label: "Scope",
    outcome: "The client message, the matching clause, and the confidence.",
    icon: ShieldCheck,
  },
  {
    prompt: "Draft a reminder for the overdue invoice.",
    label: "Follow-up",
    outcome: "An editable draft that sends nothing until you approve it.",
    icon: MessageSquareText,
  },
  {
    prompt: "Who are today’s new leads?",
    label: "Pipeline",
    outcome: "Workspace lead records, or a clear “no source connected”.",
    icon: Users,
  },
  {
    prompt: "Generate this week’s Northwind report.",
    label: "Reporting",
    outcome: "A report built from milestones, invoices, and activity.",
    icon: FileText,
  },
] as const;

function Prompts() {
  return (
    <section className="py-16 lg:py-24">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <Kicker>Built for real work</Kicker>
            <h2 className="mt-4 max-w-[18ch] font-sans text-[clamp(2.1rem,4.4vw,3.8rem)] font-semibold leading-[1.03] tracking-[-0.035em]">
              Ask the question
              <span className="ml-2 font-serif font-normal italic tracking-[-0.02em] text-orange">
                you actually have.
              </span>
            </h2>
          </div>
          <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-[#dcd7cd] bg-white/70 px-3 py-1.5 text-[10.5px] text-[#6f6a62] sm:self-auto">
            <span className="h-1.5 w-1.5 rounded-full bg-orange" />
            Each opens the seeded demo
          </span>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {prompts.map((item, index) => {
            const Icon = item.icon;
            return (
              <Reveal key={item.prompt} delay={index * 0.05} className="h-full">
                <Link
                  href={`/app/copilot?demo=1&prompt=${encodeURIComponent(item.prompt)}`}
                  className="group flex h-full flex-col rounded-[20px] border border-[#e0dbd2] bg-white/75 p-4 transition duration-300 hover:-translate-y-1 hover:border-[#cfc8bc] hover:bg-white hover:shadow-neu-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e6e1d8] bg-[#f8f7f3] text-[#6f6a62]">
                      <Icon size={14} aria-hidden="true" />
                    </span>
                    <span className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-[#a39d92]">
                      {item.label}
                    </span>
                  </div>
                  <p className="mt-3 text-[13.5px] font-semibold leading-snug transition group-hover:text-orange">
                    “{item.prompt}”
                  </p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-[#6f6a62]">
                    {item.outcome}
                  </p>
                  <span className="mt-auto flex items-center gap-1 pt-3 text-[10px] font-medium text-[#6f6a62] transition group-hover:text-ink">
                    Ask Visun
                    <ArrowUpRight
                      size={11}
                      aria-hidden="true"
                      className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    />
                  </span>
                </Link>
              </Reveal>
            );
          })}
        </div>

        <p className="mt-6 font-mono text-[9px] uppercase tracking-[0.16em] text-[#928c82]">
          Sample prompts · results come from the seeded demo workspace
        </p>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function LandingPage() {
  return (
    <>
      <Hero />
      <Marquee />
      <StickerSheet />
      <AgentPreview />
      <StoryStack />
      <Guardrails />
      <Prompts />
      <ClosingCta
        title={
          <>
            Give your studio
            <span className="block font-serif italic">a second pair of hands.</span>
          </>
        }
        copy="Open the seeded workspace, ask one real question, and approve the exact next step. No card, no live charge, no mystery automation."
      />
    </>
  );
}
