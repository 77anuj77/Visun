import { format, formatDistanceToNowStrict, isAfter, isBefore, parseISO } from "date-fns";
import type { InvoiceStatus, LeadStage, ReviewState } from "./types";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function formatMoney(
  amount: number,
  currency = "USD",
  options: { compact?: boolean; decimals?: boolean } = {},
) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: options.decimals ? 2 : 0,
    notation: options.compact ? "compact" : "standard",
  }).format(amount);
}

export function formatDate(
  iso: string,
  pattern = "d MMM yyyy",
  timeZone = "Asia/Kolkata",
) {
  try {
    return format(parseISO(iso), pattern);
  } catch {
    return iso;
  }
}

export function formatTime(iso: string, timeZone = "Asia/Kolkata") {
  return formatDate(iso, "h:mm a");
}

export function formatDay(iso: string) {
  return formatDate(iso, "EEE d MMM");
}

export function relativeTime(iso: string) {
  try {
    return `${formatDistanceToNowStrict(parseISO(iso), { addSuffix: true })}`;
  } catch {
    return iso;
  }
}

export function relativeTo(iso: string, base: Date) {
  try {
    return formatDistanceToNowStrict(parseISO(iso), {
      addSuffix: true,
      unit: "day",
    });
  } catch {
    return iso;
  }
}

export function daysUntil(iso: string, from = new Date("2026-11-03T09:00:00+05:30")) {
  const target = parseISO(iso);
  const diff = target.getTime() - from.getTime();
  return Math.ceil(diff / 86400000);
}

export function isOverdue(iso: string, from = new Date("2026-11-03T09:00:00+05:30")) {
  return isBefore(parseISO(iso), from);
}

export function isUpcoming(iso: string, from = new Date("2026-11-03T09:00:00+05:30")) {
  return isAfter(parseISO(iso), from);
}

export function initialsOf(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const invoiceStatusLabel: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  partially_paid: "Partially paid",
  paid: "Paid · verified",
  overdue: "Overdue",
  failed: "Failed",
  refunded: "Refunded",
  unsynced: "Unknown",
};

export const reviewLabel: Record<ReviewState, string> = {
  potential: "Potential change",
  reviewing: "Needs review",
  accepted: "Accepted",
  dismissed: "Dismissed",
};

export const leadStageLabel: Record<LeadStage, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal: "Proposal",
  won: "Won",
};

export const leadStageOrder: LeadStage[] = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "won",
];

export function statusTone(status: InvoiceStatus | ReviewState | LeadStage | string) {
  switch (status) {
    case "paid":
    case "accepted":
    case "won":
    case "succeeded":
    case "success":
      return "success" as const;
    case "overdue":
    case "failed":
    case "blocked":
      return "danger" as const;
    case "draft":
    case "potential":
    case "sent":
    case "reviewing":
    case "new":
      return "warning" as const;
    case "partially_paid":
    case "qualified":
      return "info" as const;
    default:
      return "neutral" as const;
  }
}

export function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

export function pct(part: number, whole: number) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}
