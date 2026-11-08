"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import {
  CalendarDays,
  Check,
  Loader2,
  Mic,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A clearly illustrative voice-agent walkthrough. Every record, amount, and
 * reference below is sample data. Approving the draft only advances this local
 * animation — it never calls the backend, the assistant, or a provider.
 */

const request =
  "Move the Northwind review to Thursday, and flag the unpaid invoice.";

const tools = [
  {
    name: "find_project",
    query: 'workspace: "Northwind"',
    result: "NW · review milestone",
  },
  {
    name: "check_calendar",
    query: 'slot: "Thu 12 Nov"',
    result: "free · 15:00 UTC",
  },
  {
    name: "get_invoice",
    query: 'invoice: "INV-1044"',
    result: "$1,800 · unpaid",
  },
] as const;

const delays = [1200, 1500, 1300, 900, 900, 1000];

type Outcome = "approved" | "declined" | null;

export function AgentPreview() {
  const reduce = useReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const inView = useInView(stage, { once: true, amount: 0.35 });

  // 0 idle · 1 listening · 2 transcript · 3 thinking · 4–6 tools ·
  // 7 awaiting approval · 8 executing · 9 finished
  const [phase, setPhase] = useState(reduce ? 7 : 0);
  const [playing, setPlaying] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);

  useEffect(() => {
    if (reduce) return;
    if (inView && phase === 0) setPlaying(true);
  }, [inView, phase, reduce]);

  useEffect(() => {
    // `useReducedMotion` resolves after mount, so jump straight to the
    // approval card instead of leaving a reduced-motion visitor on a blank
    // idle stage.
    if (reduce && phase === 0) setPhase(7);
  }, [phase, reduce]);

  useEffect(() => {
    if (!playing || reduce) return;
    if (phase >= 7) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(
      () => setPhase((value) => value + 1),
      delays[phase] ?? 1000,
    );
    return () => window.clearTimeout(timer);
  }, [phase, playing, reduce]);

  const decide = (next: Exclude<Outcome, null>) => {
    setOutcome(next);
    setPhase(8);
    setPlaying(true);
  };

  const replay = () => {
    setOutcome(null);
    setPhase(reduce ? 7 : 0);
    setPlaying(!reduce);
  };

  const finished = phase >= 9;
  const approved = finished && outcome === "approved";

  return (
    <section
      ref={stage}
      id="agent"
      className="relative scroll-mt-24 overflow-hidden py-16 lg:py-24"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-10 h-56 w-[70%] -translate-x-1/2 rounded-full bg-orange/10 blur-3xl"
      />
      <div className="mx-auto max-w-[1320px] px-5 sm:px-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <h2 className="max-w-[19ch] font-sans text-[clamp(2.2rem,4.6vw,4rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-ink">
            Ask out loud.
            <span className="ml-3 font-serif font-normal italic tracking-[-0.02em] text-orange">
              Watch it work.
            </span>
          </h2>
          <p className="max-w-sm text-[13.5px] leading-relaxed text-[#5f5a53]">
            One request, three read-only checks, and a draft that waits for your
            click. This is the real interaction model, running on sample data.
          </p>
        </div>

        <div className="mt-9 overflow-hidden rounded-[30px] border border-[#dad5ca] bg-white p-2 shadow-[0_38px_80px_-40px_rgba(35,31,24,0.5)] lg:p-2.5">
          <div className="grid gap-2 lg:grid-cols-[1.12fr_0.88fr]">
            {/* Conversation side */}
            <div className="rounded-[24px] border border-black bg-ink p-4 text-canvas sm:p-5">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange text-ink">
                    <Sparkles size={14} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[11.5px] font-semibold leading-tight">
                      Visun agent
                    </p>
                    <p className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-white/40">
                      Voice · preview
                    </p>
                  </div>
                </div>
                <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-white/55">
                  24 Nov · 09:12
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {/* User turn */}
                {phase >= 1 ? (
                  <motion.div
                    initial={reduce ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="ml-auto max-w-[92%] rounded-[18px] rounded-br-[6px] border border-[#e24f00] bg-orange p-3.5 text-ink"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-orange">
                        <Mic size={12} aria-hidden="true" />
                      </span>
                      <Waveform active={phase < 2} />
                      <span className="ml-auto font-mono text-[8.5px] uppercase tracking-[0.1em] text-[#7a2c05]">
                        {phase < 2 ? "Listening" : "0:07"}
                      </span>
                    </div>
                    {phase >= 2 ? (
                      <p className="mt-2.5 text-[12.5px] leading-relaxed">
                        “{request}”
                      </p>
                    ) : (
                      <p className="mt-2.5 text-[10.5px] italic text-[#6a2708]">
                        Transcribing…
                      </p>
                    )}
                  </motion.div>
                ) : null}

                {/* Thinking */}
                {phase === 3 ? (
                  <div className="flex items-center gap-2 text-white/55">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                      <Sparkles size={12} aria-hidden="true" />
                    </span>
                    <span className="flex items-end gap-1" aria-hidden="true">
                      {[0, 1, 2].map((dot) => (
                        <span
                          key={dot}
                          className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/60"
                          style={{ animationDelay: `${dot * 120}ms` }}
                        />
                      ))}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-[0.12em]">
                      Reading the workspace
                    </span>
                  </div>
                ) : null}

                {/* Tool calls */}
                {phase >= 4 ? (
                  <div className="space-y-1.5">
                    {tools.map((tool, index) => {
                      const visible = phase >= index + 4;
                      if (!visible) return null;
                      const done = phase > index + 4 || phase >= 7;
                      return (
                        <motion.div
                          key={tool.name}
                          initial={reduce ? false : { opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.28 }}
                          className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2"
                        >
                          <span className="flex items-center gap-1.5 font-mono text-[9.5px] text-white/80">
                            {done ? (
                              <Check size={10} className="text-[#8ce0b4]" aria-hidden="true" />
                            ) : (
                              <Loader2 size={10} className="animate-spin text-orange" aria-hidden="true" />
                            )}
                            {tool.name}
                          </span>
                          <span className="font-mono text-[8.5px] text-white/35">
                            {tool.query}
                          </span>
                          {done ? (
                            <span className="ml-auto font-mono text-[8.5px] text-white/60">
                              → {tool.result}
                            </span>
                          ) : null}
                        </motion.div>
                      );
                    })}
                  </div>
                ) : null}

                {/* Assistant summary + approval */}
                {phase >= 7 ? (
                  <motion.div
                    initial={reduce ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="max-w-[94%] rounded-[18px] rounded-bl-[6px] border border-white/12 bg-white/[0.07] p-3.5"
                  >
                    <p className="text-[12px] leading-relaxed text-white/85">
                      The review is free on Thursday at 15:00. INV-1044 is still
                      unpaid at $1,800. I prepared both updates:
                    </p>

                    <div className="mt-3 space-y-1.5 text-[10.5px]">
                      <p className="flex items-center gap-2 rounded-lg bg-white/[0.05] px-2.5 py-1.5 text-white/70">
                        <CalendarDays size={11} className="text-orange" aria-hidden="true" />
                        Reschedule Northwind review → Thu 12 Nov · 15:00
                      </p>
                      <p className="flex items-center gap-2 rounded-lg bg-white/[0.05] px-2.5 py-1.5 text-white/70">
                        <Wallet size={11} className="text-orange" aria-hidden="true" />
                        Add payment follow-up for INV-1044 · $1,800
                      </p>
                    </div>

                    {outcome === null ? (
                      <div className="mt-3.5 rounded-xl border border-yellow/30 bg-yellow/[0.1] p-2.5">
                        <p className="flex items-center gap-1.5 font-mono text-[8.5px] uppercase tracking-[0.12em] text-yellow">
                          <ShieldCheck size={10} aria-hidden="true" />
                          Waiting for your approval
                        </p>
                        <div className="mt-2 flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => decide("approved")}
                            className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-orange px-3 text-[10.5px] font-semibold text-ink transition hover:bg-[#ff6d1f] active:translate-y-px"
                          >
                            <Check size={11} aria-hidden="true" />
                            Approve updates
                          </button>
                          <button
                            type="button"
                            onClick={() => decide("declined")}
                            className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-white/20 px-3 text-[10.5px] text-white/70 transition hover:bg-white/10 hover:text-white"
                          >
                            <X size={11} aria-hidden="true" />
                            Decline
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {phase === 8 ? (
                      <p className="mt-3 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-white/55">
                        <Loader2 size={11} className="animate-spin text-orange" aria-hidden="true" />
                        Applying the approved changes…
                      </p>
                    ) : null}

                    {finished ? (
                      <div
                        className={cn(
                          "mt-3 rounded-xl border p-2.5 text-[10.5px] leading-relaxed",
                          approved
                            ? "border-[#8ce0b4]/30 bg-[#8ce0b4]/[0.08] text-[#b9f0d3]"
                            : "border-white/15 bg-white/[0.05] text-white/65",
                        )}
                      >
                        {approved ? (
                          <>
                            <p className="flex items-center gap-1.5 font-mono text-[8.5px] uppercase tracking-[0.12em] text-[#8ce0b4]">
                              <Check size={10} aria-hidden="true" /> Applied · demo only
                            </p>
                            <p className="mt-1.5">
                              Calendar hold set for Thu 12 Nov · 15:00. Follow-up
                              added for INV-1044. Activity entry{" "}
                              <span className="font-mono">demo-9f21a4</span>.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="flex items-center gap-1.5 font-mono text-[8.5px] uppercase tracking-[0.12em] text-white/60">
                              <X size={10} aria-hidden="true" /> Declined · nothing sent
                            </p>
                            <p className="mt-1.5">
                              The draft was discarded. No calendar change and no
                              payment follow-up were created.
                            </p>
                          </>
                        )}
                      </div>
                    ) : null}
                  </motion.div>
                ) : null}
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/10 pt-3">
                <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-white/35">
                  Illustrative conversation · no backend call
                </p>
                <button
                  type="button"
                  onClick={replay}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 text-[10px] font-medium text-white/70 transition hover:border-white/30 hover:text-white active:translate-y-px"
                >
                  {phase === 0 ? (
                    <Play size={10} aria-hidden="true" />
                  ) : (
                    <RotateCcw size={10} aria-hidden="true" />
                  )}
                  {phase === 0 ? "Play" : "Replay"}
                </button>
              </div>
            </div>

            {/* Workspace side */}
            <div className="rounded-[24px] bg-[#f4f1ea] p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[#8f8a80]">
                  Workspace updates
                </p>
                <span className="rounded-full border border-[#dcd6cc] bg-white px-2 py-0.5 font-mono text-[7.5px] uppercase tracking-[0.1em] text-[#8f8a80]">
                  Draft
                </span>
              </div>

              <div className="mt-3 space-y-2">
                <UpdateRow
                  icon={CalendarDays}
                  title="Calendar"
                  detail="Northwind review · Thu 12 Nov · 15:00"
                  pendingLabel="Awaiting approval"
                  done={approved}
                  declined={finished && outcome === "declined"}
                />
                <UpdateRow
                  icon={Wallet}
                  title="Payments"
                  detail="Follow-up · INV-1044 · $1,800"
                  pendingLabel="Awaiting approval"
                  done={approved}
                  declined={finished && outcome === "declined"}
                />
                <UpdateRow
                  icon={Sparkles}
                  title="Activity"
                  detail="Approval request · demo workspace"
                  pendingLabel="Will be logged"
                  doneLabel="Logged · demo"
                  done={finished}
                  declined={false}
                />
              </div>

              <div className="mt-4 rounded-2xl border border-[#dcd6cc] bg-white p-3">
                <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-[#8f8a80]">
                  Guardrails
                </p>
                <ul className="mt-2 space-y-1.5 text-[10.5px] leading-relaxed text-[#5f5a53]">
                  {[
                    "Read-only tools run before any write.",
                    "Voice alone can never approve an action.",
                    "Demo data only — nothing is charged.",
                  ].map((line) => (
                    <li key={line} className="flex gap-2">
                      <Check size={11} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="mt-3 font-mono text-[8px] uppercase leading-relaxed tracking-[0.1em] text-[#a39d93]">
                Sample records · not connected to PayPal or a real calendar
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Waveform({ active }: { active: boolean }) {
  const bars = [8, 16, 24, 12, 20, 10, 26, 14, 22, 9, 18, 24, 11];
  return (
    <span className="flex items-end gap-[3px]" aria-hidden="true">
      {bars.map((height, index) => (
        <span
          key={index}
          className={cn(
            "w-[2.5px] rounded-full bg-[#6a2708]/80",
            active && "mk-wave",
          )}
          style={{
            height,
            animationDelay: `${index * 60}ms`,
          }}
        />
      ))}
    </span>
  );
}

function UpdateRow({
  icon: Icon,
  title,
  detail,
  pendingLabel,
  doneLabel = "Applied · demo",
  done,
  declined,
}: {
  icon: typeof CalendarDays;
  title: string;
  detail: string;
  pendingLabel: string;
  doneLabel?: string;
  done: boolean;
  declined: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[#e2ddd3] bg-white/80 p-3">
      <div className="flex items-start gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#e6e1d8] bg-[#faf9f6] text-[#6f6a62]">
          <Icon size={12} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold text-ink">{title}</p>
          <p className="mt-0.5 text-[9.5px] leading-relaxed text-[#7a756c]">
            {detail}
          </p>
        </div>
      </div>
      <p
        className={cn(
          "mt-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[7.5px] uppercase tracking-[0.1em]",
          done
            ? "bg-[#e5f3ec] text-[#1c6142]"
            : declined
              ? "bg-[#f6e3e1] text-[#8f302b]"
              : "bg-[#f3efe5] text-[#8a7550]",
        )}
      >
        {done ? (
          <Check size={9} aria-hidden="true" />
        ) : declined ? (
          <X size={9} aria-hidden="true" />
        ) : null}
        {done ? doneLabel : declined ? "Cancelled" : pendingLabel}
      </p>
    </div>
  );
}
