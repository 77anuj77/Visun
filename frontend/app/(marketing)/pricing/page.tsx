"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Check,
  Download,
  HardDrive,
  Laptop,
  MessageSquareText,
  Server,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { DemoCta } from "@/components/marketing/InstallCtas";
import { ClosingCta } from "@/components/marketing/ClosingCta";
import { Faq } from "@/components/marketing/Faq";
import { Kicker, Reveal } from "@/components/marketing/Motion";
import { cn } from "@/lib/utils";

type Offer = {
  id: "demo" | "personal" | "studio";
  name: string;
  price: string;
  priceNote: string;
  summary: string;
  features: string[];
  cta: { label: string; href: string };
  recommended?: boolean;
  tone: "light" | "accent" | "dark";
};

const offers: Offer[] = [
  {
    id: "demo",
    name: "Visun Demo",
    price: "$0",
    priceNote: "No account · no card",
    summary:
      "Explore Visun through an interactive demonstration before deciding whether to install it.",
    features: [
      "Interactive workspace preview",
      "Sample projects and deadlines",
      "Sample client and payment tracking",
      "AI agent workflow demonstrations",
      "No account required",
      "No payment information required",
    ],
    cta: { label: "Try Free Demo", href: "/app?demo=1" },
    tone: "light",
  },
  {
    id: "personal",
    name: "Visun Personal Setup",
    price: "Contact for Pricing",
    priceNote: "One-time assisted installation",
    summary:
      "Get your own private Visun workspace installed on your computer or personal server.",
    features: [
      "Docker-based installation",
      "Private application instance",
      "Personal workspace",
      "Gemini AI integration",
      "Gemini Live voice assistant",
      "Projects and deadlines",
      "Payment tracking",
      "Client management",
      "Reports and activity tracking",
      "Setup assistance",
      "Integration configuration",
    ],
    cta: { label: "Contact for Setup", href: "/contact?inquiry=personal" },
    recommended: true,
    tone: "accent",
  },
  {
    id: "studio",
    name: "Visun Studio Setup",
    price: "Custom Quote",
    priceNote: "Scoped with your studio",
    summary:
      "For teams or studios that need a dedicated deployment and hands-on configuration.",
    features: [
      "Dedicated deployment",
      "Multiple authorized users, if supported and verified",
      "Workspace configuration",
      "Integration setup",
      "Additional installation assistance",
      "Optional maintenance agreement",
    ],
    cta: { label: "Request a Quote", href: "/contact?inquiry=studio" },
    tone: "dark",
  },
];

const included = [
  {
    title: "Your own instance",
    body: "The app and database run inside your environment. Customer data is not held in a centrally hosted Visun account.",
    icon: HardDrive,
  },
  {
    title: "Approval-gated actions",
    body: "The agent can read and prepare work. Payments, email, and calendar writes still require an explicit owner approval.",
    icon: ShieldCheck,
  },
  {
    title: "Your integration keys",
    body: "Gemini, PayPal, Telegram, and Google credentials are configured per installation and stored encrypted on your machine.",
    icon: Server,
  },
  {
    title: "Guided first run",
    body: "Installation covers the owner account, encryption key, AI configuration, and optional provider connections.",
    icon: Sparkles,
  },
];

const steps = [
  {
    index: "01",
    title: "Try the $0 demo",
    body: "Open the seeded workspace. No account, card, or installation is needed.",
  },
  {
    index: "02",
    title: "Request an installation",
    body: "Tell us your operating system, preferred host, and which integrations matter.",
  },
  {
    index: "03",
    title: "Agree scope and price",
    body: "You receive a direct quote. There is no subscription checkout on this site.",
  },
  {
    index: "04",
    title: "Docker install and handover",
    body: "Visun is installed privately, configured with your own keys, and checked end to end.",
  },
] as const;

