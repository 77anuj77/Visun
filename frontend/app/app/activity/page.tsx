"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CircleDollarSign,
  Copy,
  Cpu,
  FileText,
  Mail,
  Plug,
  Radio,
  ScanSearch,
  ShieldCheck,
  SlidersHorizontal,
  Terminal,
  TriangleAlert,
} from "lucide-react";
import {
  Badge,
  Button,
  Drawer,
  EmptyState,
  Panel,
  useToast,
} from "@/components/ui";
import { DEMO_DATE, DEMO_NOW, projects } from "@/lib/demo-data";
import { useAppStore } from "@/lib/store";
import type { ActivityEvent } from "@/lib/types";
import { cn, formatDate, formatTime, relativeTime } from "@/lib/utils";

const typeMeta: Record<
  ActivityEvent["type"],
  { label: string; icon: typeof Mail }
> = {
  scope: { label: "Scope", icon: ScanSearch },
  payment: { label: "Payment", icon: CircleDollarSign },
  email: { label: "Email", icon: Mail },
  report: { label: "Report", icon: FileText },
  tool: { label: "Tool call", icon: Terminal },
  approval: { label: "Approval", icon: ShieldCheck },
  integration: { label: "Integration", icon: Plug },
  ingest: { label: "Ingest", icon: Radio },
  system: { label: "System", icon: Cpu },
};

const statusMeta: Record<
  ActivityEvent["status"],
  { label: string; tone: "success" | "warning" | "danger" | "neutral" }
> = {
  success: { label: "Succeeded", tone: "success" },
  pending: { label: "Awaiting", tone: "warning" },
  failed: { label: "Failed", tone: "danger" },
  info: { label: "Recorded", tone: "neutral" },
};

const ranges = [
  { id: "today", label: "Today", cutoff: DEMO_DATE },
  { id: "7d", label: "7 days", cutoff: "2026-10-28" },
  { id: "30d", label: "30 days", cutoff: "2026-10-05" },
  { id: "all", label: "All", cutoff: "" },
] as const;

type RangeId = (typeof ranges)[number]["id"];

const selectClass =
  "h-9 rounded-lg border border-[#e2ded6] bg-[#f8f6f1] px-2 text-[11.5px] text-ink outline-none transition focus:border-[#c8c1b4] focus:bg-white";

function parametersFor(event: ActivityEvent) {
  const project = projects.find((item) => item.id === event.projectId);
  switch (event.type) {
    case "scope":
      return {
        finding_id: event.reference ?? "—",
        project: project?.codename ?? "—",
        clause: event.reference === "sf-1" ? "nw-c4, nw-c5" : "nw-c2",
        classification: "potential_change",
        model: "scope-matcher · demo",
      };
    case "payment":
      return {
        invoice: event.reference ?? "—",
        provider: "PayPal Sandbox",
        mode: "read_only",
        currency: "USD",
        webhook_verified: true,
      };
    case "email":
      return {
        provider: "Gmail",
        provider_message_id: event.reference ?? "—",
        recipient: "redacted in list view",
        api_key: "••••••••••••",
        oauth_token: "••••••••••••",
      };
    case "report":
      return {
        report_id: event.reference ?? "—",
        pages: 2,
        format: "pdf",
        delivery: "not sent",
      };
    case "tool":
      return {
        tool: "get_pending_payments",
        access: "read_only",
        duration_ms: 310,
        rows_read: 6,
        idempotency_key: "none (read)",
      };
    case "approval":
      return {
        action: event.reference ?? "—",
        approved_by: "Ayush Paroha",
        idempotency_key: "idem_7f2c…9a1",
        execution: event.status === "pending" ? "queued" : "completed",
      };
    case "integration":
      return {
        provider: "PayPal Sandbox",
        environment: "sandbox",
        scopes: ["invoices.read", "orders.read"],
        credential: "••••••••",
      };
    case "ingest":
      return {
        source: "Telegram Bot API",
        chat: "Northwind project group",
        consent_scope: "opted-in group only",
        stored_messages: 1,
      };
    default:
      return {
        workspace: "Paroha Studio",
        mode: "demo",
        seed: "2026-11-03",
      };
  }
}

