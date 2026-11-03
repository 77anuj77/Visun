"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileText,
  Inbox,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { addDays, eachDayOfInterval, format, parseISO } from "date-fns";
import {
  Avatar,
  Badge,
  Button,
  Panel,
  Progress,
  useToast,
} from "@/components/ui";
import {
  clients,
  DEMO_NOW,
  invoices,
  leads as seedLeads,
  milestones,
  projects,
  scopeFindings,
  workspace,
} from "@/lib/demo-data";
import { useAppStore } from "@/lib/store";
import type { Tone } from "@/components/ui";
import { cn, formatMoney, formatTime, statusTone, sum } from "@/lib/utils";

function AnimatedValue({
  value,
  format: formatValue,
}: {
  value: number;
  format: (n: number) => string;
}) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);
  const started = useRef(false);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    if (started.current) {
      setDisplay(value);
      return;
    }
    started.current = true;
    let frame = 0;
    const start = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduce, value]);

  return <span className="tabular">{formatValue(display)}</span>;
}

function KpiCard({
  label,
  value,
  formatValue,
  hint,
  href,
  icon: Icon,
  visual,
  accent,
}: {
  label: string;
  value: number;
  formatValue: (n: number) => string;
  hint: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  visual: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "card-lift group relative flex min-h-[154px] flex-col justify-between overflow-hidden rounded-[22px] border p-5 shadow-neu-sm",
        accent
          ? "border-[#e7cf6f] bg-yellow"
          : "border-[#e3dfd7] bg-white",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow !text-[10px]">{label}</p>
          <p className="mt-2 text-[30px] font-semibold leading-none tracking-[-0.03em]">
            <AnimatedValue value={value} format={formatValue} />
          </p>
        </div>
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl border",
            accent
              ? "border-[#e0c65c] bg-white/55 text-ink"
              : "border-[#e6e1d8] bg-[#f8f7f3] text-[#6f6a62]",
          )}
        >
          <Icon size={16} />
        </span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="text-[11.5px] leading-snug text-[#6a665f]">{hint}</p>
        <div className="shrink-0">{visual}</div>
      </div>
      <ArrowUpRight
        size={14}
        className="absolute bottom-4 right-4 text-transparent transition group-hover:text-ink/40"
      />
    </Link>
  );
}

function ScopeRing() {
  const { state } = useAppStore();
  const count = Object.values(state.findingReviews).filter(
    (value) => value === "potential" || value === "reviewing",
  ).length;
  return (
    <div className="flex items-end gap-1" aria-hidden="true">
      {[0.92, 0.78, 0.46].slice(0, count).map((confidence, index) => (
        <span
          key={index}
          className={cn(
            "w-2.5 rounded-full",
            confidence > 0.8 ? "bg-orange" : confidence > 0.6 ? "bg-[#ffb27f]" : "bg-[#ffd9bf]",
          )}
          style={{ height: `${confidence * 34}px` }}
        />
      ))}
    </div>
  );
}

