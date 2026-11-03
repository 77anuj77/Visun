import type { AppState, ChatMessage, ProposedAction, Source, ToolCall } from "./types";
import { formatMoney } from "./utils";

export type AgentReply = Required<
  Pick<ChatMessage, "text" | "sources" | "tools">
> & {
  action?: ProposedAction;
};

const CHECKED_AT = "2026-11-03T14:12:00+05:30";

function source(
  kind: string,
  label: string,
  id: string,
  checkedAt = CHECKED_AT,
): Source {
  return { kind, label, id, checkedAt };
}

function tool(
  name: string,
  args: string,
  result: string,
  duration: string,
): ToolCall {
  return {
    id: `${name}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    args,
    status: "done",
    duration,
    result,
  };
}

function reminderAction(): ProposedAction {
  return {
    id: `act-${Math.random().toString(36).slice(2, 9)}`,
    kind: "email",
    title: "Overdue invoice reminder",
    recipient: "daniel@okaforlegal.com",
    subject: "Quick nudge — INV-1045 ($800)",
    body: "Hi Daniel,\n\nA small nudge on INV-1045 for the intake workflow milestone — $800, which was due on 1 November.\n\nThe PayPal Sandbox invoice is here: paypal.com/invoice/INV2-K7Y3-9P2M-4Q6A. Happy to resend it if helpful.\n\nThanks,\nAyush",
    amount: 800,
    currency: "USD",
    provider: "Gmail",
    status: "pending_approval",
    createdAt: new Date().toISOString(),
  };
}

export function buildAgentReply(prompt: string, state: AppState): AgentReply {
  const text = prompt.toLowerCase();
  const wantsScope =
    /scope|change|creep|rahul|out of scope|agreement|request/.test(text);
  const wantsPayment =
    /pay|owe|outstanding|unpaid|invoice|money|balance|collect|reminder|overdue/.test(
      text,
    );
  const wantsDeadline =
    /due|deadline|today|tomorrow|week|priority|calendar|schedule|next/.test(text);
  const wantsLeads = /lead|pipeline|prospect|follow.?up/.test(text);
  const wantsReport = /report|summary|client update|progress update/.test(text);
  const wantsEmail = /email|remind|send|draft|nudge/.test(text);
  const wantsProject =
    /project|status|progress|northwind|fjord|okafor|saffron|waypoint/.test(text);

  const tools: ToolCall[] = [];
  const sources: Source[] = [];

  if (wantsScope) {
    tools.push(
      tool(
        "detect_scope_changes",
        "project_id: p-northwind",
        "1 potential change · clauses nw-c4, nw-c5",
        "620ms",
      ),
    );
    sources.push(
      source(
        "Agreement clause",
        "nw-c5 · Payment processing is out of scope",
        "nw-c5",
      ),
      source("Telegram message", "Rahul Mehta · 2 Nov, 09:14", "msg-1", "2026-11-02T09:14:00+05:30"),
    );
  }

  if (wantsPayment) {
    tools.push(
      tool(
        "get_pending_payments",
        "workspace: paroha-studio",
        "3 open invoices · $3,200.00 USD",
        "410ms",
      ),
    );
    sources.push(
      source("Invoice", "INV-1044 · $1,800 · due 15 Nov", "inv-1044"),
      source("Invoice", "INV-1043 · $600 remaining", "inv-1043"),
      source("Invoice", "INV-1045 · $800 · overdue", "inv-1045"),
    );
  }

  if (wantsDeadline) {
    tools.push(
      tool(
        "get_deadlines",
        "date: 2026-11-03, timezone: Asia/Kolkata",
        "0 due today · 3 due this week",
        "280ms",
      ),
    );
    sources.push(
      source("Milestones", "5 projects · 17 milestones", "milestones"),
    );
  }

  if (wantsLeads) {
    tools.push(
      tool(
        "get_leads",
        "date: 2026-11-03, timezone: Asia/Kolkata",
        "2 received today · 5 active",
        "190ms",
      ),
    );
    sources.push(source("Leads", "Workspace lead records", "leads"));
  }

  if (wantsReport) {
    tools.push(
      tool(
        "get_report_inputs",
        "project_id: p-northwind, period: week-44",
        "4 milestones · 2 invoices · 3 activities",
        "530ms",
      ),
    );
    sources.push(
      source("Report inputs", "Northwind week 44", "rep-1"),
    );
  }

  // Combined query — the primary demo path.
  if (wantsScope && wantsPayment) {
    return {
      text: "One change needs your review on **Northwind**: Rahul asked for login and a payment page before the 14 November investor demo. Both are explicitly excluded by the signed agreement — clauses **nw-c4** and **nw-c5** cover accounts and checkout. My estimate is a **$950 amendment**, and it is only a proposal.\n\nOn money: **$3,200 is outstanding** across three invoices. Northwind is **$1,800**, due 15 November. Okafor has **$800 overdue** since 1 November, and Fjord has **$600 remaining**. PayPal Sandbox was verified today at 09:02 — no cached values are being used.",
      tools,
      sources,
    };
  }

  if (wantsScope) {
    const finding = state.findingReviews["sf-1"] ?? "potential";
    const scopeLine =
      finding === "accepted"
        ? "You accepted the Northwind scope finding. It is ready to turn into a change order."
        : finding === "dismissed"
          ? "The Northwind finding was dismissed, so I am not treating it as billable."
          : "The Northwind finding is still waiting for your review.";
    return {
      text: `Here is what moved on **Rahul's Northwind project**:\n\n• He asked for **login and a payment page** before the 14 November investor demo (Telegram, 2 November).\n• The signed agreement excludes **authentication** (nw-c4) and **checkout** (nw-c5), so this is a **potential change**, not a free addition.\n• My working estimate is **$950**. That is a proposal you can edit — not a quoted price.\n• A separate request to shorten the footer is **within scope** under the revision round.\n\n${scopeLine}`,
      tools,
      sources,
    };
  }

  if (wantsPayment) {
    if (wantsEmail || /reminder|nudge|send/.test(text)) {
      const action = reminderAction();
      return {
        text: "I prepared a short reminder for **INV-1045**, **$800**, which is 2 days overdue. The recipient is **daniel@okaforlegal.com**, and the draft includes the Sandbox invoice reference.\n\nNothing has been sent. Review it below and approve once — I will execute a single Gmail request and log the provider result.",
        tools: [
          ...tools,
          tool(
            "draft_payment_reminder",
            "invoice_id: inv-1045",
            "Draft ready · awaiting approval",
            "760ms",
          ),
        ],
        sources: [
          ...sources,
          source("Invoice", "INV-1045 · $800 · due 1 Nov", "inv-1045"),
        ],
        action,
      };
    }
    return {
      text: "**$3,200 is outstanding** across three invoices:\n\n• **Northwind — INV-1044:** $1,800, due 15 November. Sent, not yet paid.\n• **Okafor — INV-1045:** $800, **overdue** since 1 November.\n• **Fjord — INV-1043:** $600 remaining on a $1,200 invoice, due 10 November.\n\nCollected and verified so far: **$5,000**. Everything was reconciled against PayPal Sandbox today at 09:02. INV-1046 is still a draft and is not counted as outstanding.",
      tools,
      sources,
    };
  }

  if (wantsDeadline) {
    return {
      text: "**Nothing is due today.** Your next three deadlines are:\n\n• **Fri 6 Nov** — Northwind marketing site build (in progress, 64%).\n• **Fri 6 Nov** — Okafor billing integration (in progress, 74%).\n• **Sat 7 Nov** — Fjord homepage design (in progress, 38%).\n\nAfter that, Northwind launch QA lands on 12 November. I checked 17 stored milestones and did not include Google Calendar because it is not connected.",
      tools,
      sources,
    };
  }

  if (wantsLeads) {
    const todays = state.leads.filter((lead) =>
      lead.receivedAt.startsWith("2026-11-03"),
    );
    return {
      text: `You have **${todays.length} leads received today** and **${state.leads.length} active leads** in total.\n\n• **Nina Patel** — referral from Maya Chen, $3,600 potential. Next: send the scope questionnaire today at 4pm.\n• **Tom Alvarez** — website form, $5,200 potential. Next: follow up with two case studies tomorrow.\n\nQualified: Hana Kim (retainer, discovery call 4 Nov). Proposal out: Arjun Rao, expires 6 November. These are workspace records — no external CRM or LinkedIn source is connected.`,
      tools,
      sources,
    };
  }

  if (wantsReport) {
    return {
      text: "The **Northwind Week 44** report is ready in Reports: design system approved, marketing build at 64%, two pages in staging, and one open scope question. It was sent on 2 November.\n\nIf you want a fresh one, open **Reports → Generate report**. I will build it from stored milestones, invoices, and activity, then wait for approval before sending. I will not invent progress that is not in the records.",
      tools,
      sources,
    };
  }

  if (wantsProject) {
    return {
      text: "Across your **5 projects**, three are active and one is in review:\n\n• **Northwind** — 64%, at risk. Marketing build due 6 Nov; one open scope change. $1,800 outstanding.\n• **Fjord** — 38%, on track. Homepage design due 7 Nov; one in-scope hero question.\n• **Okafor** — 74%, on track. Billing integration due 6 Nov; $800 overdue.\n• **Studio Saffron** — 26%, direction approved; portfolio design due 10 Nov.\n• **Waypoint** — delivered and paid in full.\n\nI can open any project and show the source records behind these numbers.",
      tools,
      sources: [
        source("Projects", "5 active records", "projects"),
        source("Milestones", "17 milestones", "milestones"),
        source("Invoices", "PayPal Sandbox · checked 09:02", "invoices"),
      ],
    };
  }

  return {
    text: "I can work from the records in this demo workspace — projects, milestones, agreements, Telegram messages, invoices, leads, reports, and activity.\n\nTry one of these:\n\n• **“What is due today?”** — stored deadlines only.\n• **“How much is unpaid?”** — PayPal Sandbox reconciliation.\n• **“What changed on Rahul's project?”** — agreement vs. message evidence.\n• **“Draft a reminder for the overdue invoice.”** — produces a preview; nothing sends until you approve.\n\nI will always show what I checked, and I will say when a source is not connected.",
    tools: [],
    sources: [],
  };
}
