"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  FileUp,
  Inbox,
  Link2,
  MessageSquare,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRoundCheck,
} from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Drawer,
  EmptyState,
  Modal,
  Panel,
  useToast,
} from "@/components/ui";
import { useAppStore } from "@/lib/store";
import type { ScopeFinding } from "@/lib/types";
import {
  cn,
  formatDate,
  formatMoney,
  formatTime,
  reviewLabel,
} from "@/lib/utils";

const sources = ["all", "Telegram", "Uploaded chat", "Email"] as const;
type SourceFilter = (typeof sources)[number];

const classificationLabel: Record<ScopeFinding["classification"], string> = {
  potential_change: "Potential change",
  within_scope: "Within scope",
  insufficient_context: "Needs context",
};

const classificationTone: Record<
  ScopeFinding["classification"],
  "warning" | "success" | "neutral"
> = {
  potential_change: "warning",
  within_scope: "success",
  insufficient_context: "neutral",
};

function redactText(text: string) {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/gi, "[email redacted]")
    .replace(/\+?\d[\d\s()-]{7,}\d/g, "[number redacted]");
}

export default function InboxPage() {
  const router = useRouter();
  const { push } = useToast();
  const { state, reviewFinding, addActivity } = useAppStore();
  const {
    agreements,
    messages: clientMessages,
    clients,
    projects,
    scopeFindings,
  } = state.reference;
  const [source, setSource] = useState<SourceFilter>("all");
  const [query, setQuery] = useState("");
  const [activeProjectId, setActiveProjectId] = useState("");
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [consent, setConsent] = useState(false);
  const [retention, setRetention] = useState<"30" | "90" | "365">("90");
  const [redact, setRedact] = useState(true);
  const [fileName, setFileName] = useState("");
  const [uploads, setUploads] = useState<
    { id: string; name: string; retention: string; messages: number }[]
  >([]);

  const groups = useMemo(() => {
    const term = query.trim().toLowerCase();
    return projects
      .map((project) => {
        const client = clients.find((item) => item.id === project.clientId)!;
        const allMessages = clientMessages
          .filter((message) => message.projectId === project.id)
          .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
        const messages = allMessages.filter(
          (message) => source === "all" || message.platform === source,
        );
        const findings = scopeFindings.filter(
          (finding) => finding.projectId === project.id,
        );
        const openFindings = findings.filter((finding) => {
          const review = state.findingReviews[finding.id];
          return review === "potential" || review === "reviewing";
        });
        return {
          project,
          client,
          messages,
          findings,
          openFindings,
          totalMessages: allMessages.length,
          lastMessage: allMessages[0],
          agreement: agreements.find((item) => item.projectId === project.id),
        };
      })
      .filter((group) => group.messages.length > 0)
      .filter((group) =>
        term
          ? `${group.project.name} ${group.client.name} ${group.client.company} ${group.messages
              .map((message) => message.text)
              .join(" ")}`
              .toLowerCase()
              .includes(term)
          : true,
      )
      .sort((a, b) =>
        (b.lastMessage?.sentAt ?? "").localeCompare(a.lastMessage?.sentAt ?? ""),
      );
  }, [
    agreements,
    clientMessages,
    clients,
    projects,
    query,
    scopeFindings,
    source,
    state.findingReviews,
  ]);

  const activeGroup =
    groups.find((group) => group.project.id === activeProjectId) ?? groups[0];

  const selectedFinding = selectedFindingId
    ? scopeFindings.find((finding) => finding.id === selectedFindingId)
    : null;
  const selectedProject = selectedFinding
    ? projects.find((project) => project.id === selectedFinding.projectId)
    : null;
  const selectedClause =
    selectedFinding && selectedProject
      ? agreements
          .find((item) => item.projectId === selectedProject.id)
          ?.clauses.find((clause) => clause.id === selectedFinding.clauseId)
      : null;

  const openFindings = scopeFindings.filter((finding) => {
    const review = state.findingReviews[finding.id];
    return review === "potential" || review === "reviewing";
  });
  const lastIngest = [...clientMessages].sort((a, b) =>
    b.sentAt.localeCompare(a.sentAt),
  )[0];

  const ask = (prompt: string) =>
    router.push(`/app/copilot?prompt=${encodeURIComponent(prompt)}`);

  const updateFinding = (
    finding: ScopeFinding,
    review: "accepted" | "dismissed",
  ) => {
    reviewFinding(finding.id, review);
    const project = projects.find((item) => item.id === finding.projectId);
    addActivity({
      type: "scope",
      actor: "You",
      title:
        review === "accepted"
          ? "Scope change accepted for drafting"
          : "Scope finding dismissed",
      detail: `${finding.title} on ${project?.name ?? "a project"} was marked ${review}. No charge was created.`,
      status: review === "accepted" ? "success" : "info",
      reference: finding.id,
      projectId: finding.projectId,
    });
    push({
      tone: review === "accepted" ? "success" : "info",
      title:
        review === "accepted" ? "Change accepted for drafting" : "Finding dismissed",
      detail:
        review === "accepted"
          ? "Nothing was invoiced. Ask Visun to draft the change order when ready."
          : "It stays in the record with your decision.",
    });
  };

  const submitUpload = () => {
    if (!consent || !fileName) return;
    const count = activeGroup?.messages.length ?? 0;
    setUploads((current) => [
      {
        id: `upload-${Math.random().toString(36).slice(2, 7)}`,
        name: fileName,
        retention,
        messages: count,
      },
      ...current,
    ]);
    addActivity({
      type: "ingest",
      actor: "You",
      title: "Transcript imported for review",
      detail: `${fileName} was added as a manual input with ${retention}-day retention. Consent was recorded before parsing.`,
      status: "info",
      reference: `upload-${Date.now()}`,
    });
    push({
      tone: "success",
      title: "Transcript staged for review",
      detail: `${fileName} · manual input · nothing is visible to clients.`,
    });
    setUploadOpen(false);
    setConsent(false);
    setRedact(true);
    setFileName("");
  };

  const previewMessages = (activeGroup?.messages ?? []).slice(0, 2);

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="eyebrow">Client signals</p>
            <Badge tone="yellow" className="!py-0.5 !text-[9.5px]">
              Sample data
            </Badge>
          </div>
          <h2 className="mt-1.5 text-[clamp(1.8rem,2.8vw,2.3rem)] font-semibold leading-tight tracking-[-0.035em]">
            Scope Inbox
          </h2>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-muted">
            Opted-in messages are compared to the signed agreement. Anything
            ambiguous is presented as evidence, never as an invoice.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="md" onClick={() => setUploadOpen(true)}>
            <Upload size={14} /> Upload transcript
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() =>
              ask("What changed across my projects and what needs my review?")
            }
          >
            <Sparkles size={14} /> Ask Visun
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: "Messages stored",
            value: String(clientMessages.length),
            hint: "Consented sources only",
            icon: MessageSquare,
          },
          {
            label: "Needs your review",
            value: String(openFindings.length),
            hint: "Potential + needs context",
            icon: ShieldAlert,
            accent: true,
          },
          {
            label: "Open findings",
            value: String(scopeFindings.length),
            hint: "Across 3 projects",
            icon: ShieldCheck,
          },
          {
            label: "Last ingest",
            value: lastIngest ? formatTime(lastIngest.sentAt) : "—",
            hint: lastIngest
              ? `${lastIngest.platform} · ${formatDate(lastIngest.sentAt, "d MMM")}`
              : "No source connected",
            icon: Link2,
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
                <p className="tabular text-[24px] font-semibold leading-none tracking-tight">
                  {stat.value}
                </p>
                <p className="mt-1 text-[10.5px] text-[#6a665f]">{stat.hint}</p>
              </div>
            </Panel>
          );
        })}
      </section>

      <div className="flex flex-col gap-3 rounded-2xl border border-[#e3dfd7] bg-white p-3 shadow-neu-sm sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-1">
          {sources.map((item) => (
            <button
              key={item}
              onClick={() => setSource(item)}
              className={cn(
                "rounded-lg px-3 py-2 text-[12px] font-medium transition",
                source === item
                  ? "bg-ink text-canvas shadow-sm"
                  : "text-muted hover:bg-[#f6f3ed] hover:text-ink",
              )}
              aria-pressed={source === item}
            >
              {item === "all" ? "All sources" : item}
            </button>
          ))}
        </div>
        <label className="relative flex-1 sm:max-w-[280px] sm:ml-auto">
          <Search
            size={13}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search messages or clients"
            className="h-9 w-full rounded-lg border border-[#e2ded6] bg-[#f8f6f1] pl-8 pr-2 text-[12px] outline-none transition focus:border-[#c8c1b4] focus:bg-white"
            aria-label="Search messages"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(280px,340px)_1fr]">
        <div className="space-y-4">
          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#ece8e0] px-4 py-3">
              <h3 className="text-[13px] font-semibold">Project threads</h3>
              <span className="font-mono text-[9.5px] text-muted">
                {groups.length} with messages
              </span>
            </div>
            {groups.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  compact
                  icon={<Inbox size={16} />}
                  title="No matching messages"
                  description="Try another source filter or clear the search. Nothing outside this workspace is read."
                />
              </div>
            ) : (
              <ul className="divide-y divide-[#f0ece5]">
                {groups.map((group) => {
                  const active = activeGroup?.project.id === group.project.id;
                  return (
                    <li key={group.project.id}>
                      <button
                        onClick={() => setActiveProjectId(group.project.id)}
                        className={cn(
                          "flex w-full items-start gap-3 px-4 py-3 text-left transition",
                          active ? "bg-[#fbfaf7]" : "hover:bg-[#fbfaf7]",
                        )}
                        aria-current={active ? "true" : undefined}
                      >
                        <Avatar
                          name={group.client.name}
                          initials={group.client.initials}
                          hue={group.client.hue}
                          size="md"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-[12.5px] font-semibold">
                              {group.client.company}
                            </span>
                            <span className="shrink-0 font-mono text-[8.5px] text-muted">
                              {group.lastMessage
                                ? formatDate(group.lastMessage.sentAt, "d MMM")
                                : "—"}
                            </span>
                          </span>
                          <span className="mt-0.5 block truncate text-[10.5px] text-muted">
                            {group.project.name}
                          </span>
                          <span className="mt-1.5 flex flex-wrap items-center gap-1">
                            <span className="rounded-md bg-[#f3f0e9] px-1.5 py-0.5 font-mono text-[8.5px] text-muted">
                              {group.messages.length} msg
                            </span>
                            {group.openFindings.length > 0 ? (
                              <span className="flex items-center gap-1 rounded-md bg-[#fff3cf] px-1.5 py-0.5 text-[8.5px] font-semibold text-[#775000]">
                                <ShieldAlert size={8} />
                                {group.openFindings.length} review
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 rounded-md bg-[#eaf5ee] px-1.5 py-0.5 text-[8.5px] font-medium text-success">
                                <Check size={8} /> clear
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#ece8e0] px-4 py-3">
              <h3 className="text-[13px] font-semibold">Session uploads</h3>
              <span className="font-mono text-[9.5px] text-muted">
                {uploads.length}
              </span>
            </div>
            {uploads.length === 0 ? (
              <p className="px-4 py-3.5 text-[10.5px] leading-relaxed text-muted">
                No files imported this session. WhatsApp exports are manual
                input — Visun cannot read personal chats in the background.
              </p>
            ) : (
              <ul className="divide-y divide-[#f0ece5]">
                {uploads.map((upload) => (
                  <li key={upload.id} className="flex items-center gap-2.5 px-4 py-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#eef4ee] text-success">
                      <FileUp size={12} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium">{upload.name}</p>
                      <p className="text-[9px] text-muted">
                        {upload.messages} messages · {upload.retention}-day retention
                      </p>
                    </div>
                    <Badge tone="neutral" className="!py-0 !text-[8px]">
                      Staged
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {activeGroup ? (
          <Panel className="flex min-h-[520px] flex-col overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#ece8e0] px-5 py-4">
              <div className="flex min-w-0 items-start gap-3">
                <Avatar
                  name={activeGroup.client.name}
                  initials={activeGroup.client.initials}
                  hue={activeGroup.client.hue}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[13.5px] font-semibold">
                      {activeGroup.client.company}
                    </p>
                    <Badge tone="neutral" className="!py-0 !text-[8.5px]">
                      {activeGroup.client.name}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[10.5px] text-muted">
                    {activeGroup.project.name} · {activeGroup.project.codename}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/app/projects/${activeGroup.project.id}`)}
              >
                Open project <ArrowUpRight size={11} />
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-[#f0ece5] bg-[#fbfaf7] px-5 py-2.5 text-[10px] text-muted">
              <span className="flex items-center gap-1.5">
                <UserRoundCheck size={11} className="text-success" />
                {activeGroup.messages[0]?.consent ?? "No consent recorded"}
              </span>
              <span className="flex items-center gap-1.5">
                <Link2 size={11} />
                {activeGroup.agreement?.version ?? "No agreement"} ·{" "}
                {activeGroup.agreement?.file ?? "unfiled"}
              </span>
              <span className="flex items-center gap-1.5">
                <MessageSquare size={11} />
                {activeGroup.messages.length} in this view
              </span>
            </div>

            <div className="space-y-5 p-5">
              {[...activeGroup.messages]
                .sort((a, b) => a.sentAt.localeCompare(b.sentAt))
                .map((message) => {
                  const mine = message.senderRole === "freelancer";
                  const finding = activeGroup.findings.find(
                    (item) => item.messageId === message.id,
                  );
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
                        hue={mine ? "ink" : activeGroup.client.hue}
                        size="sm"
                      />
                      <div className={cn("max-w-[82%]", mine && "text-right")}>
                        <div
                          className={cn(
                            "mb-1 flex flex-wrap items-center gap-1.5 text-[9.5px] text-muted",
                            mine && "justify-end",
                          )}
                        >
                          <span className="font-medium text-ink">
                            {message.sender}
                          </span>
                          <span>·</span>
                          <span>{formatTime(message.sentAt)}</span>
                          <Badge tone="neutral" className="!py-0 !text-[8px]">
                            {message.platform}
                          </Badge>
                        </div>
                        <div
                          className={cn(
                            "rounded-2xl border px-3.5 py-2.5 text-left text-[11.5px] leading-relaxed",
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
                          <div className="mt-2 rounded-xl border border-[#ecd9a3] bg-[#fff9e8] p-3 text-left">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="flex items-center gap-1 text-[9px] font-semibold text-[#7d5d00]">
                                <ShieldAlert size={10} />
                                Detected request
                              </span>
                              <Badge
                                tone={classificationTone[finding.classification]}
                                className="!py-0 !text-[8px]"
                              >
                                {classificationLabel[finding.classification]}
                              </Badge>
                              <span className="font-mono text-[8.5px] text-[#8b7330]">
                                {Math.round(finding.confidence * 100)}%
                              </span>
                            </div>
                            <p className="mt-1.5 text-[11px] font-medium leading-snug text-[#5d4a12]">
                              {finding.title}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="!h-7 !px-2 !text-[10px]"
                                onClick={() => setSelectedFindingId(finding.id)}
                              >
                                Evidence
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="!h-7 !px-2 !text-[10px]"
                                onClick={() =>
                                  updateFinding(finding, "accepted")
                                }
                                disabled={
                                  state.findingReviews[finding.id] === "accepted"
                                }
                              >
                                <Check size={10} /> Accept
                              </Button>
                              <span className="ml-auto text-[8.5px] text-[#8b7330]">
                                Not billable until reviewed
                              </span>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}

              {activeGroup.findings.length > 0 ? (
                <div className="border-t border-[#f0ece5] pt-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="eyebrow !text-[9px]">
                      Findings in this thread
                    </p>
                    <span className="text-[9.5px] text-muted">
                      Evidence stays linked
                    </span>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {activeGroup.findings.map((finding) => {
                      const review = state.findingReviews[finding.id];
                      return (
                        <button
                          key={finding.id}
                          onClick={() => setSelectedFindingId(finding.id)}
                          className="rounded-xl border border-[#e7e2d9] bg-white p-3 text-left transition hover:border-[#d5cdc0] hover:bg-[#fbfaf7]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <Badge
                              tone={classificationTone[finding.classification]}
                              className="!py-0 !text-[8px]"
                            >
                              {classificationLabel[finding.classification]}
                            </Badge>
                            <Badge
                              tone={
                                review === "accepted"
                                  ? "success"
                                  : review === "dismissed"
                                    ? "neutral"
                                    : "warning"
                              }
                              className="!py-0 !text-[8px]"
                            >
                              {reviewLabel[review]}
                            </Badge>
                          </div>
                          <p className="mt-1.5 text-[11px] font-medium leading-snug">
                            {finding.title}
                          </p>
                          <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-muted">
                            {finding.rationale}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-[#ece8e0] bg-[#fbfaf7] px-5 py-3">
              <p className="text-[10px] text-muted">
                Client text is evidence, not instructions. Visun never edits the
                agreement.
              </p>
              <button
                onClick={() =>
                  ask(
                    `Summarize the client messages on ${activeGroup.project.name} and flag anything outside scope.`,
                  )
                }
                className="flex items-center gap-1 text-[10.5px] font-medium text-orange hover:underline"
              >
                Summarize with Visun <ArrowRight size={11} />
              </button>
            </div>
          </Panel>
        ) : (
          <Panel className="grid min-h-[520px] place-items-center p-8">
            <EmptyState
              icon={<Inbox size={18} />}
              title="No conversation selected"
              description="Choose a project thread or adjust the source filter to see consented messages."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSource("all");
                    setQuery("");
                  }}
                >
                  Show all sources
                </Button>
              }
            />
          </Panel>
        )}
      </div>

      <Drawer
        open={Boolean(selectedFinding)}
        onClose={() => setSelectedFindingId(null)}
        title={selectedFinding?.title ?? "Finding"}
        subtitle={
          selectedProject
            ? `${selectedProject.name} · ${selectedFinding?.platform ?? ""}`
            : "Evidence"
        }
        footer={
          selectedFinding ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  updateFinding(selectedFinding, "accepted");
                  setSelectedFindingId(null);
                }}
                disabled={state.findingReviews[selectedFinding.id] === "accepted"}
              >
                <Check size={12} /> Accept for drafting
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  updateFinding(selectedFinding, "dismissed");
                  setSelectedFindingId(null);
                }}
                disabled={state.findingReviews[selectedFinding.id] === "dismissed"}
              >
                Dismiss
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  ask(
                    `Draft a change order for the ${selectedFinding.title} finding on ${selectedProject?.name ?? "this project"}.`,
                  )
                }
              >
                <Sparkles size={12} /> Ask Visun
              </Button>
            </div>
          ) : null
        }
      >
        {selectedFinding ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                tone={classificationTone[selectedFinding.classification]}
                className="!py-0.5 !text-[9px]"
              >
                {classificationLabel[selectedFinding.classification]}
              </Badge>
              <Badge
                tone={
                  state.findingReviews[selectedFinding.id] === "accepted"
                    ? "success"
                    : state.findingReviews[selectedFinding.id] === "dismissed"
                      ? "neutral"
                      : "warning"
                }
                className="!py-0.5 !text-[9px]"
              >
                {reviewLabel[state.findingReviews[selectedFinding.id]]}
              </Badge>
              <span className="ml-auto font-mono text-[9px] text-muted">
                {Math.round(selectedFinding.confidence * 100)}% confidence
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[#e7e2d9] bg-[#fbfaf7] p-3.5">
                <p className="eyebrow !text-[8.5px]">Agreed scope</p>
                <p className="mt-1.5 text-[10.5px] font-semibold text-[#6b4a00]">
                  {selectedClause?.label ?? "Clause"} · {selectedFinding.clauseId}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-[#5f5b54]">
                  {selectedClause?.text ?? "No matching clause found."}
                </p>
              </div>
              <div className="rounded-xl border border-[#ecd9a3] bg-[#fff9e8] p-3.5">
                <p className="eyebrow !text-[8.5px]">New request</p>
                <p className="mt-1.5 text-[10.5px] font-semibold">
                  {selectedFinding.sender} · {selectedFinding.platform}
                </p>
                <p className="mt-1 text-[11px] italic leading-relaxed text-[#6f6035]">
                  “{selectedFinding.message}”
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-[#eae5dc] bg-white p-3.5">
              <p className="eyebrow !text-[8.5px]">Why this was flagged</p>
              <p className="mt-1 text-[11px] leading-relaxed text-[#5f5b54]">
                {selectedFinding.rationale}
              </p>
              {selectedFinding.estimate > 0 ? (
                <p className="mt-2 text-[10.5px] font-medium text-[#7d5d00]">
                  Working estimate: {formatMoney(selectedFinding.estimate)} — a
                  proposal, not a quote.
                </p>
              ) : null}
            </div>

            <dl className="space-y-2 rounded-xl border border-[#eae5dc] bg-[#fbfaf7] p-3.5 text-[10.5px]">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Received</dt>
                <dd className="font-medium">
                  {formatDate(selectedFinding.receivedAt, "d MMM yyyy, h:mm a")}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Message reference</dt>
                <dd className="font-mono text-[9.5px]">{selectedFinding.messageId}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Finding reference</dt>
                <dd className="font-mono text-[9.5px]">{selectedFinding.id}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Billing effect</dt>
                <dd className="font-medium">None until you approve</dd>
              </div>
            </dl>

            <p className="rounded-xl bg-[#f8f6f1] px-3 py-2.5 text-[10px] leading-relaxed text-muted">
              Correcting a classification is logged for your workspace context.
              Private chats are never used to train third-party models without
              permission.
            </p>
          </div>
        ) : null}
      </Drawer>

      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload a consented transcript"
        description="Manual input only. Supported: .txt, .json, .zip (max 5 MB). Nothing is ingested until consent is recorded."
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUploadOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={submitUpload}
              disabled={!consent || !fileName}
            >
              <FileUp size={12} /> Stage transcript
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block cursor-pointer rounded-xl border border-dashed border-[#cfc9be] bg-[#fbfaf7] px-4 py-6 text-center transition hover:border-[#b9b3a7] hover:bg-white">
            <input
              type="file"
              accept=".txt,.json,.zip"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                setFileName(file?.name ?? "");
              }}
            />
            <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-stone text-muted">
              <Upload size={16} />
            </span>
            <span className="mt-2 block text-[12.5px] font-semibold">
              {fileName || "Choose an export file"}
            </span>
            <span className="mt-0.5 block text-[10.5px] text-muted">
              WhatsApp-style exports are uploaded by you — not read automatically.
            </span>
          </label>

          <div className="rounded-xl border border-[#eae5dc] bg-white p-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="eyebrow !text-[8.5px]">Redaction preview</p>
              <button
                onClick={() => setRedact((value) => !value)}
                className="rounded-md border border-[#e2ded6] px-2 py-1 text-[9.5px] font-medium text-muted transition hover:bg-stone hover:text-ink"
                aria-pressed={redact}
              >
                {redact ? "Redaction on" : "Redaction off"}
              </button>
            </div>
            <div className="mt-2 space-y-1.5">
              {previewMessages.length > 0 ? (
                previewMessages.map((message) => (
                  <p
                    key={message.id}
                    className="rounded-lg bg-[#f8f6f1] px-2.5 py-2 text-[10.5px] leading-relaxed text-[#5f5b54]"
                  >
                    {redact ? redactText(message.text) : message.text}
                  </p>
                ))
              ) : (
                <p className="text-[10.5px] text-muted">
                  Select a thread with messages to preview redaction.
                </p>
              )}
            </div>
            <p className="mt-2 text-[9px] text-muted">
              Emails and phone numbers are masked before parsing in this preview.
            </p>
          </div>

          <label className="flex items-center justify-between gap-3">
            <span className="text-[11.5px] text-muted">Retention</span>
            <select
              value={retention}
              onChange={(event) =>
                setRetention(event.target.value as typeof retention)
              }
              className="h-9 rounded-lg border border-[#e2ded6] bg-[#f8f6f1] px-2 text-[11.5px] text-ink outline-none focus:border-orange"
              aria-label="Transcript retention"
            >
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="365">1 year</option>
            </select>
          </label>

          <label className="flex items-start gap-2.5 rounded-xl border border-[#eae5dc] bg-[#fbfaf7] p-3">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-[#c9c3b8] accent-[#ff5a00]"
            />
            <span className="text-[10.5px] leading-relaxed text-[#5f5b54]">
              I confirm every participant consented to this transcript being
              processed for scope review. I can revoke this at any time.
            </span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