export default function ActivityPage() {
  const { state } = useAppStore();
  const { push } = useToast();
  const [type, setType] = useState<"all" | ActivityEvent["type"]>("all");
  const [projectId, setProjectId] = useState("all");
  const [actor, setActor] = useState("all");
  const [status, setStatus] = useState<"all" | ActivityEvent["status"]>("all");
  const [range, setRange] = useState<RangeId>("30d");
  const [query, setQuery] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);

  const actors = useMemo(
    () => Array.from(new Set(state.activities.map((event) => event.actor))),
    [state.activities],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const cutoff = ranges.find((item) => item.id === range)?.cutoff ?? "";
    return state.activities
      .filter((event) => (type === "all" ? true : event.type === type))
      .filter((event) =>
        projectId === "all" ? true : event.projectId === projectId,
      )
      .filter((event) => (actor === "all" ? true : event.actor === actor))
      .filter((event) => (status === "all" ? true : event.status === status))
      .filter((event) => (cutoff ? event.at.slice(0, 10) >= cutoff : true))
      .filter((event) =>
        term
          ? `${event.title} ${event.detail} ${event.actor} ${event.reference ?? ""} ${event.type}`
              .toLowerCase()
              .includes(term)
          : true,
      )
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [actor, projectId, query, range, state.activities, status, type]);

  const grouped = useMemo(() => {
    const map = new Map<string, ActivityEvent[]>();
    filtered.forEach((event) => {
      const day = formatDate(event.at, "EEEE d MMMM");
      map.set(day, [...(map.get(day) ?? []), event]);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const detail = detailId
    ? state.activities.find((event) => event.id === detailId)
    : null;
  const detailProject = detail?.projectId
    ? projects.find((project) => project.id === detail.projectId)
    : undefined;

  const counts = {
    total: state.activities.length,
    pending: state.activities.filter((event) => event.status === "pending").length,
    external: state.activities.filter((event) =>
      ["email", "payment", "integration"].includes(event.type),
    ).length,
    failed: state.activities.filter((event) => event.status === "failed").length,
  };

  const activeFilters =
    (type !== "all" ? 1 : 0) +
    (projectId !== "all" ? 1 : 0) +
    (actor !== "all" ? 1 : 0) +
    (status !== "all" ? 1 : 0) +
    (query.trim() ? 1 : 0);

  const resetFilters = () => {
    setType("all");
    setProjectId("all");
    setActor("all");
    setStatus("all");
    setRange("30d");
    setQuery("");
  };

  const copyRecord = async () => {
    if (!detail) return;
    const record = {
      id: detail.id,
      type: detail.type,
      actor: detail.actor,
      title: detail.title,
      detail: detail.detail,
      at: detail.at,
      status: detail.status,
      reference: detail.reference ?? null,
      project: detailProject?.codename ?? null,
      parameters: parametersFor(detail),
      redaction: "Secrets are redacted before storage.",
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(record, null, 2));
      push({
        tone: "success",
        title: "Audit record copied",
        detail: `${detail.id} · secrets redacted`,
      });
    } catch {
      push({
        tone: "error",
        title: "Clipboard blocked",
        detail: "Your browser refused clipboard access. Select the record manually.",
      });
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="eyebrow">Audit</p>
            <Badge tone="yellow" className="!py-0.5 !text-[9.5px]">
              Demo data · Local
            </Badge>
          </div>
          <h2 className="mt-1.5 text-[clamp(1.8rem,2.8vw,2.3rem)] font-semibold leading-tight tracking-[-0.035em]">
            Activity
          </h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">
            Every read, draft, approval, and provider call in one record. Failed
            actions stay here with their reason — nothing disappears silently.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="md" onClick={resetFilters}>
            <SlidersHorizontal size={14} /> Clear filters
            {activeFilters > 0 ? (
              <span className="ml-0.5 rounded-full bg-ink px-1.5 py-0.5 font-mono text-[9px] text-canvas">
                {activeFilters}
              </span>
            ) : null}
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: "Records", value: counts.total, hint: "This demo workspace", accent: false },
          { label: "Awaiting", value: counts.pending, hint: "Needs your decision", accent: true },
          { label: "External calls", value: counts.external, hint: "Email · PayPal · sync", accent: false },
          { label: "Failed", value: counts.failed, hint: counts.failed ? "Reason recorded" : "Nothing failed", accent: false },
        ].map((stat) => (
          <Panel
            key={stat.label}
            className={cn(
              "flex flex-col justify-between p-4",
              stat.accent && "border-[#e7cf6f] bg-yellow",
            )}
          >
            <p className="eyebrow !text-[9.5px]">{stat.label}</p>
            <div className="mt-3">
              <p className="tabular text-[23px] font-semibold leading-none tracking-tight">
                {stat.value}
              </p>
              <p className="mt-1 text-[10.5px] text-[#6a665f]">{stat.hint}</p>
            </div>
          </Panel>
        ))}
      </section>

      <Panel className="space-y-3 p-3.5">
        <div className="flex flex-wrap items-center gap-1">
          {ranges.map((item) => (
            <button
              key={item.id}
              onClick={() => setRange(item.id)}
              aria-pressed={range === item.id}
              className={cn(
                "rounded-lg px-3 py-2 text-[12px] font-medium transition",
                range === item.id
                  ? "bg-ink text-canvas shadow-sm"
                  : "text-muted hover:bg-[#f6f3ed] hover:text-ink",
              )}
            >
              {item.label}
            </button>
          ))}
          <span className="mx-1 hidden h-5 w-px bg-[#e5e0d8] sm:block" />
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              value={type}
              onChange={(event) =>
                setType(event.target.value as "all" | ActivityEvent["type"])
              }
              className={selectClass}
              aria-label="Filter by action type"
            >
              <option value="all">All types</option>
              {Object.entries(typeMeta).map(([id, meta]) => (
                <option key={id} value={id}>
                  {meta.label}
                </option>
              ))}
            </select>
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className={selectClass}
              aria-label="Filter by project"
            >
              <option value="all">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.codename}
                </option>
              ))}
            </select>
            <select
              value={actor}
              onChange={(event) => setActor(event.target.value)}
              className={selectClass}
              aria-label="Filter by provider or actor"
            >
              <option value="all">All actors</option>
              {actors.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as "all" | ActivityEvent["status"])
              }
              className={selectClass}
              aria-label="Filter by result"
            >
              <option value="all">All results</option>
              {Object.entries(statusMeta).map(([id, meta]) => (
                <option key={id} value={id}>
                  {meta.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, detail, reference, or actor"
            className="h-9 min-w-0 flex-1 rounded-lg border border-[#e2ded6] bg-[#f8f6f1] px-3 text-[12px] outline-none transition focus:border-[#c8c1b4] focus:bg-white"
            aria-label="Search activity"
          />
          <span className="font-mono text-[10px] text-muted">
            {filtered.length} of {state.activities.length} records
          </span>
        </div>
      </Panel>

      {filtered.length === 0 ? (
        <Panel className="p-6">
          <EmptyState
            icon={<Terminal size={18} />}
            title="No activity matches these filters"
            description="Widen the date range or clear a filter. Demo records only cover the seeded sample workspace."
            action={
              <Button size="sm" variant="outline" onClick={resetFilters}>
                Reset filters
              </Button>
            }
          />
        </Panel>
      ) : (
        <div className="space-y-5">
          {grouped.map(([day, events]) => (
            <section key={day}>
              <div className="mb-2 flex items-center gap-3 px-1">
                <h3 className="eyebrow !text-[10px] !text-[#4f4b45]">{day}</h3>
                <span className="h-px flex-1 bg-[#e5e0d8]" />
                <span className="font-mono text-[9.5px] text-muted">
                  {events.length} {events.length === 1 ? "record" : "records"}
                </span>
              </div>
              <Panel className="overflow-hidden">
                <ol className="divide-y divide-[#f0ece5]">
                  {events.map((event) => {
                    const meta = typeMeta[event.type];
                    const Icon = meta.icon;
                    const tone = statusMeta[event.status];
                    const project = event.projectId
                      ? projects.find((item) => item.id === event.projectId)
                      : undefined;
                    return (
                      <li key={event.id}>
                        <button
                          onClick={() => setDetailId(event.id)}
                          className="group flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-[#fbfaf7] sm:px-5"
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border",
                              event.status === "failed"
                                ? "border-[#ecc9c4] bg-[#fbe9e7] text-danger"
                                : event.status === "pending"
                                  ? "border-[#ecdba4] bg-[#fff8e2] text-warning"
                                  : "border-[#e6e1d8] bg-[#f8f7f3] text-[#6f6a62]",
                            )}
                            aria-hidden="true"
                          >
                            <Icon size={14} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <p className="text-[12.5px] font-semibold leading-snug">
                                {event.title}
                              </p>
                              <Badge
                                tone={tone.tone}
                                className="!py-0 !text-[8.5px]"
                                dot={event.status === "pending" || event.status === "failed"}
                              >
                                {tone.label}
                              </Badge>
                              {project ? (
                                <span className="font-mono text-[8.5px] text-[#a19b91]">
                                  {project.codename}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-0.5 line-clamp-2 max-w-3xl text-[11px] leading-relaxed text-muted">
                              {event.detail}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[8.5px] text-[#a19b91]">
                              <span>{event.actor}</span>
                              <span aria-hidden="true">·</span>
                              <span>{meta.label}</span>
                              {event.reference ? (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>{event.reference}</span>
                                </>
                              ) : null}
                              <span aria-hidden="true">·</span>
                              <span>{formatTime(event.at)}</span>
                            </div>
                          </div>
                          <span className="mt-1 hidden shrink-0 items-center gap-1 text-[10px] text-muted transition group-hover:text-ink sm:flex">
                            Inspect <ArrowUpRight size={10} />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </Panel>
            </section>
          ))}
        </div>
      )}

      <Panel className="flex flex-wrap items-start gap-3 border-dashed p-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#f8f6f1] text-muted">
          <ShieldCheck size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-semibold">
            What this record does and doesn&apos;t prove
          </p>
          <p className="mt-0.5 max-w-3xl text-[10.5px] leading-relaxed text-muted">
            This timeline is stored in your browser for the demo. In production it
            would be append-only on the backend, with secrets redacted before
            storage. A green record means a provider response was verified — not
            that a payment cleared or an email was opened.
          </p>
        </div>
      </Panel>

      <Drawer
        open={Boolean(detail)}
        onClose={() => setDetailId(null)}
        title={detail?.title ?? "Activity record"}
        subtitle={
          detail
            ? `${formatDate(detail.at, "d MMM yyyy")} · ${formatTime(detail.at)} · ${relativeTime(detail.at)}`
            : undefined
        }
        footer={
          detail ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="primary" onClick={copyRecord}>
                <Copy size={12} /> Copy audit record
              </Button>
              {detailProject ? (
                <Link href={`/app/projects/${detailProject.id}`}>
                  <Button size="sm" variant="outline">
                    Open project <ArrowUpRight size={12} />
                  </Button>
                </Link>
              ) : null}
            </div>
          ) : null
        }
      >
        {detail ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 rounded-2xl border border-[#eae5dc] bg-white p-4">
              <div className="min-w-0">
                <p className="eyebrow !text-[8.5px]">Outcome</p>
                <p className="mt-1 text-[12px] leading-relaxed">{detail.detail}</p>
                {(detailProject || detail.reference) && (
                  <p className="mt-2 font-mono text-[9px] text-muted">
                    {detailProject ? `${detailProject.codename} · ` : ""}
                    {detail.reference ?? "no provider reference"}
                  </p>
                )}
              </div>
              <Badge
                tone={statusMeta[detail.status].tone}
                className="!py-0.5 !text-[9px]"
                dot
              >
                {statusMeta[detail.status].label}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Actor", value: detail.actor },
                { label: "Action type", value: typeMeta[detail.type].label },
                { label: "Recorded", value: formatDate(detail.at, "d MMM, h:mm a") },
                { label: "Event ID", value: detail.id },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-[#eae5dc] bg-white p-3"
                >
                  <p className="eyebrow !text-[8px]">{item.label}</p>
                  <p className="mt-1 truncate font-mono text-[10px]">{item.value}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="eyebrow !text-[8.5px]">Tool parameters · secrets redacted</p>
              <pre className="mt-2 overflow-x-auto rounded-xl border border-[#e6e1d8] bg-[#1d1d1d] p-3.5 font-mono text-[10px] leading-relaxed text-[#e9e6df]">
                {JSON.stringify(parametersFor(detail), null, 2)}
              </pre>
              <p className="mt-1.5 text-[9.5px] leading-relaxed text-muted">
                API keys, OAuth tokens, and message bodies are masked. This demo
                redacts client-side for illustration only.
              </p>
            </div>

            <div>
              <p className="eyebrow !text-[8.5px]">Approval record</p>
              <ol className="mt-2.5">
                {[
                  {
                    label: "Action proposed",
                    detail: "Visun prepared an editable payload. Nothing executed.",
                    tone: "info",
                  },
                  {
                    label:
                      detail.type === "approval" || detail.type === "email"
                        ? "Approved by Ayush Paroha"
                        : "Approval not required",
                    detail:
                      detail.type === "approval" || detail.type === "email"
                        ? "Explicit approval recorded before the provider call."
                        : "This was a read-only or system event.",
                    tone: "success",
                  },
                  {
                    label:
                      detail.status === "failed"
                        ? "Execution failed"
                        : detail.status === "pending"
                          ? "Waiting for the provider"
                          : "Provider result verified",
                    detail:
                      detail.status === "failed"
                        ? "No retry was attempted automatically. Review the reason before retrying."
                        : detail.status === "pending"
                          ? "The action stays queued until a provider reference is returned."
                          : `${detail.reference ?? "No reference"} returned by ${detail.actor}.`,
                    tone:
                      detail.status === "failed"
                        ? "danger"
                        : detail.status === "pending"
                          ? "warning"
                          : "success",
                  },
                ].map((step, index, list) => (
                  <li key={step.label} className="relative flex gap-3 pb-4 last:pb-0">
                    {index < list.length - 1 ? (
                      <span className="absolute left-[5px] top-3 h-full w-px bg-[#e8e4dc]" />
                    ) : null}
                    <span
                      className={cn(
                        "relative z-10 mt-1 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-canvas",
                        step.tone === "success"
                          ? "bg-success"
                          : step.tone === "danger"
                            ? "bg-danger"
                            : step.tone === "warning"
                              ? "bg-warning"
                              : "bg-orange",
                      )}
                    />
                    <div>
                      <p className="text-[11px] font-medium">{step.label}</p>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
                        {step.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {detail.status === "failed" ? (
              <div className="flex items-start gap-2 rounded-xl border border-[#ecc9c4] bg-[#fbe9e7] p-3">
                <TriangleAlert size={14} className="mt-0.5 shrink-0 text-danger" />
                <p className="text-[10.5px] leading-relaxed text-[#7d2a24]">
                  Failed actions keep their provider error. Nothing retries in the
                  background — check the source of truth before trying again.
                </p>
              </div>
            ) : null}

            <p className="rounded-xl bg-[#f8f6f1] px-3 py-2.5 text-[10px] leading-relaxed text-muted">
              Sandbox demo. No funds moved, no email left this browser, and no
              production credential was used. Timestamps are shown in Asia/Kolkata
              (IST). Demo clock: {formatDate(DEMO_NOW, "d MMM yyyy, h:mm a")}.
            </p>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
