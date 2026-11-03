"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Mail,
  Plus,
  Search,
  Sparkles,
  Trophy,
  Users,
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
import type { Lead, LeadStage } from "@/lib/types";
import {
  cn,
  formatDate,
  formatMoney,
  formatTime,
  initialsOf,
  leadStageLabel,
  leadStageOrder,
  sum,
  uid,
} from "@/lib/utils";

const stageTone: Record<LeadStage, string> = {
  new: "bg-[#eef1f9]",
  contacted: "bg-[#f2efe9]",
  qualified: "bg-[#fff3cf]",
  proposal: "bg-[#ffe7d9]",
  won: "bg-[#eaf5ee]",
};

export default function LeadsPage() {
  const router = useRouter();
  const { push } = useToast();
  const { state, addLead, moveLead } = useAppStore();
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [todayOnly, setTodayOnly] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    source: "Referral",
    interest: "",
    value: "2400",
    nextAction: "Send a scope questionnaire",
    nextActionAt: "2026-11-05",
  });

  const sources = useMemo(
    () => Array.from(new Set(state.leads.map((lead) => lead.source))),
    [state.leads],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return state.leads
      .filter((lead) => (source === "all" ? true : lead.source === source))
      .filter((lead) =>
        todayOnly ? lead.receivedAt.startsWith("2026-11-03") : true,
      )
      .filter((lead) =>
        term
          ? `${lead.name} ${lead.company} ${lead.email} ${lead.interest} ${lead.source}`
              .toLowerCase()
              .includes(term)
          : true,
      )
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  }, [query, source, state.leads, todayOnly]);

  const detail = detailId
    ? state.leads.find((lead) => lead.id === detailId)
    : null;

  const pipeline = sum(
    state.leads.filter((lead) => lead.stage !== "won").map((lead) => lead.value),
  );
  const todayLeads = state.leads.filter((lead) =>
    lead.receivedAt.startsWith("2026-11-03"),
  );
  const proposalLeads = state.leads.filter((lead) => lead.stage === "proposal");
  const wonLeads = state.leads.filter((lead) => lead.stage === "won");

  const move = (lead: Lead, direction: -1 | 1) => {
    const index = leadStageOrder.indexOf(lead.stage);
    const nextIndex = Math.min(
      leadStageOrder.length - 1,
      Math.max(0, index + direction),
    );
    const next = leadStageOrder[nextIndex];
    if (next === lead.stage) return;
    moveLead(lead.id, next);
    push({
      tone: next === "won" ? "success" : "info",
      title:
        next === "won"
          ? `${lead.company} marked won`
          : `Moved to ${leadStageLabel[next]}`,
      detail:
        next === "won"
          ? "No invoice, contract, or email was created. This is a local pipeline change."
          : `${lead.name} · ${lead.company}`,
    });
  };

  const submitLead = () => {
    if (!form.name.trim() || !form.company.trim()) return;
    const lead: Lead = {
      id: uid("lead"),
      name: form.name.trim(),
      company: form.company.trim(),
      email: form.email.trim() || `hello@${form.company.trim().toLowerCase().replace(/[^a-z0-9]+/g, "")}.com`,
      source: form.source,
      stage: "new",
      receivedAt: new Date().toISOString(),
      interest: form.interest.trim() || "Interested in a new project.",
      nextAction: form.nextAction.trim() || "Follow up",
      nextActionAt: `${form.nextActionAt}T10:00:00+05:30`,
      value: Number(form.value) || 0,
    };
    addLead(lead);
    push({
      tone: "success",
      title: "Lead added",
      detail: `${lead.name} · ${formatMoney(lead.value)} potential. Stored locally.`,
    });
    setAddOpen(false);
    setForm({
      name: "",
      company: "",
      email: "",
      source: "Referral",
      interest: "",
      value: "2400",
      nextAction: "Send a scope questionnaire",
      nextActionAt: "2026-11-05",
    });
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="eyebrow">Pipeline</p>
            <Badge tone="yellow" className="!py-0.5 !text-[9.5px]">
              Manual + connected
            </Badge>
          </div>
          <h2 className="mt-1.5 text-[clamp(1.8rem,2.8vw,2.3rem)] font-semibold leading-tight tracking-[-0.035em]">
            Leads
          </h2>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-muted">
            Today&apos;s inquiries use workspace time and stored records only. No
            CRM or LinkedIn source is connected.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="md"
            onClick={() =>
              router.push(
                `/app/copilot?prompt=${encodeURIComponent("Who are my leads and which need a follow-up today?")}`,
              )
            }
          >
            <Sparkles size={14} /> Review pipeline
          </Button>
          <Button variant="primary" size="md" onClick={() => setAddOpen(true)}>
            <Plus size={14} /> Add lead
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          {
            label: "Pipeline value",
            value: formatMoney(pipeline),
            hint: `${state.leads.filter((lead) => lead.stage !== "won").length} open leads`,
            icon: Users,
            accent: true,
          },
          {
            label: "Received today",
            value: String(todayLeads.length),
            hint: todayLeads.length ? "Workspace timezone" : "No source connected",
            icon: Clock3,
          },
          {
            label: "In proposal",
            value: String(proposalLeads.length),
            hint: proposalLeads.length
              ? `${formatMoney(sum(proposalLeads.map((lead) => lead.value)))} pending`
              : "Nothing out",
            icon: Mail,
          },
          {
            label: "Won",
            value: String(wonLeads.length),
            hint: wonLeads.length ? "Closed in workspace" : "No closed deals yet",
            icon: Trophy,
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

      <div className="flex flex-col gap-3 rounded-2xl border border-[#e3dfd7] bg-white p-3 shadow-neu-sm lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={() => setTodayOnly(false)}
            className={cn(
              "rounded-lg px-3 py-2 text-[12px] font-medium transition",
              !todayOnly
                ? "bg-ink text-canvas"
                : "text-muted hover:bg-[#f6f3ed] hover:text-ink",
            )}
            aria-pressed={!todayOnly}
          >
            All leads
          </button>
          <button
            onClick={() => setTodayOnly(true)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium transition",
              todayOnly
                ? "bg-ink text-canvas"
                : "text-muted hover:bg-[#f6f3ed] hover:text-ink",
            )}
            aria-pressed={todayOnly}
          >
            Today
            <span className="font-mono text-[9px] opacity-60">
              {todayLeads.length}
            </span>
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <label className="flex items-center gap-1.5 text-[10.5px] text-muted">
            Source
            <select
              value={source}
              onChange={(event) => setSource(event.target.value)}
              className="h-9 max-w-[190px] rounded-lg border border-[#e2ded6] bg-[#f8f6f1] px-2 text-[11.5px] text-ink outline-none focus:border-orange"
              aria-label="Filter leads by source"
            >
              <option value="all">All sources</option>
              {sources.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="relative flex-1 sm:max-w-[220px]">
            <Search
              size={13}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search leads"
              className="h-9 w-full rounded-lg border border-[#e2ded6] bg-[#f8f6f1] pl-8 pr-2 text-[12px] outline-none transition focus:border-[#c8c1b4] focus:bg-white"
              aria-label="Search leads"
            />
          </label>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Panel className="p-6">
          <EmptyState
            icon={<Users size={18} />}
            title="No leads match this view"
            description="Clear the search, source, or today&apos;s filter. The demo workspace starts with five leads."
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setSource("all");
                  setTodayOnly(false);
                }}
              >
                Reset filters
              </Button>
            }
          />
        </Panel>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="grid min-w-[1080px] grid-cols-5 gap-3">
            {leadStageOrder.map((stage) => {
              const stageLeads = filtered.filter((lead) => lead.stage === stage);
              const stageValue = sum(stageLeads.map((lead) => lead.value));
              return (
                <div
                  key={stage}
                  className="flex flex-col rounded-2xl border border-[#e3dfd7] bg-[#fbfaf7] p-2"
                >
                  <div className="flex items-center justify-between gap-2 px-1.5 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-semibold text-ink",
                          stageTone[stage],
                        )}
                      >
                        {stageLeads.length}
                      </span>
                      <p className="text-[11.5px] font-semibold">
                        {leadStageLabel[stage]}
                      </p>
                    </div>
                    <span className="tabular text-[9px] text-muted">
                      {stageValue ? formatMoney(stageValue, "USD", { compact: true }) : "—"}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col gap-2">
                    {stageLeads.map((lead) => (
                      <div
                        key={lead.id}
                        className="rounded-xl border border-[#e7e2d9] bg-white p-3 shadow-sm transition hover:border-[#d5cdc0]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <Avatar
                              name={lead.name}
                              initials={initialsOf(lead.name)}
                              hue={
                                lead.stage === "won"
                                  ? "ink"
                                  : lead.stage === "proposal"
                                    ? "orange"
                                    : lead.stage === "qualified"
                                      ? "yellow"
                                      : "stone"
                              }
                              size="sm"
                            />
                            <div className="min-w-0">
                              <button
                                onClick={() => setDetailId(lead.id)}
                                className="block max-w-[140px] truncate text-left text-[11.5px] font-semibold hover:text-orange"
                              >
                                {lead.name}
                              </button>
                              <p className="max-w-[140px] truncate text-[9.5px] text-muted">
                                {lead.company}
                              </p>
                            </div>
                          </div>
                          <span className="tabular shrink-0 text-[10px] font-semibold">
                            {formatMoney(lead.value, "USD", { compact: true })}
                          </span>
                        </div>

                        <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-[#6b665f]">
                          {lead.interest}
                        </p>

                        <div className="mt-2 flex items-center justify-between gap-1">
                          <span className="truncate rounded bg-[#f4f1ea] px-1.5 py-0.5 text-[8px] text-muted">
                            {lead.source}
                          </span>
                          <span className="shrink-0 font-mono text-[8px] text-muted">
                            {formatDate(lead.receivedAt, "d MMM")}
                          </span>
                        </div>

                        <div className="mt-2 border-t border-[#f0ece5] pt-2">
                          <p className="flex items-start gap-1 text-[9px] leading-snug text-[#7a6b3e]">
                            <Clock3 size={9} className="mt-0.5 shrink-0" />
                            <span className="line-clamp-2">{lead.nextAction}</span>
                          </p>
                          <div className="mt-2 flex items-center justify-between gap-1">
                            <div className="flex gap-1">
                              <button
                                onClick={() => move(lead, -1)}
                                disabled={lead.stage === leadStageOrder[0]}
                                className="flex h-6 w-6 items-center justify-center rounded-md border border-[#e7e2d9] text-muted transition hover:bg-stone hover:text-ink disabled:opacity-30"
                                aria-label={`Move ${lead.company} back a stage`}
                              >
                                <ChevronLeft size={11} />
                              </button>
                              <button
                                onClick={() => move(lead, 1)}
                                disabled={
                                  lead.stage ===
                                  leadStageOrder[leadStageOrder.length - 1]
                                }
                                className="flex h-6 w-6 items-center justify-center rounded-md border border-[#e7e2d9] text-muted transition hover:bg-stone hover:text-ink disabled:opacity-30"
                                aria-label={`Move ${lead.company} forward a stage`}
                              >
                                <ChevronRight size={11} />
                              </button>
                            </div>
                            <button
                              onClick={() => setDetailId(lead.id)}
                              className="flex items-center gap-0.5 text-[9px] font-medium text-muted transition hover:text-ink"
                            >
                              Open <ArrowUpRight size={9} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {stageLeads.length === 0 ? (
                      <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[#ddd7cc] px-2 py-6 text-center text-[9.5px] text-muted">
                        Nothing here
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Panel className="flex flex-col items-start justify-between gap-3 bg-[#fbfaf7] p-4 sm:flex-row sm:items-center">
        <p className="max-w-2xl text-[10.5px] leading-relaxed text-muted">
          Stage changes are local to this demo. Moving a lead to Won does not
          create an invoice, contract, or client email. A real pipeline would sync
          through a connected CRM.
        </p>
        <Badge tone="neutral" dot>
          {state.leads.length} total leads
        </Badge>
      </Panel>

      <Drawer
        open={Boolean(detail)}
        onClose={() => setDetailId(null)}
        title={detail?.name ?? "Lead"}
        subtitle={detail ? `${detail.company} · ${leadStageLabel[detail.stage]}` : undefined}
        footer={
          detail ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={() =>
                  router.push(
                    `/app/copilot?prompt=${encodeURIComponent(
                      `Draft a follow-up for ${detail.name} at ${detail.company} about ${detail.interest}`,
                    )}`,
                  )
                }
              >
                <Sparkles size={12} /> Draft follow-up
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => move(detail, 1)}
                disabled={detail.stage === "won"}
              >
                Advance stage
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDetailId(null);
                  setAddOpen(true);
                }}
              >
                <Plus size={12} /> Add another
              </Button>
            </div>
          ) : null
        }
      >
        {detail ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl border border-[#eae5dc] bg-white p-4">
              <Avatar
                name={detail.name}
                initials={initialsOf(detail.name)}
                hue="orange"
                size="lg"
              />
              <div className="min-w-0">
                <p className="text-[14px] font-semibold">{detail.name}</p>
                <p className="text-[11px] text-muted">{detail.company}</p>
                <a
                  href={`mailto:${detail.email}`}
                  className="mt-1 flex items-center gap-1 text-[10.5px] text-[#4f6f8f] hover:underline"
                >
                  <Mail size={10} /> {detail.email}
                </a>
              </div>
              <div className="ml-auto text-right">
                <p className="tabular text-[17px] font-semibold leading-none">
                  {formatMoney(detail.value)}
                </p>
                <p className="mt-1 text-[9px] text-muted">potential value</p>
              </div>
            </div>

            <div className="rounded-xl border border-[#eae5dc] bg-[#fbfaf7] p-3.5">
              <p className="eyebrow !text-[8.5px]">Interest</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-[#5f5b54]">
                {detail.interest}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-[#eae5dc] bg-white p-3">
                <p className="eyebrow !text-[8.5px]">Source</p>
                <p className="mt-1 text-[11px] font-medium">{detail.source}</p>
              </div>
              <div className="rounded-xl border border-[#eae5dc] bg-white p-3">
                <p className="eyebrow !text-[8.5px]">Received</p>
                <p className="mt-1 text-[11px] font-medium">
                  {formatDate(detail.receivedAt, "d MMM yyyy")}
                </p>
                <p className="text-[9px] text-muted">{formatTime(detail.receivedAt)}</p>
              </div>
            </div>

            <div className="rounded-xl border border-[#ecd9a3] bg-[#fff9e8] p-3.5">
              <p className="eyebrow !text-[8.5px]">Next action</p>
              <p className="mt-1 text-[11.5px] font-medium text-[#5d4a12]">
                {detail.nextAction}
              </p>
              <p className="mt-0.5 text-[10px] text-[#8b7330]">
                Due {formatDate(detail.nextActionAt, "d MMM yyyy, h:mm a")}
              </p>
            </div>

            <div className="rounded-xl border border-[#eae5dc] bg-white p-3.5">
              <p className="eyebrow !text-[8.5px]">Stage</p>
              <div className="mt-2 flex items-center gap-1">
                {leadStageOrder.map((stage, index) => {
                  const active = leadStageOrder.indexOf(detail.stage) >= index;
                  return (
                    <span
                      key={stage}
                      className={cn(
                        "h-1.5 flex-1 rounded-full",
                        active ? "bg-orange" : "bg-[#e8e4dc]",
                      )}
                      title={leadStageLabel[stage]}
                    />
                  );
                })}
              </div>
              <div className="mt-1.5 flex justify-between text-[8.5px] text-muted">
                <span>New</span>
                <span>Won</span>
              </div>
              <select
                value={detail.stage}
                onChange={(event) => {
                  moveLead(detail.id, event.target.value as LeadStage);
                  push({
                    tone: "info",
                    title: "Stage updated",
                    detail: `${detail.company} moved to ${leadStageLabel[event.target.value as LeadStage]}.`,
                  });
                }}
                className="mt-3 h-9 w-full rounded-lg border border-[#e2ded6] bg-[#f8f6f1] px-2 text-[11.5px] outline-none focus:border-orange"
                aria-label="Lead stage"
              >
                {leadStageOrder.map((stage) => (
                  <option key={stage} value={stage}>
                    {leadStageLabel[stage]}
                  </option>
                ))}
              </select>
            </div>

            <p className="rounded-xl bg-[#f8f6f1] px-3 py-2.5 text-[10px] leading-relaxed text-muted">
              Assignee: Ayush Paroha. Source records are manually entered or
              imported in this demo — no external prospecting tool is connected.
            </p>
          </div>
        ) : null}
      </Drawer>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add a lead"
        description="Stored in this browser only. Adding a lead does not send anything or create a client record."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={submitLead}
              disabled={!form.name.trim() || !form.company.trim()}
            >
              <Plus size={12} /> Add lead
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-muted">Name</span>
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Nina Patel"
              className="h-10 w-full rounded-lg border border-[#e2ded6] bg-[#f8f6f1] px-3 text-[12px] outline-none focus:border-orange focus:bg-white"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-muted">Company</span>
            <input
              value={form.company}
              onChange={(event) => setForm({ ...form, company: event.target.value })}
              placeholder="Nina Patel Ceramics"
              className="h-10 w-full rounded-lg border border-[#e2ded6] bg-[#f8f6f1] px-3 text-[12px] outline-none focus:border-orange focus:bg-white"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[11px] font-medium text-muted">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="hello@example.com"
              className="h-10 w-full rounded-lg border border-[#e2ded6] bg-[#f8f6f1] px-3 text-[12px] outline-none focus:border-orange focus:bg-white"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-muted">Source</span>
            <select
              value={form.source}
              onChange={(event) => setForm({ ...form, source: event.target.value })}
              className="h-10 w-full rounded-lg border border-[#e2ded6] bg-[#f8f6f1] px-2 text-[12px] outline-none focus:border-orange focus:bg-white"
            >
              {["Referral", "Website form", "Telegram community", "LinkedIn", "Email"].map(
                (item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-muted">
              Potential value (USD)
            </span>
            <input
              type="number"
              min={0}
              value={form.value}
              onChange={(event) => setForm({ ...form, value: event.target.value })}
              className="h-10 w-full rounded-lg border border-[#e2ded6] bg-[#f8f6f1] px-3 text-[12px] outline-none focus:border-orange focus:bg-white"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[11px] font-medium text-muted">Interest</span>
            <textarea
              value={form.interest}
              onChange={(event) => setForm({ ...form, interest: event.target.value })}
              rows={2}
              placeholder="What are they looking for?"
              className="w-full resize-none rounded-lg border border-[#e2ded6] bg-[#f8f6f1] px-3 py-2 text-[12px] outline-none focus:border-orange focus:bg-white"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-muted">Next action</span>
            <input
              value={form.nextAction}
              onChange={(event) => setForm({ ...form, nextAction: event.target.value })}
              className="h-10 w-full rounded-lg border border-[#e2ded6] bg-[#f8f6f1] px-3 text-[12px] outline-none focus:border-orange focus:bg-white"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-muted">Due</span>
            <input
              type="date"
              value={form.nextActionAt}
              onChange={(event) => setForm({ ...form, nextActionAt: event.target.value })}
              className="h-10 w-full rounded-lg border border-[#e2ded6] bg-[#f8f6f1] px-3 text-[12px] outline-none focus:border-orange focus:bg-white"
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}