function WeekDots() {
  const days = eachDayOfInterval({
    start: parseISO("2026-11-03"),
    end: parseISO("2026-11-09"),
  });
  return (
    <div className="flex gap-1" aria-hidden="true">
      {days.map((day) => {
        const iso = format(day, "yyyy-MM-dd");
        const busy = milestones.some(
          (milestone) =>
            milestone.dueAt.startsWith(iso) && milestone.status !== "done",
        );
        return (
          <span
            key={iso}
            className={cn(
              "h-5 w-2 rounded-full",
              iso === "2026-11-03"
                ? "bg-ink"
                : busy
                  ? "bg-orange"
                  : "bg-[#e4dfd6]",
            )}
          />
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const { push } = useToast();
  const {
    state,
    approveAction,
    rejectAction,
    recheckPayments,
    reviewFinding,
    hydrated,
  } = useAppStore();
  const [priorityDone, setPriorityDone] = useState<string[]>(["p-lead"]);
  const [syncing, setSyncing] = useState(false);
  const [approving, setApproving] = useState(false);

  const openInvoices = invoices.filter((invoice) =>
    ["sent", "overdue", "partially_paid"].includes(invoice.status),
  );
  const outstanding = sum(
    openInvoices.map((invoice) => invoice.amount - invoice.amountPaid),
  );
  const weekDeadlines = milestones.filter((milestone) => {
    if (milestone.status === "done") return false;
    return milestone.dueAt >= "2026-11-03" && milestone.dueAt < "2026-11-10";
  });
  const scopeCount = Object.values(state.findingReviews).filter(
    (value) => value === "potential" || value === "reviewing",
  ).length;
  const leadsToday = state.leads.filter((lead) =>
    lead.receivedAt.startsWith("2026-11-03"),
  ).length;

  const pendingApproval = useMemo(() => {
    for (const conversation of state.conversations) {
      for (const message of conversation.messages) {
        if (message.action?.status === "pending_approval") {
          return { conversation, message, action: message.action };
        }
      }
    }
    return null;
  }, [state.conversations]);

  const priorities = [
    {
      id: "p-scope",
      icon: Inbox,
      title: "Rahul requested login + payments",
      meta: "Potential scope change · 92% confidence · $950 estimate",
      href: "/app/inbox",
      badge: "Needs review",
      tone: "warning" as Tone,
    },
    {
      id: "p-invoice",
      icon: CircleDollarSign,
      title: "Okafor invoice is 2 days overdue",
      meta: "INV-1045 · $800 · verified 09:02",
      href: "/app/payments",
      badge: "Overdue",
      tone: "danger" as Tone,
    },
    {
      id: "p-build",
      icon: Clock3,
      title: "Northwind marketing build due Friday",
      meta: "64% complete · staging review at 4pm",
      href: "/app/projects/p-northwind",
      badge: "Due 6 Nov",
      tone: "neutral" as Tone,
    },
    {
      id: "p-lead",
      icon: Users,
      title: "Nina Patel asked about four landing pages",
      meta: "Referral from Maya · reply by 4pm today",
      href: "/app/leads",
      badge: "Lead",
      tone: "info" as Tone,
    },
  ];

  const togglePriority = (id: string, title: string) => {
    setPriorityDone((current) => {
      const done = current.includes(id);
      push({
        tone: done ? "info" : "success",
        title: done ? "Marked as open" : "Nice — marked as done",
        detail: title,
      });
      return done ? current.filter((item) => item !== id) : [...current, id];
    });
  };

  const handleApprove = async () => {
    if (!pendingApproval?.action) return;
    setApproving(true);
    const providerId = await approveAction(
      pendingApproval.conversation.id,
      pendingApproval.message.id,
      pendingApproval.action,
    );
    setApproving(false);
    push({
      tone: "success",
      title: "Reminder sent once",
      detail: `Provider message ${providerId}. The result is in Activity.`,
    });
  };

  const sync = async () => {
    setSyncing(true);
    await recheckPayments();
    setSyncing(false);
    push({
      tone: "success",
      title: "PayPal Sandbox reconciled",
      detail: "Five invoices checked. No status changes since 09:02.",
    });
  };

  const days = eachDayOfInterval({
    start: parseISO("2026-11-03"),
    end: parseISO("2026-11-09"),
  });

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="eyebrow">
              Tuesday, 3 November 2026 · {workspace.timezone}
            </p>
            <Badge tone="yellow" className="!px-2 !py-0.5 !text-[9.5px]">
              Sample data
            </Badge>
          </div>
          <h2 className="mt-2 text-[clamp(1.9rem,3vw,2.5rem)] font-semibold leading-[1.08] tracking-[-0.035em]">
            Good afternoon, Ayush.
          </h2>
          <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-muted">
            One deadline risk, one overdue invoice, and a scope request that needs
            your call. Everything below is traceable.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="md"
            onClick={() => router.push("/app/reports?generate=1")}
          >
            <FileText size={15} /> Generate report
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => router.push("/app/copilot")}
            className="cta-shine overflow-hidden"
          >
            <Sparkles size={15} /> Ask Visun
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Outstanding"
          value={outstanding}
          formatValue={(value) => formatMoney(value)}
          hint="3 invoices · verified 09:02"
          href="/app/payments"
          icon={Wallet}
          visual={
            <div className="flex h-9 items-end gap-1" aria-hidden="true">
              <span className="h-3 w-2 rounded-full bg-[#e4dfd6]" />
              <span className="h-5 w-2 rounded-full bg-[#e4dfd6]" />
              <span className="h-9 w-2 rounded-full bg-orange" />
              <span className="h-6 w-2 rounded-full bg-[#ffc09b]" />
            </div>
          }
        />
        <KpiCard
          label="Due this week"
          value={weekDeadlines.length}
          formatValue={(value) => String(Math.round(value))}
          hint="Next: Northwind, Fri 6 Nov"
          href="/app/calendar"
          icon={CalendarClock}
          visual={<WeekDots />}
        />
        <KpiCard
          label="Scope changes"
          value={scopeCount}
          formatValue={(value) => String(Math.round(value))}
          hint="1 high confidence · needs your call"
          href="/app/inbox"
          icon={ShieldCheck}
          visual={<ScopeRing />}
        />
        <KpiCard
          label="Leads today"
          value={leadsToday}
          formatValue={(value) => String(Math.round(value))}
          hint="2 new · $8,800 pipeline today"
          href="/app/leads"
          icon={Users}
          accent
          visual={
            <div className="flex -space-x-1.5" aria-hidden="true">
              <Avatar name="Nina Patel" initials="NP" size="sm" hue="orange" />
              <Avatar name="Tom Alvarez" initials="TA" size="sm" hue="ink" />
            </div>
          }
        />
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-8">
          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between gap-4 border-b border-[#ece8e0] px-5 py-4">
              <div>
                <h3 className="text-[15px] font-semibold tracking-tight">
                  Today&apos;s focus
                </h3>
                <p className="mt-0.5 text-[11.5px] text-muted">
                  Ranked by consequence, not by notification volume.
                </p>
              </div>
              <Badge tone="neutral" dot>
                {priorities.length - priorityDone.length} open
              </Badge>
            </div>
            <ul className="divide-y divide-[#f0ece5]">
              {priorities.map((item) => {
                const done = priorityDone.includes(item.id);
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <div className="group flex items-start gap-3 px-5 py-3.5 transition hover:bg-[#fbfaf7]">
                      <button
                        onClick={() => togglePriority(item.id, item.title)}
                        className={cn(
                          "mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border transition",
                          done
                            ? "border-success bg-success text-white"
                            : "border-[#cfc9be] bg-white text-transparent hover:border-orange hover:text-orange",
                        )}
                        aria-label={done ? `Reopen ${item.title}` : `Complete ${item.title}`}
                        aria-pressed={done}
                      >
                        <Check size={12} strokeWidth={3} />
                      </button>
                      <span
                        className={cn(
                          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#e6e1d8] bg-[#f8f7f3] text-[#6f6a62]",
                          done && "opacity-50",
                        )}
                      >
                        <Icon size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={item.href}
                            className={cn(
                              "text-[13.5px] font-semibold leading-snug transition group-hover:text-orange",
                              done && "text-muted line-through decoration-[#c9c3b8]",
                            )}
                          >
                            {item.title}
                          </Link>
                          <Badge tone={item.tone} className="!py-0.5 !text-[9.5px]">
                            {item.badge}
                          </Badge>
                        </div>
                        <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
                          {item.meta}
                        </p>
                      </div>
                      <Link
                        href={item.href}
                        className="mt-1 hidden shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted transition hover:bg-stone hover:text-ink sm:flex"
                      >
                        Open <ArrowRight size={11} />
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center justify-between border-t border-[#ece8e0] bg-[#fbfaf7] px-5 py-3">
              <p className="text-[11px] text-muted">
                Sources checked: 5 projects · 6 invoices · 4 findings
              </p>
              <Link
                href="/app/activity"
                className="flex items-center gap-1 text-[11.5px] font-medium text-ink hover:text-orange"
              >
                Activity <ArrowUpRight size={12} />
              </Link>
            </div>
          </Panel>

          <Panel className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-[15px] font-semibold tracking-tight">
                  Next seven days
                </h3>
                <p className="mt-0.5 text-[11.5px] text-muted">
                  Stored milestones only · Google Calendar is not connected.
                </p>
              </div>
              <Link
                href="/app/calendar"
                className="flex items-center gap-1 text-[11.5px] font-medium text-muted hover:text-ink"
              >
                Open calendar <ArrowRight size={12} />
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-7 gap-1.5">
              {days.map((day) => {
                const iso = format(day, "yyyy-MM-dd");
                const dayMilestones = milestones.filter(
                  (milestone) =>
                    milestone.dueAt.startsWith(iso) && milestone.status !== "done",
                );
                const isToday = iso === "2026-11-03";
                return (
                  <Link
                    key={iso}
                    href="/app/calendar"
                    className={cn(
                      "flex min-h-[96px] flex-col rounded-xl border p-2 transition hover:border-[#cfc8bb] hover:bg-white",
                      isToday
                        ? "border-ink/20 bg-white shadow-neu-sm"
                        : "border-[#ece8e0] bg-[#faf9f6]",
                    )}
                  >
                    <span
                      className={cn(
                        "font-mono text-[9px] uppercase tracking-wider",
                        isToday ? "text-orange" : "text-muted",
                      )}
                    >
                      {format(day, "EEE")}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 text-[15px] font-semibold leading-none",
                        isToday && "text-orange",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    <span className="mt-2 flex flex-1 flex-col gap-1">
                      {dayMilestones.map((milestone) => (
                        <span
                          key={milestone.id}
                          className="line-clamp-2 rounded-md bg-[#fff0e6] px-1.5 py-1 text-[8.5px] font-medium leading-tight text-[#9a3b00]"
                        >
                          {milestone.title}
                        </span>
                      ))}
                      {dayMilestones.length === 0 && isToday ? (
                        <span className="rounded-md bg-[#eef4ee] px-1.5 py-1 text-[8.5px] font-medium leading-tight text-success">
                          Clear
                        </span>
                      ) : null}
                    </span>
                  </Link>
                );
              })}
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ece8e0] px-5 py-4">
              <div>
                <h3 className="text-[15px] font-semibold tracking-tight">
                  Money in motion
                </h3>
                <p className="mt-0.5 text-[11.5px] text-muted">
                  {formatMoney(outstanding)} outstanding · {formatMoney(5000)}{" "}
                  verified collected
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="success" dot>
                  PayPal verified
                </Badge>
                <Button size="sm" variant="ghost" onClick={sync} disabled={syncing}>
                  <RefreshCw size={12} className={cn(syncing && "animate-spin")} />
                  {syncing ? "Checking" : "Recheck"}
                </Button>
              </div>
            </div>
            <div className="divide-y divide-[#f0ece5]">
              {openInvoices.map((invoice) => {
                const client = clients.find((item) => item.id === invoice.clientId)!;
                const project = projects.find((item) => item.id === invoice.projectId)!;
                const remaining = invoice.amount - invoice.amountPaid;
                return (
                  <Link
                    key={invoice.id}
                    href="/app/payments"
                    className="group flex items-center gap-3 px-5 py-3.5 transition hover:bg-[#fbfaf7]"
                  >
                    <Avatar
                      name={client.name}
                      initials={client.initials}
                      hue={client.hue}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[12.5px] font-semibold">
                          {client.company}
                        </p>
                        <span className="font-mono text-[9.5px] text-muted">
                          {invoice.number}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-muted">
                        {project.name} · due {format(parseISO(invoice.dueAt), "d MMM")}
                      </p>
                      {invoice.status === "partially_paid" ? (
                        <Progress
                          value={(invoice.amountPaid / invoice.amount) * 100}
                          className="mt-2 max-w-[220px]"
                        />
                      ) : null}
                    </div>
                    <div className="text-right">
                      <p className="tabular text-[13.5px] font-semibold">
                        {formatMoney(remaining)}
                      </p>
                      <Badge
                        tone={statusTone(invoice.status)}
                        className="mt-1 !px-2 !py-0.5 !text-[9px]"
                      >
                        {invoice.status === "overdue"
                          ? "2 days overdue"
                          : invoice.status === "partially_paid"
                            ? "Part paid"
                            : "Awaiting"}
                      </Badge>
                    </div>
                    <ArrowRight
                      size={14}
                      className="hidden shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-ink sm:block"
                    />
                  </Link>
                );
              })}
            </div>
          </Panel>
        </div>

        <div className="space-y-5 xl:col-span-4">
          <div className="relative overflow-hidden rounded-[24px] bg-ink p-5 text-canvas shadow-[0_24px_50px_-26px_rgba(0,0,0,0.65)]">
            <div
              className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-orange/25 blur-2xl"
              aria-hidden="true"
            />
            <div className="relative">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-white/55">
                  Visun copilot
                </p>
                <span className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[9px] font-medium text-white/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#8ce0b4]" />
                  Ready
                </span>
              </div>
              <div className="mt-5 flex items-center gap-4">
                <button
                  onClick={() => router.push("/app/copilot")}
                  className="group relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-orange text-ink shadow-[0_12px_30px_-8px_rgba(255,90,0,0.75)] transition hover:scale-[1.03] active:scale-95"
                  aria-label="Open voice copilot"
                >
                  <span className="absolute inset-0 animate-pulse-ring rounded-full border border-orange/60" />
                  <span className="flex items-end gap-[3px]" aria-hidden="true">
                    {[10, 20, 28, 18, 12].map((height, index) => (
                      <span
                        key={index}
                        className="w-[3px] rounded-full bg-ink/80"
                        style={{ height }}
                      />
                    ))}
                  </span>
                </button>
                <div>
                  <p className="font-serif text-[24px] leading-[1.05] tracking-tight text-white">
                    Ask anything.
                    <br />
                    See the evidence.
                  </p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-white/55">
                    Voice or text. Same history, same tools, same audit trail.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-col gap-1.5">
                {[
                  "What is due this week?",
                  "How much is still unpaid?",
                  "What changed on Rahul's project?",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() =>
                      router.push(
                        `/app/copilot?prompt=${encodeURIComponent(prompt)}`,
                      )
                    }
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2.5 text-left text-[11.5px] text-white/80 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                  >
                    {prompt}
                    <ArrowUpRight size={12} className="shrink-0 text-white/35" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {pendingApproval ? (
            <Panel className="overflow-hidden border-[#ecd9a3]">
              <div className="flex items-center justify-between bg-[#fff8e2] px-4 py-2.5">
                <span className="flex items-center gap-1.5 text-[10.5px] font-semibold text-[#7a5a00]">
                  <ShieldCheck size={13} /> Needs your approval
                </span>
                <span className="font-mono text-[9px] text-[#8b7330]">
                  Nothing sent
                </span>
              </div>
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fff3cf] text-[#7a5a00]">
                    <Mail size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-semibold">
                      {pendingApproval.action.title}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted">
                      {pendingApproval.action.recipient}
                    </p>
                    <p className="mt-2 text-[11px] text-muted">
                      {formatMoney(pendingApproval.action.amount ?? 0)} ·{" "}
                      {pendingApproval.action.provider} · exact payload locked
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    className="flex-1"
                    onClick={handleApprove}
                    loading={approving}
                  >
                    {approving ? "Sending…" : "Approve & send"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push("/app/copilot")}
                  >
                    Review
                  </Button>
                </div>
                <p className="mt-2 text-center text-[9.5px] text-muted">
                  Demo only — no real email leaves this browser.
                </p>
              </div>
            </Panel>
          ) : null}

          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#ece8e0] px-4 py-3">
              <h3 className="text-[13.5px] font-semibold">Client signals</h3>
              <Link
                href="/app/inbox"
                className="text-[10.5px] font-medium text-muted hover:text-ink"
              >
                Open inbox
              </Link>
            </div>
            <ul className="divide-y divide-[#f0ece5]">
              {scopeFindings.slice(0, 3).map((finding) => {
                const project = projects.find((item) => item.id === finding.projectId)!;
                const review = state.findingReviews[finding.id];
                const dismissed = review === "dismissed";
                const accepted = review === "accepted";
                return (
                  <li key={finding.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[9px] text-muted">
                        {project.codename}
                      </span>
                      <Badge
                        tone={accepted ? "success" : dismissed ? "neutral" : "warning"}
                        className="!px-2 !py-0.5 !text-[9px]"
                      >
                        {accepted ? "Accepted" : dismissed ? "Dismissed" : "Needs review"}
                      </Badge>
                    </div>
                    <Link
                      href="/app/inbox"
                      className="mt-1.5 block text-[12px] font-medium leading-snug hover:text-orange"
                    >
                      {finding.title}
                    </Link>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#ece8e0]">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            finding.confidence > 0.8
                              ? "bg-orange"
                              : finding.confidence > 0.6
                                ? "bg-[#e1a400]"
                                : "bg-[#a8a297]",
                          )}
                          style={{ width: `${finding.confidence * 100}%` }}
                        />
                      </div>
                      <span className="tabular text-[9px] text-muted">
                        {Math.round(finding.confidence * 100)}% confidence
                      </span>
                    </div>
                    {!hydrated ? null : null}
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#ece8e0] px-4 py-3">
              <h3 className="text-[13.5px] font-semibold">Recent activity</h3>
              <Link
                href="/app/activity"
                className="text-[10.5px] font-medium text-muted hover:text-ink"
              >
                All
              </Link>
            </div>
            <ol className="space-y-0 px-4 py-1">
              {state.activities.slice(0, 4).map((event, index) => (
                <li key={event.id} className="flex gap-3 py-2.5">
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        "mt-1 h-1.5 w-1.5 rounded-full",
                        event.status === "failed"
                          ? "bg-danger"
                          : event.status === "pending"
                            ? "bg-warning"
                            : event.status === "success"
                              ? "bg-success"
                              : "bg-[#b9b3a8]",
                      )}
                    />
                    {index < 3 ? (
                      <span className="mt-1 w-px flex-1 bg-[#e8e4dc]" />
                    ) : null}
                  </div>
                  <div className="min-w-0 pb-1">
                    <p className="text-[11.5px] font-medium leading-snug">
                      {event.title}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted">
                      {event.actor} · {formatTime(event.at)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>

      {seedLeads.length === 0 ? null : null}
    </div>
  );
}
