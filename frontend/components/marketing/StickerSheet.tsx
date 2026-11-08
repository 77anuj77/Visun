"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  CalendarDays,
  FileText,
  Mic,
  RefreshCw,
  Sparkles,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "./Motion";

const stickers = [
  {
    id: "voice",
    title: "Voice AI",
    line: "Ask out loud. Visun answers with the records it checked.",
    icon: Mic,
    className: "rounded-[2.6rem] bg-orange text-ink border-[#e24f00]",
    badge: "bg-ink text-canvas",
    rotate: -3,
    offset: "lg:translate-y-0",
  },
  {
    id: "deadlines",
    title: "Smart Deadlines",
    line: "Milestones, project dates, and calendar writes on one timeline.",
    icon: CalendarDays,
    className: "rounded-[1.2rem] bg-yellow text-ink border-[#e2c455]",
    badge: "bg-[#5f4b09] text-yellow",
    rotate: 2,
    offset: "lg:translate-y-1",
    ticket: true,
  },
  {
    id: "payments",
    title: "Payment Tracking",
    line: "PayPal Sandbox invoices reconciled, with the last-checked time.",
    icon: Wallet,
    className: "rounded-[2rem] bg-white text-ink border-[#ded9cf] shadow-neu-md",
    badge: "bg-[#e5f3ec] text-[#1c6142]",
    rotate: 1,
    offset: "lg:translate-y-0",
  },
  {
    id: "clients",
    title: "Client Sync",
    line: "Messages, scope decisions, and approvals stay attached to the project.",
    icon: RefreshCw,
    className: "rounded-[2.4rem] bg-stone text-ink border-[#d4cfc4]",
    badge: "bg-white text-ink",
    rotate: -2,
    offset: "lg:translate-y-1",
  },
  {
    id: "reports",
    title: "AI Reports",
    line: "Draft a grounded client update, review it, then send.",
    icon: FileText,
    className: "rounded-[2.2rem] bg-ink text-canvas border-black",
    badge: "bg-orange text-ink",
    rotate: 3,
    offset: "lg:translate-y-0",
  },
  {
    id: "automation",
    title: "Agentic Automation",
    line: "Approval-gated actions update the workspace, never silently.",
    icon: Sparkles,
    className: "rounded-[1.6rem] bg-[#d94b00] text-canvas border-[#b34000]",
    badge: "bg-yellow text-ink",
    rotate: -4,
    offset: "lg:translate-y-1",
  },
] as const;

export function StickerSheet() {
  const reduce = useReducedMotion();

  return (
    <section id="features" className="relative scroll-mt-24 overflow-hidden py-16 lg:py-24">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-12 h-64 w-[80%] -translate-x-1/2 rounded-full bg-yellow/15 blur-3xl"
      />
      <div className="mx-auto max-w-[1320px] px-5 sm:px-6">
        <div className="max-w-3xl">
          <h2 className="font-sans text-[clamp(2.2rem,4.6vw,4rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-ink">
            Six tools.
            <span className="ml-3 font-serif font-normal italic tracking-[-0.02em] text-orange">
              One conversation.
            </span>
          </h2>
          <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-[#5f5a53]">
            Every sticker is a real workspace capability. They share the same
            records, permissions, and audit trail, so an answer never lives in
            a separate tab.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-8">
          {stickers.map((sticker, index) => {
            const Icon = sticker.icon;
            return (
              <Reveal key={sticker.id} delay={index * 0.05} className={cn(sticker.offset, "h-full")}>
                <motion.article
                  whileHover={
                    reduce
                      ? undefined
                      : { y: -10, rotate: 0, scale: 1.025 }
                  }
                  transition={{ type: "spring", stiffness: 260, damping: 22 }}
                  style={
                    reduce
                      ? undefined
                      : { rotate: sticker.rotate, transformOrigin: "center" }
                  }
                  className={cn(
                    "group relative flex h-full min-h-[218px] w-full flex-col justify-between border p-5 shadow-[0_22px_44px_-24px_rgba(35,31,24,0.4)] sm:p-6",
                    sticker.className,
                  )}
                >
                  {("ticket" in sticker && sticker.ticket) ? (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-2 rounded-[0.8rem] border border-dashed border-[#8a6d00]/35"
                    />
                  ) : null}

                  <div className="relative flex items-start justify-between">
                    <span
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full border border-black/10",
                        sticker.badge,
                      )}
                    >
                      <Icon size={17} aria-hidden="true" />
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-[0.16em] opacity-45">
                      0{index + 1}
                    </span>
                  </div>

                  <div className="relative mt-8">
                    <h3 className="font-serif text-[clamp(1.6rem,2.6vw,2.1rem)] leading-[1] tracking-[-0.02em]">
                      {sticker.title}
                    </h3>
                    <p className="mt-2 max-w-[26ch] text-[12px] leading-relaxed opacity-70">
                      {sticker.line}
                    </p>
                  </div>

                  <div className="relative mt-4 flex items-center justify-between border-t border-current/10 pt-3 text-[10px] font-medium">
                    <span className="opacity-60">Workspace module</span>
                    <span className="inline-flex items-center gap-1 opacity-80 transition-transform duration-300 group-hover:translate-x-1">
                      Connected
                      <span aria-hidden="true">→</span>
                    </span>
                  </div>
                </motion.article>
              </Reveal>
            );
          })}
        </div>

        <p className="mt-8 font-mono text-[9.5px] uppercase tracking-[0.16em] text-[#928c82]">
          Features shown are part of the demo workspace · sample data only
        </p>
      </div>
    </section>
  );
}
