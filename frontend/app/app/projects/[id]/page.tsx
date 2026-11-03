"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  FileCheck2,
  FileSignature,
  Mail,
  MessageSquare,
  ReceiptText,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Panel,
  Progress,
  useToast,
} from "@/components/ui";
import {
  agreements,
  clientMessages,
  clients,
  invoices,
  milestones,
  projects,
  scopeFindings,
} from "@/lib/demo-data";
import { useAppStore } from "@/lib/store";
import type { ScopeFinding } from "@/lib/types";
import {
  cn,
  formatDate,
  formatMoney,
  formatTime,
  pct,
  reviewLabel,
  statusTone,
  sum,
} from "@/lib/utils";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "agreement", label: "Agreement" },
  { id: "milestones", label: "Milestones" },
  { id: "messages", label: "Messages" },
  { id: "scope", label: "Scope changes" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { push } = useToast();
  const {
    state,
    toggleMilestone,
    reviewFinding,
  } = useAppStore();
  const [tab, setTab] = useState<TabId>("overview");

  const project = projects.find((item) => item.id === params.id);
  const client = project
    ? clients.find((item) => item.id === project.clientId)
    : undefined;
  const agreement = agreements.find((item) => item.projectId === params.id);
  const projectMilestones = useMemo(
    () => milestones.filter((milestone) => milestone.projectId === params.id),
    [params.id],
  );
  const projectInvoices = invoices.filter(
    (invoice) => invoice.projectId === params.id,
  );
  const findings = scopeFindings.filter(
    (finding) => finding.projectId === params.id,
  );
  const messages = clientMessages.filter(
    (message) => message.projectId === params.id,
  );
  const projectActivity = state.activities.filter(
    (event) => event.projectId === params.id,
  );

  if (!project || !client) {
    return (
      <EmptyState
        icon={<FileSignature size={18} />}
        title="Project not found"
        description="This project is not in the demo workspace, or the link is incomplete."
        action={
          <Button variant="outline" size="sm" onClick={() => router.push("/app/projects")}>
            <ArrowLeft size={12} /> Back to projects
          </Button>
        }
      />
    );
  }

  const doneCount = projectMilestones.filter((milestone) =>
    state.doneMilestones.includes(milestone.id),
  ).length;
  const progress = pct(doneCount, projectMilestones.length);
  const outstanding = sum(
    projectInvoices
      .filter((invoice) => ["sent", "overdue", "partially_paid"].includes(invoice.status))
      .map((invoice) => invoice.amount - invoice.amountPaid),
  );
  const collected = sum(
    projectInvoices
      .filter((invoice) => invoice.status === "paid")
      .map((invoice) => invoice.amountPaid),
  );
  const nextMilestone = projectMilestones
    .filter((milestone) => !state.doneMilestones.includes(milestone.id))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
  const openFindings = findings.filter((finding) => {
    const review = state.findingReviews[finding.id];
    return review === "potential" || review === "reviewing";
  }).length;

  const ask = (prompt: string) =>
    router.push(`/app/copilot?prompt=${encodeURIComponent(prompt)}`);

  const updateFinding = (finding: ScopeFinding, review: "accepted" | "dismissed") => {
    reviewFinding(finding.id, review);
    push({
      tone: review === "accepted" ? "success" : "info",
      title:
        review === "accepted"
          ? "Change accepted for drafting"
          : "Finding dismissed",
      detail:
        review === "accepted"
          ? "No invoice was created. Ask Visun to draft a change order when you are ready."
          : "It will stay in the record with your review decision.",
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-[11px] text-muted">
        <Link
          href="/app/projects"
          className="flex items-center gap-1 rounded-md px-1.5 py-1 transition hover:bg-white hover:text-ink"
        >
          <ArrowLeft size={12} /> Projects
        </Link>
        <ChevronRight size={11} />
        <span className="truncate text-ink">{project.name}</span>
      </div>

      <section className="overflow-hidden rounded-[24px] border border-[#e2ded6] bg-white shadow-neu-sm">
        <div className="flex flex-col justify-between gap-5 p-5 sm:p-6 lg:flex-row lg:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-orange">
                {project.codename}
              </span>
              <Badge
                tone={
                  project.status === "active"
                    ? "success"
                    : project.status === "review"
                      ? "warning"
                      : "neutral"
                }
                dot
                className="!py-0.5 !text-[9px]"
              >
                {project.status === "active"
                  ? "Active"
                  : project.status === "review"
                    ? "In review"
                    : "Completed"}
              </Badge>
              {project.health === "at_risk" ? (
                <Badge tone="danger" className="!py-0.5 !text-[9px]">
                  At risk
                </Badge>
              ) : null}
              {openFindings > 0 ? (
                <Badge tone="warning" className="!py-0.5 !text-[9px]">
                  {openFindings} scope finding{openFindings > 1 ? "s" : ""}
                </Badge>
              ) : null}
            </div>
            <h2 className="mt-2 text-[clamp(1.7rem,3vw,2.4rem)] font-semibold leading-tight tracking-[-0.04em]">
              {project.name}
            </h2>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-muted">
              <span className="flex items-center gap-1.5">
                <Avatar
                  name={client.name}
                  initials={client.initials}
                  hue={client.hue}
                  size="sm"
                />
                {client.name} · {client.company}
              </span>
              <span className="flex items-center gap-1.5">
                <CalendarClock size={12} /> Due {formatDate(project.dueAt, "d MMM yyyy")}
              </span>
              <span className="flex items-center gap-1.5">
                <Wallet size={12} /> {formatMoney(project.budget)} contracted
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="md"
              onClick={() =>
                router.push(`/app/reports?generate=1&project=${project.id}`)
              }
            >
              <ReceiptText size={14} /> Report
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => ask(`Give me a status update on ${project.name}.`)}
            >
              <Sparkles size={14} /> Ask about project
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px border-t border-[#ece8e0] bg-[#ece8e0] sm:grid-cols-4">
          {[
            { label: "Collected", value: formatMoney(collected), hint: "verified" },
            {
              label: "Outstanding",
              value: formatMoney(outstanding),
              hint: outstanding ? "provider checked" : "nothing open",
            },
            {
              label: "Progress",
              value: `${progress}%`,
              hint: `${doneCount}/${projectMilestones.length} milestones`,
            },
            {
              label: "Next deadline",
              value: nextMilestone ? formatDate(nextMilestone.dueAt, "d MMM") : "—",
              hint: nextMilestone?.title ?? "Handoff complete",
            },
          ].map((stat) => (
            <div key={stat.label} className="bg-white px-5 py-3.5">
              <p className="eyebrow !text-[8.5px]">{stat.label}</p>
              <p className="tabular mt-1 text-[18px] font-semibold leading-none tracking-tight">
                {stat.value}
              </p>
              <p className="mt-1 truncate text-[9.5px] text-muted">{stat.hint}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-[#ece8e0] px-5 py-3">
          <Progress value={progress} label="Delivery progress" />
        </div>
      </section>

      <div className="sticky top-[76px] z-20 -mx-1 overflow-x-auto rounded-xl bg-canvas/90 px-1 py-1 backdrop-blur">
        <div className="flex min-w-max gap-1 rounded-xl border border-[#e3dfd7] bg-white p-1 shadow-neu-sm">
          {tabs.map((item) => {
            const active = tab === item.id;
            const count =
              item.id === "milestones"
                ? projectMilestones.length
                : item.id === "messages"
                  ? messages.length
                  : item.id === "scope"
                    ? findings.length
                    : null;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11.5px] font-medium transition",
                  active
                    ? "bg-ink text-canvas"
                    : "text-muted hover:bg-[#f6f3ed] hover:text-ink",
                )}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
                {count !== null ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 font-mono text-[8.5px]",
                      active ? "bg-white/15 text-canvas" : "bg-[#f1eee7] text-muted",
                    )}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "overview" ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <div className="space-y-5 xl:col-span-8">
            <Panel className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#ece8e0] px-5 py-3.5">
                <h3 className="text-[14px] font-semibold">Milestone timeline</h3>
                <button
                  onClick={() => setTab("milestones")}
                  className="text-[10.5px] font-medium text-muted hover:text-ink"
                >
                  Manage
                </button>
              </div>
              <ol className="p-5">
                {projectMilestones.map((milestone, index) => {
                  const done = state.doneMilestones.includes(milestone.id);
                  const isNext = nextMilestone?.id === milestone.id;
                  return (
                    <li key={milestone.id} className="relative flex gap-3.5 pb-5 last:pb-0">
                      {index < projectMilestones.length - 1 ? (
                        <span
                          className={cn(
                            "absolute left-[11px] top-6 h-full w-px",
                            done ? "bg-[#bcd8c8]" : "bg-[#e4dfd6]",
                          )}
                        />
                      ) : null}
                      <span
                        className={cn(
                          "relative z-10 mt-0.5 flex h-[23px] w-[23px] shrink-0 items-center justify-center rounded-full border",
                          done
                            ? "border-success bg-success text-white"
                            : isNext
                              ? "border-orange bg-orange text-ink"
                              : "border-[#d5cfc4] bg-white text-transparent",
                        )}
                      >
                        {done ? (
                          <Check size={12} strokeWidth={3} />
                        ) : isNext ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-ink" />
                        ) : null}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p
                            className={cn(
                              "text-[12.5px] font-semibold",
                              done && "text-muted line-through decoration-[#cfc9be]",
                            )}
                          >
                            {milestone.title}
                          </p>
                          {isNext ? (
                            <Badge tone="orange" className="!py-0 !text-[8.5px]">
                              Next
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-[10.5px] text-muted">
                          {formatDate(milestone.dueAt)} · {formatMoney(milestone.value)}
                        </p>
                        <p className="mt-1 text-[10.5px] leading-relaxed text-[#8a857c]">
                          {milestone.acceptance}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Panel>

            <Panel className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[14px] font-semibold">Latest activity</h3>
                  <p className="mt-0.5 text-[10.5px] text-muted">
                    Source access and external actions are logged separately.
                  </p>
                </div>
                <Link
                  href="/app/activity"
                  className="flex items-center gap-1 text-[10.5px] font-medium text-muted hover:text-ink"
                >
                  All activity <ArrowUpRight size={11} />
                </Link>
              </div>
              {projectActivity.length ? (
                <ul className="mt-3 divide-y divide-[#f0ece5]">
                  {projectActivity.slice(0, 4).map((event) => (
                    <li key={event.id} className="flex items-start gap-3 py-2.5">
                      <span
                        className={cn(
                          "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                          event.status === "failed"
                            ? "bg-danger"
                            : event.status === "pending"
                              ? "bg-warning"
                              : event.status === "success"
                                ? "bg-success"
                                : "bg-[#b9b3a8]",
                        )}
                      />
                      <div className="min-w-0">
                        <p className="text-[11.5px] font-medium">{event.title}</p>
                        <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
                          {event.detail}
                        </p>
                      </div>
                      <span className="ml-auto shrink-0 font-mono text-[9px] text-muted">
                        {formatTime(event.at)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 rounded-xl bg-[#f8f6f1] px-3 py-4 text-[11px] text-muted">
                  No project-specific activity yet. General tool calls live in
                  Activity.
                </p>
              )}
            </Panel>
          </div>

          <div className="space-y-5 xl:col-span-4">
            <Panel className="p-5">
              <div className="flex items-center gap-3">
                <Avatar
                  name={client.name}
                  initials={client.initials}
                  hue={client.hue}
                  size="lg"
                />
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold">{client.name}</p>
                  <p className="text-[11px] text-muted">{client.company}</p>
                  <a
                    href={`mailto:${client.email}`}
                    className="mt-0.5 flex items-center gap-1 text-[10.5px] text-[#4f6f8f] hover:underline"
                  >
                    <Mail size={10} /> {client.email}
                  </a>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-[#eae5dc] bg-[#faf9f6] p-3">
                <p className="eyebrow !text-[8.5px]">Current agreement</p>
                <p className="mt-1 flex items-center gap-1.5 text-[11.5px] font-medium">
                  <FileCheck2 size={12} className="text-success" />
                  {agreement?.version ?? "—"} signed
                </p>
                <p className="mt-0.5 text-[9.5px] text-muted">
                  Effective {agreement ? formatDate(agreement.effectiveAt) : "—"} ·{" "}
                  {agreement?.file}
                </p>
                <button
                  onClick={() => setTab("agreement")}
                  className="mt-2 flex items-center gap-1 text-[10px] font-medium text-orange hover:underline"
                >
                  Read clauses <ArrowUpRight size={10} />
                </button>
              </div>
              <dl className="mt-4 space-y-2 text-[10.5px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Timezone</dt>
                  <dd className="font-mono text-[9.5px]">Asia/Kolkata</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Messages ingested</dt>
                  <dd className="font-medium">{messages.length}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Invoices</dt>
                  <dd className="font-medium">{projectInvoices.length}</dd>
                </div>
              </dl>
            </Panel>

            <Panel className="border-[#e7d9ab] bg-[#fffaf0] p-5">
              <div className="flex items-start gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow text-ink">
                  <ShieldAlert size={15} />
                </span>
                <div>
                  <p className="text-[12px] font-semibold">Scope watch</p>
                  <p className="mt-1 text-[10.5px] leading-relaxed text-[#7a6b3e]">
                    {openFindings
                      ? `${openFindings} client request${openFindings > 1 ? "s" : ""} may sit outside the signed agreement. Review the evidence before promising anything.`
                      : "No open scope findings. Earlier decisions are kept in the audit trail."}
                  </p>
                  <button
                    onClick={() => setTab("scope")}
                    className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-[#7d5d00] hover:underline"
                  >
                    Review evidence <ArrowUpRight size={10} />
                  </button>
                </div>
              </div>
            </Panel>

            <Panel className="p-5">
              <p className="eyebrow !text-[8.5px]">Quick actions</p>
              <div className="mt-2.5 grid gap-1.5">
                {[
                  {
                    label: "Draft a scope change order",
                    icon: ShieldCheck,
                    prompt: `Draft a change order for the open scope finding on ${project.name}.`,
                  },
                  {
                    label: "Ask for unpaid balance",
                    icon: CircleDollarSign,
                    prompt: `How much is still unpaid on ${project.name}?`,
                  },
                  {
                    label: "Summarize client messages",
                    icon: MessageSquare,
                    prompt: `Summarize the client messages on ${project.name}.`,
                  },
                ].map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      onClick={() => ask(action.prompt)}
                      className="flex items-center gap-2 rounded-lg border border-[#e9e4db] bg-[#fbfaf7] px-2.5 py-2 text-left text-[10.5px] font-medium text-[#56524b] transition hover:border-[#d5cdc0] hover:bg-white hover:text-ink"
                    >
                      <Icon size={12} className="text-orange" />
                      {action.label}
                      <ArrowUpRight size={10} className="ml-auto text-muted" />
                    </button>
                  );
                })}
              </div>
            </Panel>
          </div>
        </div>
      ) : null}

      {tab === "agreement" ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Panel className="p-5 lg:col-span-1">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#cfe5d8] bg-[#eef7f1] text-success">
                <FileCheck2 size={20} />
              </span>
              <div>
                <p className="text-[13px] font-semibold">Signed agreement</p>
                <p className="text-[10.5px] text-muted">
                  Version {agreement?.version} · {agreement?.file}
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2.5 text-[11px]">
              <div className="flex justify-between gap-3">
                <span className="text-muted">Effective</span>
                <span className="font-medium">
                  {agreement ? formatDate(agreement.effectiveAt) : "—"}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted">Clauses</span>
                <span className="font-medium">{agreement?.clauses.length ?? 0}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted">Versioned</span>
                <span className="font-medium">Yes · immutable</span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 w-full"
              onClick={() => ask(`What does the ${project.name} agreement include and exclude?`)}
            >
              <Sparkles size={12} /> Ask about this agreement
            </Button>
            <p className="mt-3 rounded-lg bg-[#f8f6f1] p-2.5 text-[9.5px] leading-relaxed text-muted">
              The agent compares client messages against this exact version. It
              never edits the agreement on its own.
            </p>
          </Panel>

          <div className="space-y-2.5 lg:col-span-2">
            {agreement?.clauses.map((clause) => (
              <div
                key={clause.id}
                className={cn(
                  "rounded-2xl border bg-white p-4",
                  clause.kind === "excluded"
                    ? "border-[#ecd5d0]"
                    : "border-[#e3dfd7]",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-[10px]",
                        clause.kind === "excluded"
                          ? "bg-[#fbe9e7] text-[#8f2f28]"
                          : "bg-[#eaf5ee] text-success",
                      )}
                    >
                      {clause.kind === "excluded" ? "✕" : "✓"}
                    </span>
                    <p className="text-[11.5px] font-semibold">{clause.label}</p>
                  </div>
                  <span className="font-mono text-[9px] text-muted">{clause.id}</span>
                </div>
                <p className="mt-2 pl-8 text-[11.5px] leading-relaxed text-[#5f5b54]">
                  {clause.text}
                </p>
                <div className="mt-2 flex items-center gap-1.5 pl-8">
                  <Badge
                    tone={clause.kind === "excluded" ? "danger" : "success"}
                    className="!py-0.5 !text-[8.5px]"
                  >
                    {clause.kind === "excluded" ? "Explicitly excluded" : "Included"}
                  </Badge>
                </div>
              </div>
            ))}
            {!agreement ? (
              <EmptyState
                icon={<FileSignature size={18} />}
                title="No agreement stored"
                description="Add a signed scope to enable grounded scope detection."
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "milestones" ? (
        <Panel className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ece8e0] px-5 py-4">
            <div>
              <h3 className="text-[14px] font-semibold">Milestones & acceptance</h3>
              <p className="mt-0.5 text-[10.5px] text-muted">
                Toggling completion is local to this demo workspace.
              </p>
            </div>
            <Badge tone="neutral">
              {doneCount} of {projectMilestones.length} done
            </Badge>
          </div>
          <ul className="divide-y divide-[#f0ece5]">
            {projectMilestones.map((milestone) => {
              const done = state.doneMilestones.includes(milestone.id);
              return (
                <li
                  key={milestone.id}
                  className={cn(
                    "flex items-start gap-3.5 px-5 py-4 transition",
                    done ? "bg-[#fbfdfb]" : "hover:bg-[#fbfaf7]",
                  )}
                >
                  <button
                    onClick={() => {
                      toggleMilestone(milestone.id);
                      push({
                        tone: done ? "info" : "success",
                        title: done ? "Milestone reopened" : "Milestone completed",
                        detail: milestone.title,
                      });
                    }}
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition",
                      done
                        ? "border-success bg-success text-white"
                        : "border-[#cfc9be] bg-white text-transparent hover:border-orange hover:text-orange",
                    )}
                    aria-label={done ? `Reopen ${milestone.title}` : `Complete ${milestone.title}`}
                    aria-pressed={done}
                  >
                    <Check size={11} strokeWidth={3} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={cn(
                          "text-[12.5px] font-semibold",
                          done && "text-muted line-through",
                        )}
                      >
                        {milestone.title}
                      </p>
                      <Badge
                        tone={done ? "success" : "neutral"}
                        className="!py-0.5 !text-[8.5px]"
                      >
                        {done ? "Done" : `Due ${formatDate(milestone.dueAt, "d MMM")}`}
                      </Badge>
                    </div>
                    <p className="mt-1 max-w-2xl text-[10.5px] leading-relaxed text-muted">
                      {milestone.acceptance}
                    </p>
                  </div>
                  <p className="tabular shrink-0 text-[12px] font-semibold">
                    {formatMoney(milestone.value)}
                  </p>
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}

      {tab === "messages" ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Panel className="overflow-hidden lg:col-span-2">
            <div className="flex items-center justify-between border-b border-[#ece8e0] px-5 py-3.5">
              <div>
                <h3 className="text-[14px] font-semibold">Authorized client messages</h3>
                <p className="mt-0.5 text-[10px] text-muted">
                  Only opted-in project chats. Other conversations are never read.
                </p>
              </div>
              <Badge tone="info" dot className="!py-0.5 !text-[9px]">
                {messages.length} stored
              </Badge>
            </div>
            <div className="space-y-4 p-5">
              {messages.map((message) => {
                const finding = findings.find((item) => item.messageId === message.id);
                const mine = message.senderRole === "freelancer";
                return (
                  <div
                    key={message.id}
                    className={cn("flex gap-3", mine && "flex-row-reverse")}
                  >
                    <Avatar
                      name={message.sender}
                      initials={message.sender
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)}
                      hue={mine ? "ink" : client.hue}
                      size="sm"
                    />
                    <div className={cn("max-w-[80%]", mine && "text-right")}>
                      <div
                        className={cn(
                          "mb-1 flex flex-wrap items-center gap-1.5 text-[9.5px] text-muted",
                          mine && "justify-end",
                        )}
                      >
                        <span className="font-medium text-ink">{message.sender}</span>
                        <span>·</span>
                        <span>{formatTime(message.sentAt)}</span>
                        <Badge tone="neutral" className="!py-0 !text-[8px]">
                          {message.platform}
                        </Badge>
                      </div>
                      <div
                        className={cn(
                          "rounded-2xl border px-3.5 py-2.5 text-[11.5px] leading-relaxed",
                          mine
                            ? "rounded-tr-md border-[#ded9cf] bg-stone text-ink"
                            : "rounded-tl-md border-[#e5e0d7] bg-white text-[#4c4943]",
                        )}
                      >
                        {message.text}
                      </div>
                      <p className="mt-1 text-[8.5px] text-[#a19b91]">
                        {message.consent}
                      </p>
                      {finding ? (
                        <button
                          onClick={() => setTab("scope")}
                          className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-[#fff3cf] px-2 py-1 text-[9px] font-semibold text-[#775000] hover:bg-yellow"
                        >
                          <ShieldAlert size={9} />
                          {reviewLabel[state.findingReviews[finding.id]]} ·{" "}
                          {Math.round(finding.confidence * 100)}% confidence
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {messages.length === 0 ? (
                <EmptyState
                  icon={<MessageSquare size={18} />}
                  title="No messages stored"
                  description="Connect an authorized Telegram project group or upload a consented transcript."
                />
              ) : null}
            </div>
          </Panel>
          <div className="space-y-4">
            <Panel className="p-5">
              <p className="eyebrow !text-[8.5px]">Ingestion provenance</p>
              <ul className="mt-2.5 space-y-2 text-[10.5px] leading-relaxed text-muted">
                <li className="flex gap-2">
                  <CheckCircle2 size={11} className="mt-0.5 shrink-0 text-success" />
                  Bot is opt-in for this project group only.
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 size={11} className="mt-0.5 shrink-0 text-success" />
                  Messages are deduplicated by platform ID.
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 size={11} className="mt-0.5 shrink-0 text-success" />
                  Client text is treated as evidence, never instructions.
                </li>
              </ul>
            </Panel>
            <Panel className="border-[#e7d9ab] bg-[#fffaf0] p-5">
              <p className="text-[11.5px] font-semibold text-[#6f5300]">
                One message needs a decision
              </p>
              <p className="mt-1 text-[10.5px] leading-relaxed text-[#7a6b3e]">
                {openFindings
                  ? "Rahul's authentication and payment request is not covered by the agreement."
                  : "All findings have been reviewed."}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => setTab("scope")}
              >
                Review scope <ArrowUpRight size={11} />
              </Button>
            </Panel>
          </div>
        </div>
      ) : null}

      {tab === "scope" ? (
        <div className="space-y-4">
          {findings.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck size={18} />}
              title="No scope findings for this project"
              description="When an opted-in client message arrives, Visun compares it to the current agreement and asks you before treating it as billable."
            />
          ) : (
            findings.map((finding) => {
              const clause = agreement?.clauses.find(
                (item) => item.id === finding.clauseId,
              );
              const review = state.findingReviews[finding.id];
              return (
                <Panel key={finding.id} className="overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ece8e0] px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Badge
                        tone={
                          finding.classification === "potential_change"
                            ? "warning"
                            : finding.classification === "within_scope"
                              ? "success"
                              : "neutral"
                        }
                        className="!py-0.5 !text-[9px]"
                      >
                        {finding.classification === "potential_change"
                          ? "Potential change"
                          : finding.classification === "within_scope"
                            ? "Within scope"
                            : "Needs context"}
                      </Badge>
                      <span className="text-[9.5px] text-muted">
                        {finding.platform} · {formatDate(finding.receivedAt, "d MMM, h:mm a")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] text-muted">
                        {Math.round(finding.confidence * 100)}% confidence
                      </span>
                      <Badge
                        tone={
                          review === "accepted"
                            ? "success"
                            : review === "dismissed"
                              ? "neutral"
                              : "warning"
                        }
                        className="!py-0.5 !text-[9px]"
                      >
                        {reviewLabel[review]}
                      </Badge>
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="text-[15px] font-semibold tracking-tight">
                      {finding.title}
                    </h3>
                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      <div className="rounded-xl border border-[#e7e2d9] bg-[#fbfaf7] p-3.5">
                        <p className="eyebrow !text-[8.5px]">Agreed scope</p>
                        <p className="mt-1.5 text-[10.5px] font-semibold text-[#6b4a00]">
                          {clause?.label ?? "Clause"} · {finding.clauseId}
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-[#5f5b54]">
                          {clause?.text ?? "No matching clause found."}
                        </p>
                      </div>
                      <div className="rounded-xl border border-[#ecd9a3] bg-[#fff9e8] p-3.5">
                        <p className="eyebrow !text-[8.5px]">New client request</p>
                        <p className="mt-1.5 text-[10.5px] font-semibold">
                          {finding.sender} · {finding.platform}
                        </p>
                        <p className="mt-1 text-[11px] italic leading-relaxed text-[#6f6035]">
                          “{finding.message}”
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 rounded-xl border border-[#eae5dc] bg-white p-3.5">
                      <p className="eyebrow !text-[8.5px]">Why this was flagged</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-[#5f5b54]">
                        {finding.rationale}
                      </p>
                      {finding.estimate > 0 ? (
                        <p className="mt-2 text-[10.5px] font-medium text-[#7d5d00]">
                          Working estimate: {formatMoney(finding.estimate)} — a
                          proposal, not a quote.
                        </p>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => updateFinding(finding, "accepted")}
                        disabled={review === "accepted"}
                      >
                        <Check size={12} /> Accept for drafting
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateFinding(finding, "dismissed")}
                        disabled={review === "dismissed"}
                      >
                        Dismiss
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          ask(
                            `Draft a change order for the ${finding.title} finding on ${project.name}.`,
                          )
                        }
                      >
                        <Sparkles size={12} /> Ask Visun to draft
                      </Button>
                      <p className="ml-auto text-[9px] text-muted">
                        No charge is created automatically.
                      </p>
                    </div>
                  </div>
                </Panel>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
