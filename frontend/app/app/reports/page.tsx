"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronUp,
  Download,
  Eye,
  FileText,
  Mail,
  Plus,
  ReceiptText,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  Badge,
  Button,
  Drawer,
  EmptyState,
  Modal,
  Panel,
  Switch,
  useToast,
} from "@/components/ui";
import {
  clients,
  invoices,
  milestones,
  projects,
  scopeFindings,
} from "@/lib/demo-data";
import { useAppStore } from "@/lib/store";
import type { Report } from "@/lib/types";
import {
  cn,
  formatDate,
  formatMoney,
  sum,
  uid,
} from "@/lib/utils";

type SectionId = "completed" | "blockers" | "upcoming" | "scope" | "invoices";

const sectionDefs: { id: SectionId; label: string; description: string }[] = [
  {
    id: "completed",
    label: "Completed work",
    description: "Milestones marked done in the selected window.",
  },
  {
    id: "blockers",
    label: "Blockers",
    description: "Open scope findings and overdue invoices.",
  },
  {
    id: "upcoming",
    label: "Upcoming work",
    description: "Next milestones with acceptance criteria.",
  },
  {
    id: "scope",
    label: "Scope changes",
    description: "Finding status and your review decisions.",
  },
  {
    id: "invoices",
    label: "Invoice status",
    description: "Verified payments and outstanding balances.",
  },
];

const statusTone = {
  draft: "warning",
  sent: "success",
  failed: "danger",
} as const;

function ReportWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { push } = useToast();
  const { state, addReport, sendReport, addActivity } = useAppStore();
  const [builderOpen, setBuilderOpen] = useState(
    searchParams.get("generate") === "1",
  );
  const [projectId, setProjectId] = useState(
    searchParams.get("project") ?? "p-northwind",
  );
  const [rangeStart, setRangeStart] = useState("2026-10-27");
  const [rangeEnd, setRangeEnd] = useState("2026-11-02");
  const [sections, setSections] = useState<Record<SectionId, boolean>>({
    completed: true,
    blockers: true,
    upcoming: true,
    scope: true,
    invoices: true,
  });
  const [includeNarrative, setIncludeNarrative] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "sent">("all");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [sendId, setSendId] = useState<string | null>(null);
  const [approval, setApproval] = useState(false);
  const [sending, setSending] = useState(false);
  const [generatedMeta, setGeneratedMeta] = useState<
    Record<string, { facts: string[]; narrative: string }>
  >({});

  const project = projects.find((item) => item.id === projectId)!;
  const client = clients.find((item) => item.id === project.clientId)!;

  const facts = useMemo(() => {
    const projectMilestones = milestones.filter(
      (milestone) => milestone.projectId === projectId,
    );
    const done = projectMilestones.filter(
      (milestone) =>
        state.doneMilestones.includes(milestone.id) &&
        milestone.dueAt.slice(0, 10) >= rangeStart &&
        milestone.dueAt.slice(0, 10) <= rangeEnd,
    );
    const upcoming = projectMilestones
      .filter(
        (milestone) =>
          !state.doneMilestones.includes(milestone.id) &&
          milestone.dueAt.slice(0, 10) >= rangeStart,
      )
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    const projectInvoices = invoices.filter(
      (invoice) => invoice.projectId === projectId,
    );
    const overdueInvoices = projectInvoices.filter(
      (invoice) => invoice.status === "overdue",
    );
    const openInvoices = projectInvoices.filter((invoice) =>
      ["sent", "overdue", "partially_paid"].includes(invoice.status),
    );
    const findings = scopeFindings.filter(
      (finding) => finding.projectId === projectId,
    );
    const openFindings = findings.filter((finding) => {
      const review = state.findingReviews[finding.id];
      return review === "potential" || review === "reviewing";
    });
    return {
      done,
      upcoming,
      projectInvoices,
      overdueInvoices,
      openInvoices,
      findings,
      openFindings,
      outstanding: sum(
        openInvoices.map((invoice) => invoice.amount - invoice.amountPaid),
      ),
    };
  }, [projectId, rangeEnd, rangeStart, state.doneMilestones, state.findingReviews]);

  const previewLines = useMemo(() => {
    const lines: string[] = [];
    if (sections.completed) {
      lines.push(
        facts.done.length
          ? `Completed: ${facts.done.map((milestone) => milestone.title).join(", ")}.`
          : "No milestone was marked done in this window.",
      );
    }
    if (sections.blockers) {
      if (facts.overdueInvoices.length) {
        lines.push(
          `Blocked on payment: ${facts.overdueInvoices
            .map((invoice) => `${invoice.number} (${formatMoney(invoice.amount - invoice.amountPaid)})`)
            .join(", ")}.`,
        );
      }
      if (facts.openFindings.length) {
        lines.push(
          `${facts.openFindings.length} scope question${
            facts.openFindings.length === 1 ? "" : "s"
          } still needs your review.`,
        );
      }
      if (!facts.overdueInvoices.length && !facts.openFindings.length) {
        lines.push("No blockers recorded for this project.");
      }
    }
    if (sections.upcoming && facts.upcoming.length) {
      const next = facts.upcoming[0];
      lines.push(
        `Next: ${next.title} due ${formatDate(next.dueAt)}. Acceptance: ${next.acceptance}`,
      );
    }
    if (sections.scope && facts.findings.length) {
      lines.push(
        `Scope record: ${facts.findings
          .map(
            (finding) =>
              `${finding.title} (${state.findingReviews[finding.id].replace("_", " ")})`,
          )
          .join("; ")}.`,
      );
    }
    if (sections.invoices) {
      lines.push(
        `${formatMoney(facts.outstanding)} outstanding across ${
          facts.openInvoices.length
        } open invoice${facts.openInvoices.length === 1 ? "" : "s"}. PayPal Sandbox last checked 3 Nov, 09:02.`,
      );
    }
    return lines;
  }, [facts, sections, state.findingReviews]);

  const activeSectionCount = sectionDefs.filter(
    (section) => sections[section.id],
  ).length;

  const reports = useMemo(
    () =>
      [...state.reports]
        .filter((report) => statusFilter === "all" || report.status === statusFilter)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [state.reports, statusFilter],
  );

  const preview = previewId
    ? state.reports.find((report) => report.id === previewId)
    : null;
  const sendTarget = sendId
    ? state.reports.find((report) => report.id === sendId)
    : null;

  const generate = () => {
    const report: Report = {
      id: uid("rep"),
      title: `${client.company} — ${formatDate(rangeStart, "d MMM")} to ${formatDate(rangeEnd, "d MMM")}`,
      projectId,
      clientId: client.id,
      period: `${formatDate(rangeStart, "d MMM")} – ${formatDate(rangeEnd, "d MMM yyyy")}`,
      createdAt: new Date().toISOString(),
      status: "draft",
      pages: Math.max(1, Math.ceil(activeSectionCount / 2)),
      summary: previewLines.join(" "),
    };
    addReport(report);
    setGeneratedMeta((current) => ({
      ...current,
      [report.id]: {
        facts: previewLines,
        narrative: includeNarrative
          ? `${client.company} is ${project.progress}% through ${project.name}. The workspace records ${facts.done.length} completed milestone${
              facts.done.length === 1 ? "" : "s"
            } in this period and ${facts.openFindings.length} open scope question${
              facts.openFindings.length === 1 ? "" : "s"
            }. Nothing was inferred beyond the stored records; verify the summary before sending.`
          : "No AI narrative was added. This report contains source-backed facts only.",
      },
    }));
    addActivity({
      type: "report",
      actor: "Visun",
      title: "Report draft generated",
      detail: `${report.title} was built from stored milestones, invoices, and findings. Not sent.`,
      status: "info",
      reference: report.id,
      projectId,
    });
    push({
      tone: "success",
      title: "Draft generated",
      detail: "Review the facts and narrative before approving delivery.",
    });
    setBuilderOpen(false);
    setPreviewId(report.id);
  };

  const confirmSend = async () => {
    if (!sendTarget || !approval) return;
    setSending(true);
    const result = await sendReport(sendTarget.id, sendTarget.title);
    setSending(false);
    setSendId(null);
    setApproval(false);
    if (result.error) {
      push({
        tone: "error",
        title: "Report not sent",
        detail: `${result.error} Nothing was delivered.`,
      });
      return;
    }
    push({
      tone: result.simulated ? "info" : "success",
      title: result.simulated
        ? "Simulated delivery recorded"
        : "Report sent",
      detail: result.simulated
        ? `Gmail was not called. Simulated reference ${result.providerId ?? "none"}; the receipt is in Activity.`
        : `Provider message ${result.providerId ?? "returned by Gmail"}. Recorded in Activity.`,
    });
  };

  const download = (report: Report) => {
    const meta = generatedMeta[report.id];
    const lines = [
      report.title,
      report.period,
      `Client: ${clients.find((item) => item.id === report.clientId)?.company ?? "—"}`,
      "",
      "SOURCE-BACKED FACTS",
      ...(meta?.facts.length
        ? meta.facts.map((line) => `- ${line}`)
        : ["- Facts are derived from stored milestones, invoices, and findings."]),
      "",
      "NARRATIVE SUMMARY — VERIFY BEFORE SENDING",
      report.summary,
      "",
      `Status: ${report.status}`,
      report.providerMessageId
        ? `Provider message: ${report.providerMessageId}`
        : "No provider receipt recorded.",
      "",
      "Exported from Visun demo workspace. PayPal Sandbox — no money moved.",
    ];
    const blob = new Blob([lines.join("\n")], {
      type: "text/plain;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${report.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    push({
      tone: "success",
      title: "Text copy downloaded",
      detail: "A plain-text report was saved locally. PDF export is not implemented.",
    });
  };

  const openSend = (report: Report) => {
    setSendId(report.id);
    setApproval(false);
  };

  const previewFacts = preview
    ? generatedMeta[preview.id]?.facts ?? [
        `${preview.summary}`,
      ]
    : [];

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="eyebrow">Delivery</p>
            <Badge tone="yellow" className="!py-0.5 !text-[9.5px]">
              Source-labelled
            </Badge>
          </div>
          <h2 className="mt-1.5 text-[clamp(1.8rem,2.8vw,2.3rem)] font-semibold leading-tight tracking-[-0.035em]">
            Reports
          </h2>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-muted">
            Build a client update from stored records, separate facts from
            narrative, and require explicit approval before anything is sent.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="md"
            onClick={() =>
              router.push(
                `/app/copilot?prompt=${encodeURIComponent("What should go into this week's client report?")}`,
              )
            }
          >
            <Sparkles size={14} /> Ask Visun
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => setBuilderOpen((open) => !open)}
          >
            {builderOpen ? <ChevronUp size={14} /> : <Plus size={14} />}
            {builderOpen ? "Hide builder" : "Generate report"}
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          {
            label: "Reports",
            value: String(state.reports.length),
            hint: "Across 3 projects",
            icon: FileText,
          },
          {
            label: "Drafts",
            value: String(state.reports.filter((report) => report.status === "draft").length),
            hint: "Not sent to clients",
            icon: AlertTriangle,
            accent: true,
          },
          {
            label: "Sent",
            value: String(state.reports.filter((report) => report.status === "sent").length),
            hint: "With provider receipt",
            icon: Send,
          },
          {
            label: "Open scope items",
            value: String(
              scopeFindings.filter((finding) => {
                const review = state.findingReviews[finding.id];
                return review === "potential" || review === "reviewing";
              }).length,
            ),
            hint: "Worth mentioning",
            icon: ShieldCheck,
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Panel
              key={stat.label}
              className={cn(
                "flex flex-col justify-between p-4",
                stat.accent && "border-[#e7cf6f] bg-yellow",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="eyebrow !text-[9.5px]">{stat.label}</p>
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg border",
                    stat.accent
                      ? "border-[#e0c65c] bg-white/55 text-ink"
                      : "border-[#e6e1d8] bg-[#f8f7f3] text-[#6f6a62]",
                  )}
                >
                  <Icon size={13} />
                </span>
              </div>
              <div className="mt-3">
                <p className="tabular text-[23px] font-semibold leading-none tracking-tight">
                  {stat.value}
                </p>
                <p className="mt-1 text-[10.5px] text-[#6a665f]">{stat.hint}</p>
              </div>
            </Panel>
          );
        })}
      </section>

      {builderOpen ? (
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[#ece8e0] px-5 py-3.5">
            <div>
              <h3 className="text-[13.5px] font-semibold">Report builder</h3>
              <p className="mt-0.5 text-[10.5px] text-muted">
                Facts come from workspace records. The narrative is generated and
                must be verified.
              </p>
            </div>
            <Badge tone="warning" className="!py-0.5 !text-[9px]">
              Draft only
            </Badge>
          </div>

          <div className="grid gap-0 lg:grid-cols-[340px_1fr]">
            <div className="space-y-4 border-b border-[#ece8e0] p-5 lg:border-b-0 lg:border-r">
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-muted">
                  Client & project
                </span>
                <select
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                  className="h-10 w-full rounded-lg border border-[#e2ded6] bg-[#f8f6f1] px-2 text-[12px] outline-none focus:border-orange focus:bg-white"
                  aria-label="Report project"
                >
                  {projects
                    .filter((item) => item.status !== "completed")
                    .map((item) => {
                      const itemClient = clients.find(
                        (clientItem) => clientItem.id === item.clientId,
                      );
                      return (
                        <option key={item.id} value={item.id}>
                          {itemClient?.company} — {item.name}
                        </option>
                      );
                    })}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-muted">
                    From
                  </span>
                  <input
                    type="date"
                    value={rangeStart}
                    onChange={(event) => setRangeStart(event.target.value)}
                    className="h-10 w-full rounded-lg border border-[#e2ded6] bg-[#f8f6f1] px-2 text-[11.5px] outline-none focus:border-orange focus:bg-white"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-muted">
                    To
                  </span>
                  <input
                    type="date"
                    value={rangeEnd}
                    onChange={(event) => setRangeEnd(event.target.value)}
                    className="h-10 w-full rounded-lg border border-[#e2ded6] bg-[#f8f6f1] px-2 text-[11.5px] outline-none focus:border-orange focus:bg-white"
                  />
                </label>
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-medium text-muted">
                  Sections
                </p>
                <div className="space-y-1.5">
                  {sectionDefs.map((section) => (
                    <button
                      key={section.id}
                      onClick={() =>
                        setSections((current) => ({
                          ...current,
                          [section.id]: !current[section.id],
                        }))
                      }
                      className={cn(
                        "flex w-full items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition",
                        sections[section.id]
                          ? "border-[#e2ded6] bg-white"
                          : "border-[#ece8e0] bg-[#fbfaf7] opacity-70",
                      )}
                      aria-pressed={sections[section.id]}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                          sections[section.id]
                            ? "border-ink bg-ink text-canvas"
                            : "border-[#cfc9be] bg-white text-transparent",
                        )}
                      >
                        <Check size={10} strokeWidth={3} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[11px] font-medium">
                          {section.label}
                        </span>
                        <span className="mt-0.5 block text-[9.5px] leading-snug text-muted">
                          {section.description}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-[#eae5dc] bg-[#fbfaf7] px-3 py-1">
                <Switch
                  checked={includeNarrative}
                  onChange={setIncludeNarrative}
                  label="Include AI narrative"
                  description="Clearly labelled and separated from source-backed facts."
                />
              </div>

              <Button
                variant="primary"
                size="md"
                className="w-full"
                onClick={generate}
                disabled={activeSectionCount === 0}
              >
                <FileText size={14} /> Generate draft
              </Button>
              <p className="text-center text-[9.5px] text-muted">
                {activeSectionCount} section{activeSectionCount === 1 ? "" : "s"} ·{" "}
                {previewLines.length} sourced line
                {previewLines.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="bg-[#fbfaf7] p-5">
              <div className="mx-auto max-w-[640px] rounded-2xl border border-[#e3dfd7] bg-white p-5 shadow-neu-sm">
                <div className="flex items-start justify-between gap-3 border-b border-[#ece8e0] pb-3">
                  <div>
                    <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-orange">
                      Preview · {formatDate(rangeStart, "d MMM")} –{" "}
                      {formatDate(rangeEnd, "d MMM yyyy")}
                    </p>
                    <h4 className="mt-1 text-[17px] font-semibold tracking-tight">
                      {client.company}
                    </h4>
                    <p className="text-[10.5px] text-muted">
                      {project.name} · prepared for {client.email}
                    </p>
                  </div>
                  <Badge tone="warning" className="!py-0.5 !text-[8.5px]">
                    Not sent
                  </Badge>
                </div>

                <div className="mt-4">
                  <p className="eyebrow !text-[8.5px]">Source-backed facts</p>
                  {previewLines.length ? (
                    <ul className="mt-2 space-y-1.5">
                      {previewLines.map((line) => (
                        <li
                          key={line}
                          className="flex gap-2 text-[11px] leading-relaxed text-[#5f5b54]"
                        >
                          <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[#b9b3a8]" />
                          {line}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-[11px] text-muted">
                      Select at least one section to build the report.
                    </p>
                  )}
                </div>

                {includeNarrative ? (
                  <div className="mt-4 rounded-xl border border-[#ecd9a3] bg-[#fff9e8] p-3">
                    <p className="flex items-center gap-1.5 text-[8.5px] font-semibold uppercase tracking-wider text-[#7d5d00]">
                      <Sparkles size={10} /> AI narrative — verify
                    </p>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-[#6f6035]">
                      {client.company} is {project.progress}% through{" "}
                      {project.name}. {facts.done.length} milestone
                      {facts.done.length === 1 ? "" : "s"} completed in this period,{" "}
                      {facts.openFindings.length} open scope question
                      {facts.openFindings.length === 1 ? "" : "s"}, and{" "}
                      {formatMoney(facts.outstanding)} outstanding. Every claim
                      above traces to a stored record.
                    </p>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#ece8e0] pt-3 text-[9.5px] text-muted">
                  <span className="flex items-center gap-1">
                    <ReceiptText size={10} /> {facts.projectInvoices.length}{" "}
                    invoices · {facts.findings.length} findings
                  </span>
                  <span>PayPal Sandbox · checked 3 Nov, 09:02</span>
                </div>
              </div>
            </div>
          </div>
        </Panel>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-[#e2ded6] bg-[#f4f1ea] p-0.5">
          {(["all", "draft", "sent"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setStatusFilter(item)}
              className={cn(
                "rounded-md px-3 py-1.5 text-[11px] font-medium capitalize transition",
                statusFilter === item
                  ? "bg-white text-ink shadow-sm"
                  : "text-muted hover:text-ink",
              )}
              aria-pressed={statusFilter === item}
            >
              {item === "all" ? "All reports" : item}
            </button>
          ))}
        </div>
        <p className="text-[10.5px] text-muted">
          {state.reports.length} report{state.reports.length === 1 ? "" : "s"} in
          this workspace
        </p>
      </div>

      <Panel className="overflow-hidden">
        {reports.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<FileText size={18} />}
              title="No reports in this view"
              description="Generate a draft from stored milestones, invoices, and scope findings. Nothing is sent automatically."
              action={
                <Button size="sm" variant="primary" onClick={() => setBuilderOpen(true)}>
                  <Plus size={12} /> Generate a report
                </Button>
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-[#f0ece5]">
            {reports.map((report) => {
              const reportProject = projects.find(
                (item) => item.id === report.projectId,
              );
              const reportClient = clients.find(
                (item) => item.id === report.clientId,
              );
              return (
                <li
                  key={report.id}
                  className="group flex flex-col gap-3 px-5 py-4 transition hover:bg-[#fbfaf7] sm:flex-row sm:items-center"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#e6e1d8] bg-[#f8f7f3] text-[#6f6a62]">
                    <FileText size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setPreviewId(report.id)}
                        className="text-left text-[12.5px] font-semibold hover:text-orange"
                      >
                        {report.title}
                      </button>
                      <Badge
                        tone={statusTone[report.status]}
                        className="!py-0.5 !text-[8.5px]"
                        dot
                      >
                        {report.status === "draft"
                          ? "Draft · not sent"
                          : report.status === "sent"
                            ? report.simulated
                              ? "Simulated · no send"
                              : "Sent · provider receipt"
                            : "Failed"}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-[10.5px] text-muted">
                      {reportClient?.company} · {reportProject?.name} ·{" "}
                      {report.period} · {report.pages} page
                      {report.pages === 1 ? "" : "s"}
                    </p>
                    {report.providerMessageId ? (
                      <p className="mt-0.5 font-mono text-[8.5px] text-[#8a857c]">
                        {report.providerMessageId}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreviewId(report.id)}
                    >
                      <Eye size={12} /> Preview
                    </Button>
                    {report.status === "draft" ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => openSend(report)}
                      >
                        <Send size={12} /> Send
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => download(report)}
                      >
                        <Download size={12} /> Text
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Drawer
        open={Boolean(preview)}
        onClose={() => setPreviewId(null)}
        title={preview?.title ?? "Report"}
        subtitle={
          preview
            ? `${clients.find((item) => item.id === preview.clientId)?.company} · ${preview.period}`
            : undefined
        }
        footer={
          preview ? (
            <div className="flex flex-wrap items-center gap-2">
              {preview.status === "draft" ? (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => openSend(preview)}
                >
                  <Send size={12} /> Review & send
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                onClick={() => download(preview)}
              >
                <Download size={12} /> Download text
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  router.push(
                    `/app/copilot?prompt=${encodeURIComponent(
                      `Review the report "${preview.title}" before I send it.`,
                    )}`,
                  )
                }
              >
                <Sparkles size={12} /> Ask Visun to review
              </Button>
            </div>
          ) : null
        }
      >
        {preview ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                tone={statusTone[preview.status]}
                className="!py-0.5 !text-[9px]"
                dot
              >
                {preview.status === "draft"
                  ? "Draft · not sent"
                  : preview.status === "sent"
                    ? preview.simulated
                      ? "Simulated · no send"
                      : "Sent · provider receipt"
                    : "Failed"}
              </Badge>
              <span className="font-mono text-[9px] text-muted">
                {preview.pages} pages · created{" "}
                {formatDate(preview.createdAt, "d MMM, h:mm a")}
              </span>
            </div>

            <div className="rounded-xl border border-[#eae5dc] bg-[#fbfaf7] p-3.5">
              <p className="eyebrow !text-[8.5px]">Source-backed facts</p>
              <ul className="mt-2 space-y-1.5">
                {previewFacts.map((line) => (
                  <li
                    key={line}
                    className="flex gap-2 text-[11px] leading-relaxed text-[#5f5b54]"
                  >
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[#b9b3a8]" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-[#ecd9a3] bg-[#fff9e8] p-3.5">
              <p className="flex items-center gap-1.5 text-[8.5px] font-semibold uppercase tracking-wider text-[#7d5d00]">
                <Sparkles size={10} /> Narrative — verify before sending
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-[#6f6035]">
                {preview.summary}
              </p>
            </div>

            <dl className="space-y-2 rounded-xl border border-[#eae5dc] bg-white p-3.5 text-[10.5px]">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Recipient</dt>
                <dd className="font-medium">
                  {clients.find((item) => item.id === preview.clientId)?.email}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Delivery state</dt>
                <dd className="font-medium">
                  {preview.providerMessageId ?? "No provider receipt"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Report ID</dt>
                <dd className="font-mono text-[9.5px]">{preview.id}</dd>
              </div>
            </dl>

            <p className="rounded-xl bg-[#f8f6f1] px-3 py-2.5 text-[10px] leading-relaxed text-muted">
              Sending is simulated in this demo. A real delivery would use Gmail
              with an approval record and provider message ID in Activity.
            </p>
          </div>
        ) : null}
      </Drawer>

      <Modal
        open={Boolean(sendTarget)}
        onClose={() => {
          setSendId(null);
          setApproval(false);
        }}
        title="Approve report delivery"
        description="The exact recipient and body are shown below. Nothing sends until you confirm."
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSendId(null);
                setApproval(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={confirmSend}
              disabled={!approval || sending}
              loading={sending}
            >
              <Send size={12} /> {sending ? "Sending…" : "Send report"}
            </Button>
          </>
        }
      >
        {sendTarget ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-[#eae5dc] bg-[#fbfaf7] p-3.5 text-[11px]">
              <div className="flex justify-between gap-3">
                <span className="text-muted">To</span>
                <span className="font-medium">
                  {clients.find((item) => item.id === sendTarget.clientId)?.email}
                </span>
              </div>
              <div className="mt-1.5 flex justify-between gap-3">
                <span className="text-muted">Subject</span>
                <span className="font-medium">{sendTarget.title}</span>
              </div>
              <div className="mt-1.5 flex justify-between gap-3">
                <span className="text-muted">Attachments</span>
                <span className="font-medium">
                  Text report · {sendTarget.pages} pages
                </span>
              </div>
            </div>
            <div className="rounded-xl border border-[#eae5dc] bg-white p-3.5">
              <p className="eyebrow !text-[8.5px]">Body preview</p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-[#5f5b54]">
                Hi {clients.find((item) => item.id === sendTarget.clientId)?.name.split(" ")[0]},
                <br />
                <br />
                {sendTarget.summary}
                <br />
                <br />
                Best,
                <br />
                Ayush
              </p>
            </div>
            <label className="flex items-start gap-2.5 rounded-xl border border-[#ecd9a3] bg-[#fff9e8] p-3">
              <input
                type="checkbox"
                checked={approval}
                onChange={(event) => setApproval(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[#cfc9be] accent-[#ff5a00]"
              />
              <span className="text-[10.5px] leading-relaxed text-[#6f6035]">
                I reviewed the facts and narrative and approve sending this report
                once. Demo delivery is simulated and logged with a provider
                reference.
              </span>
            </label>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="grid h-[60vh] place-items-center">
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-orange border-t-transparent" />
            Loading reports…
          </div>
        </div>
      }
    >
      <ReportWorkspace />
    </Suspense>
  );
}
