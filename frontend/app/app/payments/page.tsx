"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Check,
  CircleDollarSign,
  Clock3,
  Copy,
  Mail,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Drawer,
  EmptyState,
  Panel,
  Progress,
  useToast,
} from "@/components/ui";
import { clients, invoices, milestones, projects } from "@/lib/demo-data";
import { useAppStore } from "@/lib/store";
import type { Invoice } from "@/lib/types";
import {
  cn,
  formatDate,
  formatMoney,
  formatTime,
  invoiceStatusLabel,
  statusTone,
  sum,
  uid,
} from "@/lib/utils";

const filters = [
  { id: "all", label: "All" },
  { id: "open", label: "Outstanding" },
  { id: "overdue", label: "Overdue" },
  { id: "paid", label: "Paid" },
  { id: "draft", label: "Drafts" },
] as const;

type FilterId = (typeof filters)[number]["id"];

const isOpen = (invoice: Invoice) =>
  ["sent", "overdue", "partially_paid"].includes(invoice.status);

export default function PaymentsPage() {
  const router = useRouter();
  const { push } = useToast();
  const {
    recheckPayments,
    createConversation,
    addMessage,
    addActivity,
  } = useAppStore();
  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const invoiced = sum(
    invoices.filter((invoice) => invoice.status !== "draft").map((invoice) => invoice.amount),
  );
  const collected = sum(invoices.map((invoice) => invoice.amountPaid));
  const outstanding = sum(
    invoices.filter(isOpen).map((invoice) => invoice.amount - invoice.amountPaid),
  );
  const overdue = sum(
    invoices
      .filter((invoice) => invoice.status === "overdue")
      .map((invoice) => invoice.amount - invoice.amountPaid),
  );
  const lastChecked = invoices
    .map((invoice) => invoice.lastVerifiedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  const enriched = useMemo(
    () =>
      invoices.map((invoice) => ({
        invoice,
        client: clients.find((item) => item.id === invoice.clientId)!,
        project: projects.find((item) => item.id === invoice.projectId)!,
        remaining: invoice.amount - invoice.amountPaid,
      })),
    [],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return enriched
      .filter(({ invoice }) => {
        if (filter === "all") return true;
        if (filter === "open") return isOpen(invoice);
        return invoice.status === filter;
      })
      .filter(({ invoice, client, project }) =>
        term
          ? `${invoice.number} ${client.name} ${client.company} ${project.name}`
              .toLowerCase()
              .includes(term)
          : true,
      )
      .sort((a, b) => a.invoice.dueAt.localeCompare(b.invoice.dueAt));
  }, [enriched, filter, query]);

  const detail = detailId
    ? enriched.find(({ invoice }) => invoice.id === detailId)
    : null;

  const sync = async () => {
    setSyncing(true);
    await recheckPayments();
    setSyncing(false);
    push({
      tone: "success",
      title: "PayPal Sandbox rechecked",
      detail: "Six invoices reconciled. Statuses are unchanged in demo mode.",
    });
  };

  const copyReference = async (reference: string) => {
    try {
      await navigator.clipboard.writeText(reference);
      push({
        tone: "success",
        title: "Reference copied",
        detail: reference,
      });
    } catch {
      push({
        tone: "error",
        title: "Clipboard blocked",
        detail: `Copy this reference manually: ${reference}`,
      });
    }
  };

  const draftReminder = (invoice: Invoice) => {
    const client = clients.find((item) => item.id === invoice.clientId)!;
    const project = projects.find((item) => item.id === invoice.projectId)!;
    const remaining = invoice.amount - invoice.amountPaid;
    const conversationId = createConversation(`Reminder — ${invoice.number}`);
    addMessage(conversationId, {
      id: uid("m"),
      role: "assistant",
      modality: "text",
      text: `I prepared a reminder for **${invoice.number}** on ${project.name}. It names **${formatMoney(
        remaining,
        invoice.currency,
      )}** and links the ${invoice.provider} invoice.\n\nNothing has been sent. Approve it in the copilot to execute exactly once.`,
      at: new Date().toISOString(),
      tools: [
        {
          id: uid("t"),
          name: "draft_payment_reminder",
          args: `invoice_id: ${invoice.id}`,
          status: "done",
          duration: "740ms",
          result: "Draft ready · awaiting approval",
        },
      ],
      sources: [
        {
          kind: "Invoice",
          label: `${invoice.number} · ${formatMoney(remaining, invoice.currency)} · ${invoice.status}`,
          id: invoice.id,
          checkedAt: invoice.lastVerifiedAt ?? invoice.issuedAt,
        },
      ],
      action: {
        id: uid("act"),
        kind: "payment_request",
        title: `Payment reminder — ${invoice.number}`,
        recipient: client.email,
        subject: `Quick nudge — ${invoice.number} (${formatMoney(remaining, invoice.currency)})`,
        body: `Hi ${client.name.split(" ")[0]},\n\nA small nudge on ${invoice.number} for ${project.name} — ${formatMoney(
          remaining,
          invoice.currency,
        )}, which was due on ${formatDate(invoice.dueAt)}.\n\nThe ${invoice.provider} invoice reference is ${invoice.providerId}. Happy to resend it if helpful.\n\nThanks,\nAyush`,
        amount: remaining,
        currency: invoice.currency,
        provider: "Gmail",
        status: "pending_approval",
        createdAt: new Date().toISOString(),
      },
    });
    addActivity({
      type: "approval",
      actor: "Visun",
      title: "Payment reminder drafted",
      detail: `${invoice.number} reminder prepared for ${client.email}. No email was sent.`,
      status: "pending",
      reference: invoice.id,
      projectId: invoice.projectId,
    });
    setDetailId(null);
    push({
      tone: "info",
      title: "Reminder drafted",
      detail: "Review the exact payload in the copilot. Nothing sends without approval.",
    });
    router.push("/app/copilot");
  };

  const timelineFor = (invoice: Invoice) => {
    const client = clients.find((item) => item.id === invoice.clientId)!;
    const events = [
      {
        label: "Invoice created",
        detail: `${invoice.number} issued to ${client.company}.`,
        at: invoice.issuedAt,
        tone: "info" as const,
      },
      ...(invoice.status !== "draft"
        ? [
            {
              label: "Sent to client",
              detail: `Delivery recorded in ${invoice.provider}.`,
              at: invoice.issuedAt,
              tone: "info" as const,
            },
          ]
        : []),
      ...(invoice.amountPaid > 0
        ? [
            {
              label: invoice.amountPaid === invoice.amount ? "Paid in full" : "Partial payment received",
              detail: `${formatMoney(invoice.amountPaid, invoice.currency)} matched to ${invoice.providerId}.`,
              at: invoice.lastVerifiedAt ?? invoice.issuedAt,
              tone: "success" as const,
            },
          ]
        : []),
      {
        label: invoice.lastVerifiedAt
          ? "Provider status verified"
          : "Awaiting provider sync",
        detail: invoice.lastVerifiedAt
          ? `PayPal Sandbox checked ${formatTime(invoice.lastVerifiedAt)}.`
          : "This is a local draft. No provider call has been made.",
        at: invoice.lastVerifiedAt ?? invoice.issuedAt,
        tone: invoice.status === "overdue" ? ("danger" as const) : ("neutral" as const),
      },
    ];
    return events.sort((a, b) => a.at.localeCompare(b.at));
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="eyebrow">Money</p>
            <Badge tone="yellow" className="!py-0.5 !text-[9.5px]">
              Demo data · Sandbox
            </Badge>
          </div>
          <h2 className="mt-1.5 text-[clamp(1.8rem,2.8vw,2.3rem)] font-semibold leading-tight tracking-[-0.035em]">
            Payments
          </h2>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-muted">
            Every balance is derived from the invoice record and the last PayPal
            Sandbox check. Nothing here moves money.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="md"
            onClick={sync}
            disabled={syncing}
          >
            <RefreshCw size={14} className={cn(syncing && "animate-spin")} />
            {syncing ? "Checking…" : "Recheck PayPal"}
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() =>
              router.push(
                `/app/copilot?prompt=${encodeURIComponent("How much is still unpaid across all projects?")}`,
              )
            }
          >
            <Sparkles size={14} /> Ask about money
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          {
            label: "Invoiced",
            value: formatMoney(invoiced),
            hint: "Drafts excluded",
            icon: ReceiptText,
          },
          {
            label: "Collected",
            value: formatMoney(collected),
            hint: "Provider verified",
            icon: Check,
          },
          {
            label: "Outstanding",
            value: formatMoney(outstanding),
            hint: `${invoices.filter(isOpen).length} open invoices`,
            icon: Wallet,
            accent: true,
          },
          {
            label: "Overdue",
            value: formatMoney(overdue),
            hint: overdue ? "Needs a follow-up" : "Nothing overdue",
            icon: Clock3,
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

      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ece8e0] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#eef4ee] text-success">
              <ShieldCheck size={13} />
            </span>
            <div>
              <p className="text-[12px] font-semibold">PayPal Sandbox reconciliation</p>
              <p className="text-[10px] text-muted">
                Last checked {lastChecked ? formatTime(lastChecked) : "—"} · no
                cached values used
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-3 text-[9.5px] text-muted sm:flex">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-success" /> Collected
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-orange" /> Outstanding
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-danger" /> Overdue
              </span>
            </div>
            <Badge tone="success" dot>
              Sandbox
            </Badge>
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[#ece8e0]">
            <span
              className="h-full bg-success"
              style={{ width: `${invoiced ? (collected / invoiced) * 100 : 0}%` }}
            />
            <span
              className="h-full bg-orange"
              style={{
                width: `${invoiced ? ((outstanding - overdue) / invoiced) * 100 : 0}%`,
              }}
            />
            <span
              className="h-full bg-danger"
              style={{ width: `${invoiced ? (overdue / invoiced) * 100 : 0}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted">
            <span>
              {invoiced
                ? `${Math.round((collected / invoiced) * 100)}% of invoiced value collected`
                : "No invoices yet"}
            </span>
            <span>
              {formatMoney(collected)} collected · {formatMoney(outstanding)} still
              open
            </span>
          </div>
        </div>
      </Panel>

      <div className="flex flex-col gap-3 rounded-2xl border border-[#e3dfd7] bg-white p-3 shadow-neu-sm sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-1">
          {filters.map((item) => {
            const count =
              item.id === "all"
                ? invoices.length
                : item.id === "open"
                  ? invoices.filter(isOpen).length
                  : invoices.filter((invoice) => invoice.status === item.id).length;
            return (
              <button
                key={item.id}
                onClick={() => setFilter(item.id)}
                className={cn(
                  "rounded-lg px-3 py-2 text-[12px] font-medium transition",
                  filter === item.id
                    ? "bg-ink text-canvas shadow-sm"
                    : "text-muted hover:bg-[#f6f3ed] hover:text-ink",
                )}
                aria-pressed={filter === item.id}
              >
                {item.label}
                <span className="ml-1.5 font-mono text-[9px] opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
        <label className="relative flex-1 sm:ml-auto sm:max-w-[260px]">
          <Search
            size={13}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search invoice or client"
            className="h-9 w-full rounded-lg border border-[#e2ded6] bg-[#f8f6f1] pl-8 pr-2 text-[12px] outline-none transition focus:border-[#c8c1b4] focus:bg-white"
            aria-label="Search invoices"
          />
        </label>
      </div>

      <Panel className="overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<CircleDollarSign size={18} />}
              title="No invoices in this view"
              description="Clear the search or switch filters. Drafts are not counted as invoiced."
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setFilter("all");
                    setQuery("");
                  }}
                >
                  Reset filters
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#ece8e0] bg-[#fbfaf7] text-[9.5px] uppercase tracking-[0.12em] text-muted">
                  <th className="px-5 py-2.5 font-medium">Invoice</th>
                  <th className="px-3 py-2.5 font-medium">Client</th>
                  <th className="px-3 py-2.5 font-medium">Issued</th>
                  <th className="px-3 py-2.5 font-medium">Due</th>
                  <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Last checked</th>
                  <th className="px-5 py-2.5 text-right font-medium">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0ece5]">
                {filtered.map(({ invoice, client, project, remaining }) => (
                  <tr
                    key={invoice.id}
                    className="group cursor-pointer transition hover:bg-[#fbfaf7]"
                    onClick={() => setDetailId(invoice.id)}
                  >
                    <td className="px-5 py-3">
                      <p className="font-mono text-[10.5px] font-medium">
                        {invoice.number}
                      </p>
                      <p className="mt-0.5 max-w-[180px] truncate text-[10px] text-muted">
                        {project.name}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar
                          name={client.name}
                          initials={client.initials}
                          hue={client.hue}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-[11.5px] font-medium">
                            {client.company}
                          </p>
                          <p className="truncate text-[9.5px] text-muted">
                            {client.name}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[10.5px] text-muted">
                      {formatDate(invoice.issuedAt, "d MMM")}
                    </td>
                    <td className="px-3 py-3 text-[10.5px] text-muted">
                      {formatDate(invoice.dueAt, "d MMM")}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <p className="tabular text-[11.5px] font-semibold">
                        {formatMoney(invoice.amount, invoice.currency)}
                      </p>
                      {invoice.amountPaid > 0 && invoice.amountPaid < invoice.amount ? (
                        <p className="text-[9px] text-muted">
                          {formatMoney(remaining, invoice.currency)} left
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <Badge
                        tone={statusTone(invoice.status)}
                        className="!py-0.5 !text-[8.5px]"
                        dot={invoice.status === "paid" || invoice.status === "overdue"}
                      >
                        {invoiceStatusLabel[invoice.status]}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-[10px] text-muted">
                      {invoice.lastVerifiedAt
                        ? `${formatDate(invoice.lastVerifiedAt, "d MMM")} · ${formatTime(invoice.lastVerifiedAt)}`
                        : "Not checked"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#e9e4db] bg-white px-2 text-[10px] font-medium text-muted transition group-hover:border-[#cfc8bb] group-hover:text-ink">
                        View <ArrowUpRight size={10} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Drawer
        open={Boolean(detail)}
        onClose={() => setDetailId(null)}
        title={detail ? `${detail.invoice.number} · ${detail.client.company}` : "Invoice"}
        subtitle={detail ? detail.project.name : undefined}
        footer={
          detail ? (
            <div className="flex flex-wrap items-center gap-2">
              {isOpen(detail.invoice) ? (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => draftReminder(detail.invoice)}
                >
                  <Mail size={12} /> Draft reminder
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyReference(detail.invoice.providerId)}
              >
                <Copy size={12} /> Copy reference
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  router.push(
                    `/app/copilot?prompt=${encodeURIComponent(
                      `Why is ${detail.invoice.number} ${detail.invoice.status.replace("_", " ")}?`,
                    )}`,
                  )
                }
              >
                <Sparkles size={12} /> Ask Visun
              </Button>
            </div>
          ) : null
        }
      >
        {detail ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 rounded-2xl border border-[#eae5dc] bg-white p-4">
              <div>
                <p className="eyebrow !text-[8.5px]">Amount due</p>
                <p className="tabular mt-1 text-[26px] font-semibold leading-none tracking-tight">
                  {formatMoney(detail.remaining, detail.invoice.currency)}
                </p>
                <p className="mt-1 text-[10.5px] text-muted">
                  of {formatMoney(detail.invoice.amount, detail.invoice.currency)}{" "}
                  · due {formatDate(detail.invoice.dueAt)}
                </p>
              </div>
              <div className="text-right">
                <Badge
                  tone={statusTone(detail.invoice.status)}
                  className="!py-0.5 !text-[9px]"
                  dot
                >
                  {invoiceStatusLabel[detail.invoice.status]}
                </Badge>
                <p className="mt-1.5 font-mono text-[8.5px] text-muted">
                  {detail.invoice.provider}
                </p>
              </div>
            </div>

            {detail.invoice.amountPaid > 0 && detail.remaining > 0 ? (
              <Progress
                value={(detail.invoice.amountPaid / detail.invoice.amount) * 100}
                label="Paid so far"
              />
            ) : null}

            <div className="rounded-xl border border-[#eae5dc] bg-white p-3.5">
              <p className="eyebrow !text-[8.5px]">Line item</p>
              <div className="mt-2 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11.5px] font-medium">{detail.invoice.note}</p>
                  <p className="mt-0.5 text-[10px] text-muted">
                    Linked milestone:{" "}
                    {milestones.find(
                      (milestone) =>
                        milestone.projectId === detail.invoice.projectId &&
                        milestone.value === detail.invoice.amount,
                    )?.title ?? "Not linked to a single milestone"}
                  </p>
                </div>
                <p className="tabular shrink-0 text-[12px] font-semibold">
                  {formatMoney(detail.invoice.amount, detail.invoice.currency)}
                </p>
              </div>
            </div>

            <dl className="space-y-2 rounded-xl border border-[#eae5dc] bg-[#fbfaf7] p-3.5 text-[10.5px]">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Invoice ID</dt>
                <dd className="font-mono text-[9.5px]">{detail.invoice.number}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Provider reference</dt>
                <dd className="font-mono text-[9.5px]">{detail.invoice.providerId}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Environment</dt>
                <dd className="font-medium">{detail.invoice.provider}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Last verified</dt>
                <dd className="font-medium">
                  {detail.invoice.lastVerifiedAt
                    ? formatDate(detail.invoice.lastVerifiedAt, "d MMM, h:mm a")
                    : "Not checked"}
                </dd>
              </div>
            </dl>

            <div>
              <p className="eyebrow !text-[8.5px]">Event timeline</p>
              <ol className="mt-2.5">
                {timelineFor(detail.invoice).map((event, index, list) => (
                  <li key={`${event.label}-${event.at}`} className="relative flex gap-3 pb-4 last:pb-0">
                    {index < list.length - 1 ? (
                      <span className="absolute left-[5px] top-3 h-full w-px bg-[#e8e4dc]" />
                    ) : null}
                    <span
                      className={cn(
                        "relative z-10 mt-1 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-canvas",
                        event.tone === "success"
                          ? "bg-success"
                          : event.tone === "danger"
                            ? "bg-danger"
                            : event.tone === "info"
                              ? "bg-orange"
                              : "bg-[#b9b3a8]",
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium">{event.label}</p>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
                        {event.detail}
                      </p>
                      <p className="mt-0.5 font-mono text-[8.5px] text-[#a19b91]">
                        {formatDate(event.at, "d MMM yyyy, h:mm a")}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <p className="rounded-xl bg-[#f8f6f1] px-3 py-2.5 text-[10px] leading-relaxed text-muted">
              Demo only. Payments are never captured here and funds are never held
              in escrow. A real integration would require explicit buyer
              authorization.
            </p>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