const faq = [
  {
    question: "Is the demo really $0?",
    answer:
      "Yes. The seeded demo opens without an account or payment details. It is a demonstration workspace, not a hosted subscription, and nothing is billed from it.",
  },
  {
    question: "Why is installation priced on contact?",
    answer:
      "Every installation depends on the machine, operating system, integrations, and how much setup assistance you need. A direct quote reflects the actual work instead of a made-up monthly plan.",
  },
  {
    question: "Do I need Docker?",
    answer:
      "Yes. The supported installation path is Docker Compose. On Windows that means Docker Desktop with WSL2; on macOS, Docker Desktop or a compatible runtime; on Linux, Docker Engine with the Compose plugin.",
  },
  {
    question: "Does self-hosting make AI free?",
    answer:
      "No. Your Gemini API usage is billed by Google under your own account. PayPal, Google, Telegram, and Resend may also have their own limits or charges. Docker does not make third-party APIs free.",
  },
  {
    question: "Can several people use one installation?",
    answer:
      "The current application supports multiple authorized users, but shared multi-user deployment has not been verified as a shipped Studio entitlement. The Studio setup is scoped and tested with you before it is promised.",
  },
  {
    question: "Does it work offline?",
    answer:
      "The workspace and database run locally, but Gemini text and Live voice require an internet connection and an API key. Without a model key, the deterministic agent still answers from stored records.",
  },
  {
    question: "How do updates and backups work?",
    answer:
      "Updates are applied by pulling a new image and restarting the Compose services. The install guide includes a database backup and restore procedure before any upgrade. Automatic updates are not implemented.",
  },
];

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
            <Kicker>Pricing</Kicker>
            <h1 className="mt-5 font-sans text-[clamp(2.8rem,6.6vw,5.6rem)] font-semibold leading-[0.94] tracking-[-0.045em]">
              Your workspace.
              <span className="mt-1 block font-serif font-normal italic tracking-[-0.03em] text-orange">
                Your machine.
              </span>
            </h1>
            <p className="mt-5 max-w-lg text-[14px] leading-relaxed text-[#5f5a53]">
              Visun is a self-hosted product, installed privately with Docker.
              Explore the demo for free, then request an assisted installation
              and receive a quote based on your actual setup.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <DemoCta className="group inline-flex h-11 items-center gap-2 rounded-2xl border border-[#e24f00] bg-orange px-5 text-[13px] font-semibold text-ink shadow-[0_14px_30px_-14px_rgba(255,90,0,0.85)] transition hover:bg-[#ff6d1f] active:translate-y-px">
                Try Free Demo
                <ArrowRight
                  size={14}
                  aria-hidden="true"
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </DemoCta>
              <Link
                href="/contact?inquiry=personal"
                className="inline-flex h-11 items-center rounded-2xl border border-[#d9d4ca] bg-white/80 px-5 text-[13px] font-medium text-ink transition hover:border-[#c8c1b4] hover:bg-white active:translate-y-px"
              >
                Contact for Setup
              </Link>
            </div>
          </div>

          <Reveal delay={0.1}>
            <div className="relative mx-auto max-w-[340px] rotate-[2deg]">
              <div className="rounded-[26px] border border-[#e2c455] bg-yellow p-5 shadow-[0_30px_60px_-28px_rgba(35,31,24,0.45)]">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[#7b671c]">
                    Start here
                  </span>
                  <Laptop size={14} className="text-[#7b671c]" aria-hidden="true" />
                </div>
                <p className="mt-4 font-serif text-[46px] leading-none tracking-[-0.03em] text-ink">
                  $0
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-[#6b581b]">
                  The demo is open without a card. No subscription is active,
                  and no usage is metered.
                </p>
                <div className="mt-4 space-y-1.5 border-t border-[#8a6d00]/25 pt-3 text-[10px] text-[#6b581b]">
                  {[
                    "No account required",
                    "Sample records included",
                    "No live charges",
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

      <section className="mx-auto max-w-[1320px] px-5 pt-2 sm:px-6">
        <div className="flex items-start gap-2.5 rounded-2xl border border-[#e6dfae] bg-yellow/60 px-4 py-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#7b671c] text-yellow">
            <Check size={11} aria-hidden="true" />
          </span>
          <p className="text-[11.5px] leading-relaxed text-[#6d5a13]">
            <strong className="font-semibold">Pricing disclosure:</strong> Visun
            Demo is $0. Personal and Studio setups are quoted after a direct
            conversation because installation work varies. There is no
            subscription billing on this site. Third-party AI API usage is
            billed by the provider and is not included in an installation
            quote.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 py-10 sm:px-6 lg:py-14">
        <div className="grid gap-4 lg:grid-cols-3">
          {offers.map((offer, index) => (
            <Reveal key={offer.id} delay={index * 0.07} className="h-full">
              <article
                id={offer.id}
                className={cn(
                  "relative flex h-full scroll-mt-24 flex-col rounded-[28px] border p-5 sm:p-6",
                  offer.tone === "light" &&
                    "border-[#ded9cf] bg-white/85 shadow-[0_24px_50px_-30px_rgba(35,31,24,0.35)]",
                  offer.tone === "accent" &&
                    "border-[#e24f00] bg-orange shadow-[0_34px_70px_-30px_rgba(255,90,0,0.7)]",
                  offer.tone === "dark" &&
                    "border-black bg-ink text-canvas shadow-[0_34px_70px_-32px_rgba(0,0,0,0.65)]",
                )}
              >
                {offer.recommended ? (
                  <span className="absolute -top-3 left-5 inline-flex items-center gap-1 rounded-full border border-[#7b2c00] bg-ink px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-yellow">
                    <Sparkles size={9} aria-hidden="true" />
                    Most requested
                  </span>
                ) : null}

                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-[15px] font-semibold tracking-tight">
                      {offer.name}
                    </h2>
                    <p
                      className={cn(
                        "mt-1 text-[11px] leading-relaxed",
                        offer.tone === "dark" ? "text-white/55" : "text-[#6f6a62]",
                        offer.tone === "accent" && "text-[#6a2708]",
                      )}
                    >
                      {offer.summary}
                    </p>
                  </div>
                  {offer.id === "studio" ? (
                    <Building2
                      size={17}
                      className="shrink-0 text-white/50"
                      aria-hidden="true"
                    />
                  ) : null}
                  {offer.id === "demo" ? (
                    <Download
                      size={17}
                      className="shrink-0 text-[#8f8a80]"
                      aria-hidden="true"
                    />
                  ) : null}
                </div>

                <div className="mt-5 flex flex-wrap items-end gap-2">
                  <p
                    className={cn(
                      "font-serif leading-none tracking-[-0.03em]",
                      offer.id === "demo" ? "text-[38px]" : "text-[27px]",
                    )}
                  >
                    {offer.price}
                  </p>
                  <p
                    className={cn(
                      "pb-1 font-mono text-[8.5px] uppercase tracking-[0.1em]",
                      offer.tone === "dark" ? "text-white/45" : "text-[#8f8a80]",
                      offer.tone === "accent" && "text-[#6a2708]/70",
                    )}
                  >
                    {offer.priceNote}
                  </p>
                </div>

                <ul className="mt-5 space-y-2 border-t border-current/10 pt-4">
                  {offer.features.map((feature) => (
                    <li
                      key={feature}
                      className={cn(
                        "flex items-start gap-2 text-[11.5px] leading-relaxed",
                        offer.tone === "dark" ? "text-white/70" : "text-[#5f5a53]",
                        offer.tone === "accent" && "text-[#5e2200]",
                      )}
                    >
                      <Check
                        size={12}
                        aria-hidden="true"
                        className={cn(
                          "mt-0.5 shrink-0",
                          offer.tone === "dark" ? "text-[#8ce0b4]" : "text-success",
                          offer.tone === "accent" && "text-ink",
                        )}
                      />
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-5">
                  {offer.id === "demo" ? (
                    <DemoCta className="group flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-[#d9d4ca] bg-white text-[12.5px] font-semibold text-ink transition hover:border-[#bfb8ab] active:translate-y-px">
                      {offer.cta.label}
                      <ArrowRight
                        size={13}
                        aria-hidden="true"
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                    </DemoCta>
                  ) : (
                    <Link
                      href={offer.cta.href}
                      className={cn(
                        "group flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-[12.5px] font-semibold transition active:translate-y-px",
                        offer.tone === "accent"
                          ? "border border-black bg-ink text-canvas hover:bg-[#2a2a2a]"
                          : "border border-white/20 bg-white text-ink hover:bg-white/90",
                      )}
                    >
                      {offer.cta.label}
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
                      offer.tone === "dark" ? "text-white/35" : "text-[#8f8a80]",
                      offer.tone === "accent" && "text-[#6a2708]/60",
                    )}
                  >
                    {offer.id === "demo"
                      ? "Free interactive demo"
                      : "Direct quote · no subscription"}
                  </p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-y border-[#e3ddd3] bg-[#f2efe9] py-14 lg:py-20">
        <div className="mx-auto max-w-[1320px] px-5 sm:px-6">
          <div className="grid gap-5 lg:grid-cols-[0.78fr_1.22fr] lg:items-start lg:gap-12">
            <div>
              <Kicker>What you own</Kicker>
              <h2 className="mt-4 max-w-[15ch] font-serif text-[clamp(2.3rem,4.4vw,3.7rem)] leading-[0.98] tracking-[-0.025em]">
                A private instance,
                <span className="block italic text-orange">not a shared login.</span>
              </h2>
              <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-[#5f5a53]">
                Each customer receives an isolated installation with its own
                database, encryption key, and provider credentials.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {included.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="rounded-[22px] border border-[#ded8ce] bg-white/75 p-4 transition duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-neu-md sm:p-5"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e6e1d8] bg-[#faf9f6] text-[#6f6a62]">
                      <Icon size={14} aria-hidden="true" />
                    </span>
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

      <section className="mx-auto max-w-[1320px] px-5 py-14 sm:px-6 lg:py-20">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <Kicker>How it works</Kicker>
            <h2 className="mt-4 font-sans text-[clamp(2.1rem,4.4vw,3.6rem)] font-semibold leading-[1.03] tracking-[-0.035em]">
              From demo to
              <span className="ml-2 font-serif font-normal italic tracking-[-0.02em] text-orange">
                your own machine.
              </span>
            </h2>
          </div>
          <p className="max-w-sm text-[11.5px] leading-relaxed text-[#6f6a62]">
            No checkout, no automatic cloud provisioning, and no plan toggle.
            Setup starts with a conversation.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <Reveal key={step.index} delay={index * 0.05} className="h-full">
              <div className="flex h-full flex-col rounded-[20px] border border-[#e0dbd2] bg-white/75 p-4">
                <div className="flex items-center justify-between">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e6e1d8] bg-[#f8f7f3] font-mono text-[10px] text-[#6f6a62]">
                    {step.index}
                  </span>
                  {index === 1 ? (
                    <MessageSquareText
                      size={14}
                      className="text-[#a39d92]"
                      aria-hidden="true"
                    />
                  ) : null}
                </div>
                <h3 className="mt-4 text-[13.5px] font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-[11px] leading-relaxed text-[#6f6a62]">
                  {step.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 py-14 sm:px-6 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
          <div>
            <Kicker>Questions</Kicker>
            <h2 className="mt-4 font-sans text-[clamp(2rem,3.8vw,3rem)] font-semibold leading-[1.02] tracking-[-0.035em]">
              Straight answers
              <span className="block font-serif font-normal italic tracking-[-0.02em] text-orange">
                about installation.
              </span>
            </h2>
            <p className="mt-4 max-w-xs text-[12.5px] leading-relaxed text-[#6f6a62]">
              If something is not configured or not verified, it says so here.
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
            <span className="block font-serif italic">Then install it for real.</span>
          </>
        }
        copy="The seeded workspace costs nothing and needs no account. When you are ready, request a private installation and we will scope the quote with you."
        secondaryHref="/contact"
        secondaryLabel="Contact for setup"
      />
    </>
  );
}
