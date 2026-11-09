"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  Check,
  CircleDollarSign,
  Clock3,
  FileText,
  Inbox,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { addDays, differenceInCalendarDays, eachDayOfInterval, format, parseISO } from "date-fns";
import {
  Avatar,
  Badge,
  Button,
  Panel,
  Progress,
  useToast,
} from "@/components/ui";
import { DEMO_DATE } from "@/lib/demo-data";
import { useAppStore } from "@/lib/store";
import type { Tone } from "@/components/ui";
import type { Milestone } from "@/lib/types";
import {
  cn,
  formatMoney,
  formatTime,
  statusTone,
  sum,
} from "@/lib/utils";

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

function ScopeRing({ count }: { count: number }) {
  return (
    <div className="flex items-end gap-1" aria-hidden="true">
      {[0.92, 0.78, 0.46].slice(0, Math.max(count, 0)).map((confidence, index) => (
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

function WeekDots({
  milestones,
  start,
}: {
  milestones: Milestone[];
  start: Date;
}) {
  const todayIso = format(start, "yyyy-MM-dd");
  const days = eachDayOfInterval({
    start,
    end: addDays(start, 6),
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
              iso === todayIso
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
  const { push } = useToast();
  const {
    state,
    profile,
    isDemo,
    approveAction,
    recheckPayments,
  } = useAppStore();
  const { clients, projects, milestones, invoices, scopeFindings } =
    state.reference;
  const [priorityDone, setPriorityDone] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [approving, setApproving] = useState(false);

  // The seeded demo keeps its fixed scenario clock; a real workspace uses the
  // live date. Either way, every number below comes from the loaded snapshot.
  const referenceDate = isDemo ? parseISO(DEMO_DATE) : new Date();
  const weekStartIso = format(referenceDate, "yyyy-MM-dd");
  const weekEndIso = format(addDays(referenceDate, 7), "yyyy-MM-dd");

  const openInvoices = invoices.filter((invoice) =>
    ["sent", "overdue", "partially_paid"].includes(invoice.status),
  );
  const overdueInvoices = invoices.filter(
    (invoice) => invoice.status === "overdue",
  );
  const outstanding = sum(
    openInvoices.map((invoice) => invoice.amount - invoice.amountPaid),
  );
  const collected = sum(invoices.map((invoice) => invoice.amountPaid));
  const weekDeadlines = milestones
    .filter((milestone) => {
      if (milestone.status === "done") return false;
      return (
        milestone.dueAt >= weekStartIso && milestone.dueAt < weekEndIso
      );
    })
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const reviewFindings = scopeFindings.filter((finding) => {
    const review = state.findingReviews[finding.id] ?? finding.reviewState;
    return review === "potential" || review === "reviewing";
  });
  const scopeCount = reviewFindings.length;
  const activeLeads = state.leads.filter((lead) => lead.stage !== "won");
  const pipelineValue = sum(activeLeads.map((lead) => lead.value));
  const greetingName = profile.name.trim().split(/\s+/)[0] || profile.name;

  const attention = [
    weekDeadlines.length > 0
      ? `${weekDeadlines.length} deadline${weekDeadlines.length === 1 ? "" : "s"} this week`
      : null,
    overdueInvoices.length > 0
      ? `${overdueInvoices.length} overdue invoice${overdueInvoices.length === 1 ? "" : "s"}`
      : null,
    scopeCount > 0
      ? `${scopeCount} scope request${scopeCount === 1 ? "" : "s"} needing your call`
      : null,
  ].filter((part): part is string => Boolean(part));
  const hasWorkspaceData =
    clients.length + projects.length + milestones.length + invoices.length > 0;
  const summary =
    attention.length > 0
      ? `${attention.join(" · ")}. Everything below is traceable.`
      : hasWorkspaceData
        ? "Nothing needs your attention right now. Everything below is traceable."
        : "Your workspace is ready. Add a project or connect an integration to see deadlines, payments, and client signals here.";

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

  const priorities: {
    id: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    title: string;
    meta: string;
    href: string;
    badge: string;
    tone: Tone;
  }[] = [];

  reviewFindings.slice(0, 2).forEach((finding) => {
    priorities.push({
      id: finding.id,
      icon: Inbox,
      title: finding.title,
      meta: `${finding.platform} · ${Math.round(finding.confidence * 100)}% confidence${
        finding.estimate ? ` · ${formatMoney(finding.estimate)} estimate` : ""
      }`,
      href: "/app/inbox",
      badge: "Needs review",
      tone: "warning",
    });
  });

  overdueInvoices.slice(0, 1).forEach((invoice) => {
    const client = clients.find((item) => item.id === invoice.clientId);
    const remaining = invoice.amount - invoice.amountPaid;
    priorities.push({
      id: invoice.id,
      icon: CircleDollarSign,
      title: `${client?.company ?? "Client"} invoice is overdue`,
      meta: `${invoice.number} · ${formatMoney(remaining)} · due ${format(parseISO(invoice.dueAt), "d MMM")}`,
      href: "/app/payments",
      badge: "Overdue",
      tone: "danger",
    });
  });

  const nextDeadline = weekDeadlines[0];
  if (nextDeadline) {
    const project = projects.find(
      (item) => item.id === nextDeadline.projectId,
    );
    priorities.push({
      id: nextDeadline.id,
      icon: Clock3,
      title: `${nextDeadline.title}${project ? ` · ${project.name}` : ""}`,
      meta: `Due ${format(parseISO(nextDeadline.dueAt), "EEE d MMM")}${
        project ? ` · ${Math.round(project.progress)}% complete` : ""
      }`,
      href: project ? `/app/projects/${project.id}` : "/app/calendar",
      badge: `Due ${format(parseISO(nextDeadline.dueAt), "d MMM")}`,
      tone: "neutral",
    });
  }

  const nextLead = activeLeads[0];
  if (nextLead) {
    priorities.push({
      id: nextLead.id,
      icon: Users,
      title: `${nextLead.name} · ${nextLead.company}`,
      meta: nextLead.interest,
      href: "/app/leads",
      badge: "Lead",
      tone: "info",
    });
  }

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
      detail: `${invoices.length} invoice${invoices.length === 1 ? "" : "s"} checked. Nothing was changed externally.`,
    });
  };

  const days = eachDayOfInterval({
    start: referenceDate,
    end: addDays(referenceDate, 6),
  });

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="eyebrow">
              {format(referenceDate, "EEEE, d MMMM yyyy")} ·{" "}
              {state.preferences.timezone}
            </p>
            <Badge tone="yellow" className="!px-2 !py-0.5 !text-[9.5px]">
              {isDemo ? "Sample data" : "Your workspace"}
            </Badge>
          </div>
          <h2 className="mt-2 text-[clamp(1.9rem,3vw,2.5rem)] font-semibold leading-[1.08] tracking-[-0.035em]">
            Good afternoon, {greetingName}.
          </h2>
          <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-muted">
            {summary}
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
          hint={
            openInvoices.length > 0
              ? `${openInvoices.length} open invoice${openInvoices.length === 1 ? "" : "s"}`
              : "No open invoices"
          }
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
          hint={
            nextDeadline
              ? `Next: ${nextDeadline.title}`
              : "Nothing due this week"
          }
          href="/app/calendar"
          icon={CalendarClock}
          visual={<WeekDots milestones={milestones} start={referenceDate} />}
        />
        <KpiCard
          label="Scope changes"
          value={scopeCount}
          formatValue={(value) => String(Math.round(value))}
          hint={
            scopeCount > 0
              ? `${scopeCount} needing your call`
              : "No open scope changes"
          }
          href="/app/inbox"
          icon={ShieldCheck}
          visual={<ScopeRing count={scopeCount} />}
        />
        <KpiCard
          label="Active leads"
          value={activeLeads.length}
          formatValue={(value) => String(Math.round(value))}
          hint={
            activeLeads.length > 0
              ? `${formatMoney(pipelineValue)} in pipeline`
              : "No leads yet"
          }
          href="/app/leads"
          icon={Users}
          accent
          visual={
            activeLeads.length > 0 ? (
              <div className="flex -space-x-1.5" aria-hidden="true">
                {activeLeads.slice(0, 2).map((lead, index) => (
                  <Avatar
                    key={lead.id}
                    name={lead.name}
                    initials={lead.name
                      .trim()
                      .split(/\s+/)
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                    size="sm"
                    hue={index === 0 ? "orange" : "ink"}
                  />
                ))}
              </div>
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e0c65c] bg-white/55 text-ink">
                <Users size={15} />
              </span>
            )
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
            {priorities.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-[13px] font-medium">
                  {hasWorkspaceData ? "You're all caught up" : "Nothing here yet"}
                </p>
                <p className="mx-auto mt-1 max-w-sm text-[11.5px] leading-relaxed text-muted">
                  {hasWorkspaceData
                    ? "No overdue invoices, scope requests, or deadlines need your attention right now."
                    : "Add a project, log a lead, or connect an integration and today's priorities will appear here."}
                </p>
              </div>
            ) : (
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
            )}
            <div className="flex items-center justify-between border-t border-[#ece8e0] bg-[#fbfaf7] px-5 py-3">
              <p className="text-[11px] text-muted">
                Sources checked: {projects.length} project
                {projects.length === 1 ? "" : "s"} · {invoices.length} invoice
                {invoices.length === 1 ? "" : "s"} · {scopeFindings.length} finding
                {scopeFindings.length === 1 ? "" : "s"}
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
                const isToday = iso === weekStartIso;
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
                  {formatMoney(outstanding)} outstanding · {formatMoney(collected)}{" "}
                  collected
                </p>
              </div>
              <div className="flex items-center gap-2">
                {invoices.length === 0 ? (
                  <Badge tone="neutral" dot>
                    No invoices
                  </Badge>
                ) : invoices.some((invoice) => invoice.lastVerifiedAt) ? (
                  <Badge tone="success" dot>
                    Verified
                  </Badge>
                ) : (
                  <Badge tone="neutral" dot>
                    Not connected
                  </Badge>
                )}
                {invoices.length > 0 ? (
                  <Button size="sm" variant="ghost" onClick={sync} disabled={syncing}>
                    <RefreshCw size={12} className={cn(syncing && "animate-spin")} />
                    {syncing ? "Checking" : "Recheck"}
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="divide-y divide-[#f0ece5]">
              {openInvoices.length === 0 ? (
                <p className="px-5 py-8 text-center text-[11.5px] text-muted">
                  No open invoices. New payment requests appear here after you
                  create one.
                </p>
              ) : null}
              {openInvoices.map((invoice) => {
                const client = clients.find(
                  (item) => item.id === invoice.clientId,
                );
                const project = projects.find(
                  (item) => item.id === invoice.projectId,
                );
                const remaining = invoice.amount - invoice.amountPaid;
                const overdueDays =
                  invoice.status === "overdue"
                    ? Math.max(
                        1,
                        differenceInCalendarDays(
                          referenceDate,
                          parseISO(invoice.dueAt),
                        ),
                      )
                    : 0;
                return (
                  <Link
                    key={invoice.id}
                    href="/app/payments"
                    className="group flex items-center gap-3 px-5 py-3.5 transition hover:bg-[#fbfaf7]"
                  >
                    <Avatar
                      name={client?.name ?? "Client"}
                      initials={client?.initials ?? "—"}
                      hue={client?.hue ?? "stone"}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[12.5px] font-semibold">
                          {client?.company ?? "Client"}
                        </p>
                        <span className="font-mono text-[9.5px] text-muted">
                          {invoice.number}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-muted">
                        {project ? `${project.name} · ` : ""}due{" "}
                        {format(parseISO(invoice.dueAt), "d MMM")}
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
                          ? `${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue`
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
                  "What changed on my projects?",
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
                  {isDemo
                    ? "Demo only — no real email leaves this browser."
                    : "Nothing is sent until you approve it."}
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
            {scopeFindings.length === 0 ? (
              <p className="px-4 py-8 text-center text-[11.5px] text-muted">
                No client signals yet. Opted-in conversations appear here once
                they are ingested.
              </p>
            ) : (
              <ul className="divide-y divide-[#f0ece5]">
                {scopeFindings.slice(0, 3).map((finding) => {
                  const project = projects.find(
                    (item) => item.id === finding.projectId,
                  );
                  const review =
                    state.findingReviews[finding.id] ?? finding.reviewState;
                  const dismissed = review === "dismissed";
                  const accepted = review === "accepted";
                  return (
                    <li key={finding.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[9px] text-muted">
                          {project?.codename ?? "—"}
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
                    </li>
                  );
                })}
              </ul>
            )}
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
            {state.activities.length === 0 ? (
              <p className="px-4 py-8 text-center text-[11.5px] text-muted">
                No activity yet. Approved actions and syncs are recorded here.
              </p>
            ) : (
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
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
