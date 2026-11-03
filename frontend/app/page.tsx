"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Code2,
  Lock,
  Menu,
  MessageSquareText,
  Mic,
  Pause,
  Play,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Small helpers                                                              */
/* -------------------------------------------------------------------------- */

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function SectionMarker({ index, children }: { index: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[11px] text-orange">[{index}]</span>
      <span className="eyebrow">{children}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Header                                                                     */
/* -------------------------------------------------------------------------- */

const navLinks = [
  { href: "#product", label: "Product" },
  { href: "#how", label: "How it works" },
  { href: "#trust", label: "Trust" },
  { href: "#use-cases", label: "Use cases" },
];

function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-[#e4e0d8] bg-canvas/92 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-[76px] max-w-[1320px] items-center gap-4 px-5 sm:px-6">
        <Logo href="/" />

        <nav className="ml-6 hidden items-center gap-1 lg:flex" aria-label="Marketing">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-[13px] font-medium text-[#5a564f] transition hover:bg-white/70 hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 sm:flex">
          <a
            href="https://github.com/77anuj77/Visun"
            target="_blank"
            rel="noreferrer"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e0dbd2] bg-white/60 text-muted transition hover:border-[#cfc8bc] hover:text-ink"
            aria-label="Open the GitHub repository"
          >
            <Code2 size={16} />
          </a>
          <Link
            href="/app"
            className="rounded-xl px-3 py-2 text-[13px] font-medium text-[#5a564f] transition hover:text-ink"
          >
            Sign in
          </Link>
          <Link
            href="/app"
            className="group inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#e24f00] bg-orange px-4 text-[13px] font-semibold text-ink shadow-[0_8px_20px_-8px_rgba(255,90,0,0.75)] transition hover:bg-[#ff6d1f]"
          >
            Get started
            <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
          </Link>
        </div>

        <button
          onClick={() => setOpen((value) => !value)}
          className="ml-auto flex h-10 w-10 items-center justify-center rounded-xl border border-[#e0dbd2] bg-white/70 text-ink sm:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden border-t border-[#e4e0d8] bg-canvas sm:hidden"
          >
            <nav className="flex flex-col gap-1 px-5 py-4" aria-label="Marketing mobile">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-2 py-3 text-sm font-medium text-[#5a564f] hover:bg-white hover:text-ink"
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-2 flex gap-2">
                <Link
                  href="/app"
                  onClick={() => setOpen(false)}
                  className="flex h-11 flex-1 items-center justify-center rounded-xl bg-ink text-sm font-medium text-canvas"
                >
                  Open the demo
                </Link>
                <a
                  href="https://github.com/77anuj77/Visun"
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#e0dbd2] bg-white"
                  aria-label="GitHub"
                >
                  <Code2 size={16} />
                </a>
              </div>
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero                                                                       */
/* -------------------------------------------------------------------------- */

function HeroArt() {
  return (
    <div className="relative mx-auto h-[420px] w-full max-w-[560px] sm:h-[470px]" aria-hidden="true">
      <div className="absolute left-[1%] top-[7%] h-[37%] w-[48%] -rotate-[6deg] rounded-[24px] border border-[#e2c455] bg-yellow p-4 shadow-[0_22px_45px_-20px_rgba(0,0,0,0.35)] [--float-rotate:-6deg] animate-float">
        <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-[#6c5a12]">
          Pipeline · today
        </p>
        <p className="mt-2 text-[26px] font-semibold leading-none tracking-tight text-ink">
          $8,800
        </p>
        <div className="mt-3 flex h-8 items-end gap-1.5">
          {[30, 48, 36, 62, 78, 54, 88].map((height, index) => (
            <span
              key={index}
              className={cn(
                "w-2 rounded-full",
                index === 6 ? "bg-ink" : "bg-[#d8b73f]/70",
              )}
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
        <p className="mt-2 text-[9px] font-medium text-[#7b671c]">2 new leads today</p>
      </div>

      <div className="absolute right-[2%] top-[1%] h-[31%] w-[51%] rotate-[4deg] rounded-[24px] border border-[#e24f00] bg-orange p-4 shadow-[0_24px_50px_-22px_rgba(255,90,0,0.75)] [--float-rotate:4deg] animate-float [animation-delay:1.4s]">
        <div className="flex items-start justify-between">
          <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-[#5e2200]">
            Outstanding
          </p>
          <span className="rounded-full border border-[#6d2800]/25 bg-[#ffb98d]/55 px-1.5 py-0.5 text-[7.5px] font-semibold text-[#5e2200]">
            Sandbox
          </span>
        </div>
        <p className="mt-2 text-[28px] font-semibold leading-none tracking-tight text-ink">
          $3,200
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1">
          {["INV-1044", "INV-1045", "INV-1043"].map((invoice) => (
            <span
              key={invoice}
              className="rounded-md border border-[#6d2800]/20 bg-[#ffd8bd]/50 px-1.5 py-0.5 font-mono text-[7.5px] text-[#5e2200]"
            >
              {invoice}
            </span>
          ))}
        </div>
      </div>

      <div className="absolute left-[8%] top-[47%] h-[29%] w-[49%] rotate-[2deg] rounded-[24px] border border-black bg-ink p-4 text-canvas shadow-[0_26px_55px_-24px_rgba(0,0,0,0.7)] [--float-rotate:2deg] animate-float [animation-delay:2.6s]">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-white/50">
            Visun · listening
          </p>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8ce0b4]" />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange text-ink">
            <Mic size={16} />
          </span>
          <span className="flex items-end gap-[3px]">
            {[12, 22, 30, 18, 26, 14, 20].map((height, index) => (
              <span
                key={index}
                className="w-[3px] rounded-full bg-white/70"
                style={{ height }}
              />
            ))}
          </span>
        </div>
        <p className="mt-3 text-[10.5px] leading-snug text-white/70">
          “What changed on Rahul’s project, and what’s still unpaid?”
        </p>
      </div>

      <div className="absolute bottom-[1%] right-[1%] h-[35%] w-[57%] -rotate-[3deg] rounded-[24px] border border-[#ddd8cf] bg-white p-4 shadow-[0_28px_60px_-26px_rgba(0,0,0,0.45)] [--float-rotate:-3deg] animate-float [animation-delay:0.7s]">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow text-ink">
            <ShieldCheck size={11} />
          </span>
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[#7d5d00]">
            Awaiting approval
          </p>
        </div>
        <p className="mt-2 text-[11.5px] font-semibold text-ink">Overdue invoice reminder</p>
        <p className="mt-0.5 text-[9.5px] text-muted">daniel@okaforlegal.com · $800</p>
        <div className="mt-3 flex items-center gap-1.5">
          <span className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#e24f00] bg-orange px-2.5 text-[9px] font-semibold text-ink">
            <Lock size={9} /> Approve &amp; send
          </span>
          <span className="rounded-lg border border-[#e3ded5] px-2 py-1.5 text-[9px] font-medium text-muted">
            Edit
          </span>
        </div>
        <p className="mt-2 text-[8px] text-muted">Demo only — nothing leaves the browser.</p>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 paper opacity-[0.35]" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -right-32 -top-40 h-[520px] w-[520px] rounded-full bg-orange/[0.08] blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -left-40 top-40 h-[420px] w-[420px] rounded-full bg-yellow/20 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-[1320px] px-5 pb-14 pt-10 sm:px-6 sm:pt-16 lg:pb-20 lg:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:gap-8">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="eyebrow text-[#55514a]">Visun</span>
              <span className="h-1 w-1 rounded-full bg-orange" />
              <span className="eyebrow">The freelance operating system</span>
            </div>

            <h1 className="display mt-5 text-[clamp(3.1rem,7vw,6.4rem)] text-balance">
              Freelance work
              <br className="hidden sm:block" /> moves fast.{" "}
              <span className="relative inline-block">
                <span className="relative z-10 italic">Stay ahead of it.</span>
                <span
                  className="absolute inset-x-0 bottom-1 z-0 h-[26%] -rotate-[0.6deg] bg-yellow/80"
                  aria-hidden="true"
                />
              </span>
            </h1>

            <p className="mt-6 max-w-[36rem] text-[15.5px] leading-relaxed text-[#5b5750] text-pretty">
              Ask about deadlines, catch scope changes, follow up on payments, and
              send client updates — by voice or text. Every answer cites the record
              it used. Every external action waits for your approval.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              <Link
                href="/app"
                className="cta-shine group relative inline-flex h-12 items-center gap-2 overflow-hidden rounded-2xl border border-[#e24f00] bg-orange px-6 text-[14px] font-semibold text-ink shadow-[0_14px_34px_-12px_rgba(255,90,0,0.8)] transition hover:bg-[#ff6d1f]"
              >
                Try Visun
                <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#how"
                className="inline-flex h-12 items-center gap-2 rounded-2xl border border-[#d9d4ca] bg-white px-5 text-[14px] font-medium text-ink shadow-neu-sm transition hover:border-[#c4beb2] hover:shadow-neu-md"
              >
                See how it works
                <ChevronRight size={15} className="text-muted" />
              </a>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] text-muted">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-success" />
                Approval-gated actions
              </span>
              <span className="flex items-center gap-1.5">
                <CircleDollarSign size={13} className="text-[#8a6d00]" />
                PayPal Sandbox data
              </span>
              <span className="flex items-center gap-1.5">
                <Mic size={13} className="text-orange" />
                Voice + text, one history
              </span>
            </div>
          </div>

          <HeroArt />
        </div>

        {/* Activity ticker */}
        <div className="relative mt-10 overflow-hidden rounded-2xl border border-[#e4dfd6] bg-white/70">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-canvas to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-canvas to-transparent" />
          <div className="pause-on-hover flex w-max animate-marquee items-center gap-8 px-6 py-3">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex items-center gap-8" aria-hidden={copy === 1}>
                {[
                  { icon: ShieldCheck, text: "Scope change detected · Northwind · 92% confidence" },
                  { icon: Wallet, text: "INV-1047 verified paid · PayPal Sandbox" },
                  { icon: FileText, text: "Week 44 report delivered · gmail-18f2c9a1" },
                  { icon: Mic, text: "Voice query answered · 6 source records checked" },
                  { icon: CircleDollarSign, text: "$3,200 outstanding across 3 invoices" },
                  { icon: CheckCircle2, text: "Milestone completed · Okafor intake workflow" },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <span
                      key={`${copy}-${item.text}`}
                      className="flex shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[#6f6a62]"
                    >
                      <Icon size={12} className="text-orange" />
                      {item.text}
                      <span className="ml-4 h-1 w-1 rounded-full bg-[#ccc6bb]" />
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Demo console                                                               */
/* -------------------------------------------------------------------------- */

const demoSteps = [
  { label: "Ask", hint: "Voice or text" },
  { label: "Read records", hint: "Read-only tools" },
  { label: "Surface evidence", hint: "Agreement vs. message" },
  { label: "Draft action", hint: "Nothing sent" },
  { label: "Verify", hint: "Provider result" },
] as const;

function DemoConsole() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      if (step < demoSteps.length - 1) setStep((value) => value + 1);
      else setPlaying(false);
    }, 1900);
    return () => window.clearTimeout(timer);
  }, [playing, step]);

  const play = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (step === demoSteps.length - 1) setStep(0);
    setPlaying(true);
  };

  return (
    <section id="product" className="relative scroll-mt-24 pb-16 lg:pb-24">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <SectionMarker index="00">A live look</SectionMarker>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-[#e4dfd6] bg-white px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-muted sm:inline-flex">
              Sample data
            </span>
            <button
              onClick={play}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#d9d4ca] bg-white px-3 text-[11.5px] font-medium text-ink shadow-neu-sm transition hover:shadow-neu-md"
            >
              {playing ? <Pause size={12} /> : <Play size={12} />}
              {playing ? "Pause walkthrough" : "Play the walkthrough"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="overflow-hidden rounded-[24px] border border-[#ded9d0] bg-white shadow-neu-md">
            <div className="flex items-center justify-between gap-3 border-b border-[#ece8e0] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex gap-1.5" aria-hidden="true">
                  <span className="h-2 w-2 rounded-full bg-[#e6b6ac]" />
                  <span className="h-2 w-2 rounded-full bg-yellow" />
                  <span className="h-2 w-2 rounded-full bg-[#bcd8c8]" />
                </span>
                <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                  Paroha Studio / copilot
                </span>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-[#f4f1ea] px-2 py-1 font-mono text-[8.5px] text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                demo workspace
              </span>
            </div>

            <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_210px]">
              <div className="min-h-[360px] space-y-4 border-b border-[#ece8e0] p-4 md:border-b-0 md:border-r">
                <div className="flex justify-end">
                  <div className="max-w-[86%]">
                    <p className="mb-1 text-right font-mono text-[8.5px] uppercase tracking-wider text-muted">
                      You · voice
                    </p>
                    <div className="rounded-2xl rounded-tr-md border border-[#ded9cf] bg-stone px-3.5 py-2.5 text-[12px] leading-relaxed">
                      What changed on Rahul&apos;s project, and how much is still unpaid?
                    </div>
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  {step >= 1 ? (
                    <motion.div
                      key={`reply-${step >= 2}`}
                      initial={reduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="flex gap-2.5"
                    >
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#f4c7ad] bg-[#fff0e6] text-orange">
                        <Sparkles size={12} />
                      </span>
                      <div className="min-w-0">
                        <p className="mb-1 flex items-center gap-1.5 text-[9px] text-muted">
                          <span className="font-semibold text-ink">Visun</span>
                          <span className="rounded-full bg-[#e5f3ec] px-1.5 py-0.5 text-[7.5px] font-semibold text-[#1c6142]">
                            Grounded
                          </span>
                        </p>
                        <div className="rounded-2xl rounded-tl-md border border-[#e5e0d7] bg-[#fbfaf7] px-3.5 py-3 text-[12px] leading-relaxed text-[#3a3733]">
                          {step === 1 ? (
                            <p className="flex items-center gap-1.5 text-muted">
                              <Wrench size={11} className="text-[#9a948a]" />
                              Reading milestones, agreement clauses, and PayPal Sandbox invoices…
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              <p>
                                One change needs review. Rahul asked for{" "}
                                <strong className="font-semibold text-ink">
                                  login and a payment page
                                </strong>{" "}
                                before the 14 Nov demo.
                              </p>
                              <p className="text-muted">
                                Northwind still has{" "}
                                <strong className="font-semibold text-ink">$1,800</strong>{" "}
                                outstanding on INV-1044.
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1">
                          {["detect_scope_changes", "get_pending_payments"].map((tool, index) => (
                            <span
                              key={tool}
                              className={cn(
                                "flex items-center gap-1 rounded-md border border-[#e4dfd6] bg-white px-1.5 py-1 font-mono text-[7.5px] text-[#7b756c] transition",
                                step < index + 1 && "opacity-30",
                              )}
                            >
                              <Check size={8} className="text-success" />
                              {tool}
                            </span>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <AnimatePresence>
                  {step >= 2 ? (
                    <motion.div
                      initial={reduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-[#ecd9a3] bg-[#fff9e8] p-3"
                    >
                      <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#7d5d00]">
                        <ShieldCheck size={11} /> Possible scope change
                      </p>
                      <p className="mt-1.5 text-[11.5px] font-semibold">
                        Authentication + payment page requested
                      </p>
                      <div className="mt-2 grid gap-1.5 text-[10px] text-[#6f6035] sm:grid-cols-2">
                        <p>
                          <span className="text-[#9a8a58]">Clause </span>nw-c5 · checkout excluded
                        </p>
                        <p>
                          <span className="text-[#9a8a58]">Estimate </span>$950 · proposal only
                        </p>
                      </div>
                      <p className="mt-2 text-[8.5px] text-[#8a7a48]">
                        Confidence 92% · nothing is billable without your decision.
                      </p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <AnimatePresence>
                  {step >= 3 ? (
                    <motion.div
                      initial={reduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="overflow-hidden rounded-xl border border-[#ddd8cf] bg-white"
                    >
                      <div className="flex items-center justify-between border-b border-[#ece8e0] bg-[#fff9e8] px-3 py-2">
                        <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#7d5d00]">
                          <Lock size={10} /> Action preview
                        </p>
                        <span
                          className={cn(
                            "rounded-full border px-1.5 py-0.5 text-[7.5px] font-semibold",
                            step >= 4
                              ? "border-[#bfdccd] bg-[#e5f3ec] text-[#1c6142]"
                              : "border-[#ecdba4] bg-[#fff3cf] text-[#775000]",
                          )}
                        >
                          {step >= 4 ? "Sent · verified" : "Awaiting approval"}
                        </span>
                      </div>
                      <div className="p-3">
                        <p className="text-[11px] font-semibold">Overdue invoice reminder</p>
                        <p className="mt-0.5 text-[9.5px] text-muted">
                          daniel@okaforlegal.com · INV-1045 · $800
                        </p>
                        {step >= 4 ? (
                          <p className="mt-2 flex items-center gap-1 font-mono text-[8.5px] text-success">
                            <CheckCircle2 size={10} /> gmail-18f2c9a1 · logged in Activity
                          </p>
                        ) : (
                          <div className="mt-2 flex items-center gap-1.5">
                            <span className="inline-flex h-7 items-center gap-1 rounded-lg bg-orange px-2.5 text-[8.5px] font-semibold text-ink">
                              <Lock size={8} /> Approve &amp; send
                            </span>
                            <span className="rounded-lg border border-[#e3ded5] px-2 py-1.5 text-[8.5px] text-muted">
                              Edit draft
                            </span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              <div className="space-y-3 bg-[#fbfaf7] p-4">
                <div>
                  <p className="eyebrow !text-[8.5px]">What I checked</p>
                  <ul className="mt-2 space-y-1.5">
                    {[
                      { label: "nw-c5 · checkout excluded", show: step >= 1 },
                      { label: "Rahul · Telegram, 2 Nov", show: step >= 2 },
                      { label: "INV-1044 · $1,800", show: step >= 1 },
                      { label: "PayPal Sandbox · 09:02", show: step >= 1 },
                    ].map((source) => (
                      <li
                        key={source.label}
                        className={cn(
                          "flex items-start gap-1.5 rounded-lg border px-2 py-1.5 text-[9px] leading-snug transition",
                          source.show
                            ? "border-[#e4dfd6] bg-white text-[#5f5b54]"
                            : "border-dashed border-[#e4dfd6] bg-transparent text-[#b3ada3]",
                        )}
                      >
                        <Check
                          size={9}
                          className={cn("mt-0.5 shrink-0", source.show ? "text-success" : "text-[#c8c2b7]")}
                        />
                        {source.label}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-lg border border-[#e4dfd6] bg-white p-2.5">
                  <p className="eyebrow !text-[8px]">Session</p>
                  <dl className="mt-1.5 space-y-1 text-[9px]">
                    <div className="flex justify-between">
                      <dt className="text-muted">Tools</dt>
                      <dd className="font-medium tabular">{step >= 1 ? 2 : 0}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted">Sources</dt>
                      <dd className="font-medium tabular">{step >= 2 ? 4 : step >= 1 ? 3 : 0}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted">Pending</dt>
                      <dd className="font-medium tabular">{step === 3 ? 1 : 0}</dd>
                    </div>
                  </dl>
                </div>

                <p className="rounded-lg border border-[#e6dfae] bg-yellow/50 px-2 py-1.5 text-[8.5px] leading-relaxed text-[#6d5a13]">
                  Demo data. No real payment, email, or Telegram message moves.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#ece8e0] px-4 py-3">
              <div className="flex flex-wrap items-center gap-1">
                {demoSteps.map((item, index) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      setPlaying(false);
                      setStep(index);
                    }}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[9.5px] font-medium transition",
                      step === index
                        ? "bg-ink text-canvas"
                        : "text-muted hover:bg-[#f4f1ea] hover:text-ink",
                    )}
                    aria-pressed={step === index}
                  >
                    <span className="font-mono text-[8px] opacity-60">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {item.label}
                  </button>
                ))}
              </div>
              <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-muted">
                {demoSteps[step].hint}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="rounded-[22px] border border-[#e3dfd7] bg-white p-4 shadow-neu-sm">
              <p className="eyebrow !text-[9px]">Why this is different</p>
              <ul className="mt-2.5 space-y-2.5">
                {[
                  {
                    icon: MessageSquareText,
                    title: "One timeline",
                    body: "Voice and typed questions share the same history, tools, and sources.",
                  },
                  {
                    icon: ShieldCheck,
                    title: "Evidence first",
                    body: "Every claim about money or deadlines expands to the exact record.",
                  },
                  {
                    icon: Lock,
                    title: "Consent by default",
                    body: "No send, invoice change, or calendar write without explicit approval.",
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.title} className="flex gap-2.5">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#e6e1d8] bg-[#f8f7f3] text-[#6f6a62]">
                        <Icon size={13} />
                      </span>
                      <div>
                        <p className="text-[11.5px] font-semibold">{item.title}</p>
                        <p className="mt-0.5 text-[10px] leading-relaxed text-muted">{item.body}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <Link
              href="/app/copilot?prompt=What%20changed%20on%20Rahul%27s%20project%2C%20and%20how%20much%20is%20still%20unpaid%3F"
              className="group flex items-center justify-between gap-3 rounded-[22px] border border-[#e24f00] bg-orange p-4 text-ink shadow-[0_16px_36px_-18px_rgba(255,90,0,0.8)] transition hover:bg-[#ff6d1f]"
            >
              <div>
                <p className="text-[12px] font-semibold">Open the live demo</p>
                <p className="mt-0.5 text-[10px] text-[#5e2200]">
                  Same question, real seeded records.
                </p>
              </div>
              <ArrowUpRight size={18} className="transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Problem                                                                    */
/* -------------------------------------------------------------------------- */

const problems = [
  {
    index: "01",
    title: "The ask lives in a chat",
    body: "A client adds “one small login page” in Telegram. It never reaches the scope document.",
    tag: "Context lost",
  },
  {
    index: "02",
    title: "The deadline lives in your head",
    body: "Three projects, six milestones, two time zones. The next date is one refresh away from a surprise.",
    tag: "Deadline risk",
  },
  {
    index: "03",
    title: "The money lives in another tab",
    body: "Invoices, partial payments, and sandbox statuses drift apart. Following up becomes its own project.",
    tag: "Cashflow drift",
  },
];

function Problem() {
  return (
    <section className="border-y border-[#e6e2da] bg-[#f2efe9] py-16 lg:py-24">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <Reveal>
            <SectionMarker index="01">The problem</SectionMarker>
            <h2 className="display mt-4 max-w-[15ch] text-[clamp(2.4rem,4.6vw,4.2rem)] text-balance">
              Your work is everywhere. Your answers shouldn&apos;t be.
            </h2>
            <p className="mt-5 max-w-md text-[14.5px] leading-relaxed text-[#5b5750]">
              Freelancers lose hours reconstructing what was agreed, what is due, and
              what is actually paid. Visun keeps the record in one place and lets you
              ask it directly.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {["No hidden automation", "No invented numbers", "No unsolicited sends"].map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#dcd7cd] bg-white/70 px-3 py-1.5 text-[10.5px] font-medium text-[#5b5750]"
                >
                  <Check size={11} className="text-success" />
                  {item}
                </span>
              ))}
            </div>
          </Reveal>

          <div className="grid gap-3">
            {problems.map((problem, index) => (
              <Reveal key={problem.index} delay={index * 0.06}>
                <article className="group flex gap-4 rounded-[20px] border border-[#e0dbd2] bg-white/75 p-4 transition hover:border-[#cfc8bc] hover:bg-white sm:p-5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#e6e1d8] bg-[#f8f7f3] font-mono text-[10px] text-muted">
                    {problem.index}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[14px] font-semibold">{problem.title}</h3>
                      <span className="rounded-full border border-[#e6d7a4] bg-[#fff6da] px-2 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.08em] text-[#7d5d00]">
                        {problem.tag}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-[#6a665f]">
                      {problem.body}
                    </p>
                  </div>
                  <ArrowUpRight
                    size={15}
                    className="ml-auto mt-1 shrink-0 text-transparent transition group-hover:text-orange"
                  />
                </article>
              </Reveal>
            ))}

            <Reveal delay={0.2}>
              <div className="rounded-[20px] border border-[#e6dfae] bg-yellow/70 p-4 sm:p-5">
                <p className="text-[12.5px] font-semibold text-[#4f4110]">
                  Visun doesn&apos;t guess its way out of this.
                </p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-[#6d5a13]">
                  It reads only authorized records, shows the source behind each
                  answer, and pauses before anything consequential.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Features                                                                   */
/* -------------------------------------------------------------------------- */

const features = [
  {
    id: "voice",
    title: "Voice",
    icon: Mic,
    line: "Ask in plain language. Get an answer with sources.",
    detail:
      "A single copilot for spoken and typed questions. It shows listening, thinking, and speaking states in text, persists only confirmed transcripts, and never stores audio unless you opt in.",
    prompt: "What is due this week?",
    accent: "orange" as const,
  },
  {
    id: "scope",
    title: "Scope",
    icon: ShieldCheck,
    line: "Catch the request that was never in the agreement.",
    detail:
      "Every opted-in client message is compared to the signed agreement. You see the exact clause, the new request, a confidence level, and a working estimate — then decide. Nothing is billed automatically.",
    prompt: "What changed on Rahul's project?",
    accent: "yellow" as const,
  },
  {
    id: "payments",
    title: "Payments",
    icon: Wallet,
    line: "Know what is paid, pending, overdue, or unknown.",
    detail:
      "Invoices reconcile against PayPal Sandbox with a last-checked timestamp and provider reference. Stale or unsynced states are labelled instead of guessed.",
    prompt: "How much is still unpaid?",
    accent: "stone" as const,
  },
  {
    id: "calendar",
    title: "Calendar",
    icon: CalendarDays,
    line: "Deadlines from your records, in your timezone.",
    detail:
      "Milestones, project dates, and approved calendar writes live together. When Google Calendar is not connected, Visun says so rather than filling the gap.",
    prompt: "What is due on 6 November?",
    accent: "stone" as const,
  },
  {
    id: "reports",
    title: "Reports",
    icon: FileText,
    line: "Client updates grounded in real progress.",
    detail:
      "Build a report from completed milestones, blockers, scope changes, and invoice status. Review the draft, approve the recipients, then send and keep the provider confirmation.",
    prompt: "Generate this week's Northwind report.",
    accent: "yellow" as const,
  },
  {
    id: "leads",
    title: "Leads",
    icon: Users,
    line: "Pipeline context without another CRM tab.",
    detail:
      "New inquiries, source, next action, and value live beside your delivery work. If no lead source is connected, Visun says “no source connected” instead of showing a false zero.",
    prompt: "Who are today's new leads?",
    accent: "orange" as const,
  },
];

function Features() {
  const [active, setActive] = useState(features[0].id);
  const selected = features.find((feature) => feature.id === active) ?? features[0];

  return (
    <section id="features" className="scroll-mt-24 py-16 lg:py-24">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-6">
        <Reveal className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <SectionMarker index="02">The workspace</SectionMarker>
            <h2 className="display mt-4 max-w-[20ch] text-[clamp(2.4rem,4.6vw,4.2rem)] text-balance">
              Six tools. One conversation.
            </h2>
          </div>
          <p className="max-w-sm text-[13.5px] leading-relaxed text-muted">
            Tap a tile to see what it actually does. Every module shares the same
            records, the same permissions, and the same audit trail.
          </p>
        </Reveal>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="grid gap-3 sm:grid-cols-2">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              const isActive = feature.id === active;
              return (
                <Reveal key={feature.id} delay={index * 0.04}>
                  <button
                    onClick={() => setActive(feature.id)}
                    aria-pressed={isActive}
                    className={cn(
                      "group relative flex h-full min-h-[146px] w-full flex-col items-start overflow-hidden rounded-[22px] border p-4 text-left transition duration-200",
                      isActive
                        ? "border-ink/25 bg-white shadow-neu-md"
                        : "border-[#e3dfd7] bg-white/65 shadow-neu-sm hover:-translate-y-0.5 hover:bg-white hover:shadow-neu-md",
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-70 blur-2xl transition",
                        feature.accent === "orange"
                          ? "bg-orange/15"
                          : feature.accent === "yellow"
                            ? "bg-yellow/50"
                            : "bg-stone/80",
                      )}
                      aria-hidden="true"
                    />
                    <span className="relative flex w-full items-start justify-between">
                      <span
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-xl border",
                          feature.accent === "orange"
                            ? "border-[#f4c7ad] bg-[#fff0e6] text-orange"
                            : feature.accent === "yellow"
                              ? "border-[#e7cf6f] bg-yellow/70 text-ink"
                              : "border-[#e6e1d8] bg-[#f8f7f3] text-[#6f6a62]",
                        )}
                      >
                        <Icon size={16} />
                      </span>
                      <span className="font-mono text-[9px] text-[#b3ada3]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </span>
                    <p className="relative mt-3 text-[14px] font-semibold">{feature.title}</p>
                    <p className="relative mt-1 text-[11.5px] leading-relaxed text-muted">
                      {feature.line}
                    </p>
                    <span className="relative mt-auto flex items-center gap-1 pt-3 text-[10px] font-medium text-muted transition group-hover:text-ink">
                      Explore <ArrowRight size={11} className="transition group-hover:translate-x-0.5" />
                    </span>
                  </button>
                </Reveal>
              );
            })}
          </div>

          <Reveal delay={0.1}>
            <div className="sticky top-24 flex h-full flex-col rounded-[22px] border border-[#ded9d0] bg-ink p-5 text-canvas shadow-[0_24px_60px_-26px_rgba(0,0,0,0.65)]">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <LogoMark className="scale-[0.62] origin-left -mr-2" />
                  <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/50">
                    {selected.title}
                  </span>
                </span>
                <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[8.5px] font-medium text-white/70">
                  Module
                </span>
              </div>
              <h3 className="mt-5 font-serif text-[30px] leading-[1.05] tracking-tight text-white">
                {selected.title}
                <span className="text-orange">.</span>
              </h3>
              <p className="mt-2 text-[12px] leading-relaxed text-white/60">{selected.line}</p>
              <div className="mt-4 border-t border-white/10 pt-3">
                <p className="text-[11.5px] leading-relaxed text-white/75">{selected.detail}</p>
              </div>
              <Link
                href={`/app/copilot?prompt=${encodeURIComponent(selected.prompt)}`}
                className="mt-5 inline-flex items-center justify-between gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2.5 text-[11px] font-medium text-white/85 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
              >
                <span className="truncate">“{selected.prompt}”</span>
                <ArrowUpRight size={13} className="shrink-0" />
              </Link>
              <p className="mt-auto pt-4 text-[9px] leading-relaxed text-white/35">
                Every module reads the same demo records. Nothing here represents a
                live provider.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* How it works                                                               */
/* -------------------------------------------------------------------------- */

const flow = [
  {
    id: "message",
    title: "Message",
    body: "A client request arrives in an authorized project chat.",
    detail: "Telegram or an uploaded export. Consent is recorded before storage.",
  },
  {
    id: "understand",
    title: "Understand",
    body: "Visun reads the agreement, milestones, and invoices.",
    detail: "Read-only tools. You can inspect every call and its result.",
  },
  {
    id: "propose",
    title: "Propose",
    body: "A grounded answer or an editable draft appears.",
    detail: "Numbers cite their invoice. Claims cite their message and clause.",
  },
  {
    id: "approve",
    title: "Approve",
    body: "You review the exact recipient, amount, and body.",
    detail: "A material edit resets the approval. Voice alone cannot approve.",
  },
  {
    id: "execute",
    title: "Execute",
    body: "One idempotent request goes to the provider.",
    detail: "Duplicate submissions are blocked. Failures return a safe retry path.",
  },
  {
    id: "verify",
    title: "Verify",
    body: "The provider reference lands in Activity.",
    detail: "Status comes from the provider, not from a UI guess.",
  },
];

function HowItWorks() {
  const [active, setActive] = useState(0);
  const step = flow[active];

  return (
    <section id="how" className="scroll-mt-24 border-y border-[#e6e2da] bg-[#f2efe9] py-16 lg:py-24">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-6">
        <Reveal>
          <SectionMarker index="03">How it works</SectionMarker>
          <h2 className="display mt-4 max-w-[22ch] text-[clamp(2.4rem,4.6vw,4.2rem)] text-balance">
            From client request to clear next step.
          </h2>
        </Reveal>

        <div className="relative mt-10">
          <div
            className="absolute left-0 right-0 top-[22px] hidden h-px bg-[#d8d2c7] lg:block"
            aria-hidden="true"
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {flow.map((item, index) => {
              const isActive = index === active;
              return (
                <Reveal key={item.id} delay={index * 0.04}>
                  <button
                    onClick={() => setActive(index)}
                    aria-pressed={isActive}
                    className="group relative flex w-full flex-col items-start text-left"
                  >
                    <span
                      className={cn(
                        "relative z-10 flex h-11 w-11 items-center justify-center rounded-full border font-mono text-[10px] transition",
                        isActive
                          ? "border-[#e24f00] bg-orange text-ink shadow-[0_10px_22px_-8px_rgba(255,90,0,0.7)]"
                          : index < active
                            ? "border-success bg-[#e5f3ec] text-success"
                            : "border-[#d8d2c7] bg-canvas text-muted group-hover:border-[#bfb8ab]",
                      )}
                    >
                      {index < active ? <Check size={14} strokeWidth={3} /> : `0${index + 1}`}
                    </span>
                    <span
                      className={cn(
                        "mt-3 text-[12.5px] font-semibold transition",
                        isActive ? "text-ink" : "text-[#6a665f]",
                      )}
                    >
                      {item.title}
                    </span>
                    <span className="mt-1 hidden text-[10px] leading-snug text-muted sm:block">
                      {item.body}
                    </span>
                  </button>
                </Reveal>
              );
            })}
          </div>
        </div>

        <Reveal className="mt-8">
          <div className="flex flex-col justify-between gap-4 rounded-[22px] border border-[#ded9d0] bg-white p-5 shadow-neu-sm sm:flex-row sm:items-center">
            <div className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-yellow font-mono text-[11px] font-semibold text-ink">
                0{active + 1}
              </span>
              <div>
                <p className="text-[14px] font-semibold">
                  {step.title} — {step.body}
                </p>
                <p className="mt-1 max-w-xl text-[11.5px] leading-relaxed text-muted">
                  {step.detail}
                </p>
              </div>
            </div>
            <Link
              href="/app/copilot"
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-[#d9d4ca] bg-canvas px-3.5 text-[11.5px] font-medium text-ink shadow-neu-sm transition hover:shadow-neu-md"
            >
              See it in the app <ArrowUpRight size={12} />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Trust / agent thinking                                                     */
/* -------------------------------------------------------------------------- */

const traces = [
  {
    id: "scope",
    label: "Scope check",
    question: "Maya wants a video hero. Is that extra work?",
    steps: [
      { tool: "read_agreement", args: "project: p-fjord", result: "5 clauses · v1.3" },
      { tool: "search_messages", args: "project: p-fjord, since: 1 Nov", result: "1 client message" },
      { tool: "classify_scope", args: "clause: fj-c4", result: "Within scope · 78%" },
    ],
    answer:
      "It reads within scope if Maya supplies the video. Producing the video would be a change — I left it marked for your review.",
    sources: ["fj-c4 · hero imagery swaps", "Maya Chen · Telegram, 1 Nov 15:42"],
    gate: "No action proposed. Nothing to approve.",
  },
  {
    id: "payments",
    label: "Payment check",
    question: "How much is still unpaid?",
    steps: [
      { tool: "get_pending_payments", args: "workspace: paroha-studio", result: "3 open invoices" },
      { tool: "sync_paypal", args: "environment: sandbox", result: "verified at 09:02" },
    ],
    answer:
      "$3,200 is outstanding: $1,800 on INV-1044, $800 overdue on INV-1045, and $600 remaining on INV-1043.",
    sources: ["INV-1044 · $1,800 · due 15 Nov", "INV-1045 · $800 · overdue", "INV-1043 · $600 remaining"],
    gate: "Read-only. No payment is initiated from a question.",
  },
  {
    id: "email",
    label: "Draft an email",
    question: "Send Daniel a short reminder about the overdue invoice.",
    steps: [
      { tool: "get_invoice", args: "invoice: inv-1045", result: "$800 · due 1 Nov" },
      { tool: "draft_email", args: "tone: concise, polite", result: "Draft ready" },
    ],
    answer:
      "I prepared a reminder to daniel@okaforlegal.com that names INV-1045, the $800 amount, and the Sandbox link.",
    sources: ["INV-1045 · $800", "Recipient record · Daniel Okafor"],
    gate: "Waiting for approval. Sends exactly once after you confirm.",
  },
];

function Trust() {
  const [active, setActive] = useState(traces[0].id);
  const trace = traces.find((item) => item.id === active) ?? traces[0];

  return (
    <section id="trust" className="scroll-mt-24 py-16 lg:py-24">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
          <Reveal>
            <SectionMarker index="04">Proof of control</SectionMarker>
            <h2 className="display mt-4 max-w-[16ch] text-[clamp(2.4rem,4.6vw,4.2rem)] text-balance">
              Nothing happens behind your back.
            </h2>
            <p className="mt-5 max-w-md text-[14px] leading-relaxed text-[#5b5750]">
              This is not a black box with a friendly voice. Every tool call, source
              read, proposed action, approval, and provider response is visible in
              the same timeline.
            </p>

            <div className="mt-6 flex flex-col gap-1.5" role="tablist" aria-label="Example traces">
              {traces.map((item) => (
                <button
                  key={item.id}
                  role="tab"
                  aria-selected={active === item.id}
                  onClick={() => setActive(item.id)}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left text-[12px] font-medium transition",
                    active === item.id
                      ? "border-ink/20 bg-white text-ink shadow-neu-sm"
                      : "border-transparent text-[#6a665f] hover:bg-white/60 hover:text-ink",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        active === item.id ? "bg-orange" : "bg-[#c8c2b7]",
                      )}
                    />
                    {item.label}
                  </span>
                  <ChevronRight
                    size={13}
                    className={cn(
                      "text-muted transition",
                      active === item.id && "translate-x-0.5 text-ink",
                    )}
                  />
                </button>
              ))}
            </div>

            <div className="mt-5 flex items-start gap-2 rounded-xl border border-[#e6dfae] bg-yellow/55 p-3">
              <Lock size={13} className="mt-0.5 shrink-0 text-[#7d5d00]" />
              <p className="text-[10.5px] leading-relaxed text-[#6d5a13]">
                Approval is always a deliberate click. Voice alone cannot approve an
                action, and a material edit resets the gate.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="overflow-hidden rounded-[24px] border border-black bg-ink text-canvas shadow-[0_30px_70px_-30px_rgba(0,0,0,0.7)]">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange text-ink">
                    <Sparkles size={12} />
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/50">
                    Agent trace
                  </span>
                </div>
                <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 font-mono text-[8.5px] text-white/60">
                  demo
                </span>
              </div>

              <div className="p-5">
                <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-white/35">
                  Question
                </p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-white/90">
                  “{trace.question}”
                </p>

                <div className="mt-5 space-y-2">
                  {trace.steps.map((step, index) => (
                    <motion.div
                      key={`${trace.id}-${step.tool}`}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.07, duration: 0.25 }}
                      className="rounded-xl border border-white/10 bg-white/[0.045] p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 font-mono text-[9.5px] text-white/75">
                          <Wrench size={10} className="text-orange" />
                          {step.tool}
                        </span>
                        <span className="flex items-center gap-1 font-mono text-[8px] text-[#8ce0b4]">
                          <Check size={9} /> done
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-[8.5px] text-white/35">{step.args}</p>
                      <p className="mt-0.5 font-mono text-[8.5px] text-white/55">→ {step.result}</p>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.06] p-3.5">
                  <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-white/35">
                    Answer
                  </p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-white/85">{trace.answer}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {trace.sources.map((source) => (
                      <span
                        key={source}
                        className="rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-1 font-mono text-[8px] text-white/55"
                      >
                        {source}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#e7cf6f]/30 bg-yellow/[0.12] p-3">
                  <ShieldCheck size={13} className="mt-0.5 shrink-0 text-yellow" />
                  <p className="text-[10.5px] leading-relaxed text-yellow/90">{trace.gate}</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Use cases                                                                  */
/* -------------------------------------------------------------------------- */

const useCases = [
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
    prompt: "What changed on Rahul's project?",
    label: "Scope",
    outcome: "The client message, the matching clause, and the confidence.",
    icon: ShieldCheck,
  },
  {
    prompt: "Draft a reminder for the overdue invoice.",
    label: "Follow-up",
    outcome: "An editable draft that sends nothing until you approve.",
    icon: MessageSquareText,
  },
  {
    prompt: "Who are today's new leads?",
    label: "Pipeline",
    outcome: "Workspace lead records, or a clear “no source connected”.",
    icon: Users,
  },
  {
    prompt: "Generate this week's Northwind report.",
    label: "Reporting",
    outcome: "A report built from milestones, invoices, and activity.",
    icon: FileText,
  },
];

function UseCases() {
  return (
    <section id="use-cases" className="scroll-mt-24 border-y border-[#e6e2da] bg-[#f2efe9] py-16 lg:py-24">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-6">
        <Reveal className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <SectionMarker index="05">Built for real work</SectionMarker>
            <h2 className="display mt-4 max-w-[20ch] text-[clamp(2.4rem,4.6vw,4.2rem)] text-balance">
              Ask the question you actually have.
            </h2>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dcd7cd] bg-white/70 px-3 py-1.5 text-[10.5px] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-orange" />
            Each opens the seeded demo
          </span>
        </Reveal>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {useCases.map((item, index) => {
            const Icon = item.icon;
            return (
              <Reveal key={item.prompt} delay={index * 0.04}>
                <Link
                  href={`/app/copilot?prompt=${encodeURIComponent(item.prompt)}`}
                  className="group flex h-full flex-col rounded-[20px] border border-[#e0dbd2] bg-white/75 p-4 transition hover:-translate-y-0.5 hover:border-[#cfc8bc] hover:bg-white hover:shadow-neu-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e6e1d8] bg-[#f8f7f3] text-[#6f6a62]">
                      <Icon size={14} />
                    </span>
                    <span className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-[#a39d92]">
                      {item.label}
                    </span>
                  </div>
                  <p className="mt-3 text-[13.5px] font-semibold leading-snug transition group-hover:text-orange">
                    “{item.prompt}”
                  </p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted">{item.outcome}</p>
                  <span className="mt-auto flex items-center gap-1 pt-3 text-[10px] font-medium text-muted transition group-hover:text-ink">
                    Ask Visun <ArrowUpRight size={11} className="transition group-hover:-translate-y-0.5" />
                  </span>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Closing CTA + footer                                                       */
/* -------------------------------------------------------------------------- */

function Closing() {
  return (
    <section className="relative overflow-hidden py-16 lg:py-24">
      <div className="pointer-events-none absolute inset-0 paper opacity-40" aria-hidden="true" />
      <div className="relative mx-auto max-w-[1320px] px-5 sm:px-6">
        <div className="grid items-center gap-8 rounded-[28px] border border-[#ded9d0] bg-ink p-6 text-canvas shadow-[0_36px_80px_-34px_rgba(0,0,0,0.65)] sm:p-10 lg:grid-cols-[1.25fr_0.75fr]">
          <div>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-white/45">
              Visun / start here
            </p>
            <h2 className="display mt-4 max-w-[18ch] text-[clamp(2.6rem,5.4vw,4.8rem)] leading-[0.96] text-white text-balance">
              Spend more time making. Less time managing.
            </h2>
            <p className="mt-4 max-w-md text-[13px] leading-relaxed text-white/55">
              Open the demo workspace, ask a real question about the seeded projects,
              and inspect the evidence before you approve anything.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link
                href="/app"
                className="group inline-flex h-11 items-center gap-2 rounded-xl border border-[#e24f00] bg-orange px-5 text-[13px] font-semibold text-ink shadow-[0_12px_28px_-10px_rgba(255,90,0,0.8)] transition hover:bg-[#ff6d1f]"
              >
                Open the demo
                <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
              </Link>
              <a
                href="https://github.com/77anuj77/Visun"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/20 px-4 text-[13px] font-medium text-white/80 transition hover:border-white/35 hover:bg-white/5 hover:text-white"
              >
                <Code2 size={14} /> View source
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5" aria-hidden="true">
            {[
              { label: "Outstanding", value: "$3,200", tone: "bg-orange text-ink" },
              { label: "Scope flags", value: "02", tone: "bg-yellow text-ink" },
              { label: "Verified", value: "$5,000", tone: "bg-white text-ink" },
              { label: "Due this week", value: "03", tone: "bg-stone text-ink" },
            ].map((stat) => (
              <div
                key={stat.label}
                className={cn("rounded-2xl border border-black/10 p-3.5", stat.tone)}
              >
                <p className="font-mono text-[8px] uppercase tracking-[0.12em] opacity-55">
                  {stat.label}
                </p>
                <p className="mt-1.5 text-[22px] font-semibold leading-none tracking-tight">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[#e6e2da] bg-[#f2efe9]">
      <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-6">
        <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-start">
          <div className="max-w-sm">
            <Logo href="/" />
            <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
              A voice-first, transparent operations workspace for freelancers.
              Built for the PayPal AI Hackathon, November 2026.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-10 gap-y-6 text-[11.5px] sm:grid-cols-3">
            <div>
              <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.14em] text-[#918c83]">
                Product
              </p>
              <ul className="space-y-1.5 text-[#5b5750]">
                <li><a href="#product" className="hover:text-ink">Live look</a></li>
                <li><a href="#features" className="hover:text-ink">Workspace</a></li>
                <li><a href="#how" className="hover:text-ink">How it works</a></li>
                <li><Link href="/app" className="hover:text-ink">Open demo</Link></li>
              </ul>
            </div>
            <div>
              <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.14em] text-[#918c83]">
                Trust
              </p>
              <ul className="space-y-1.5 text-[#5b5750]">
                <li><a href="#trust" className="hover:text-ink">Evidence</a></li>
                <li><a href="#trust" className="hover:text-ink">Approval gates</a></li>
                <li><a href="#use-cases" className="hover:text-ink">Use cases</a></li>
                <li><span className="text-muted">Sandbox only</span></li>
              </ul>
            </div>
            <div>
              <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.14em] text-[#918c83]">
                Elsewhere
              </p>
              <ul className="space-y-1.5 text-[#5b5750]">
                <li>
                  <a
                    href="https://github.com/77anuj77/Visun"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:text-ink"
                  >
                    GitHub <ArrowUpRight size={10} />
                  </a>
                </li>
                <li><a href="#use-cases" className="hover:text-ink">Hackathon notes</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col justify-between gap-3 border-t border-[#dcd7cd] pt-5 sm:flex-row sm:items-center">
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#918c83]">
            © 2026 Visun · demo build
          </p>
          <p className="max-w-xl text-[10px] leading-relaxed text-[#918c83]">
            Demo disclosure: all projects, messages, invoices, and provider responses
            are seeded sample data. PayPal is in Sandbox, emails are simulated in the
            browser, and no money moves.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <a
        href="#main"
        className="sr-only z-[200] rounded-md bg-ink px-4 py-2 text-sm text-canvas focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <Header />
      <main id="main">
        <Hero />
        <DemoConsole />
        <Problem />
        <Features />
        <HowItWorks />
        <Trust />
        <UseCases />
        <Closing />
      </main>
      <Footer />
    </div>
  );
}
