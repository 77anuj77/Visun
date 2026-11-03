import {
  Activity,
  CalendarDays,
  FileText,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  Plug,
  Settings2,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  description: string;
  badge?: "scope" | "payments" | "approvals";
};

export const overviewNav: NavItem[] = [
  {
    href: "/app",
    label: "Today",
    icon: LayoutDashboard,
    description: "Your day, money, and signals",
  },
  {
    href: "/app/copilot",
    label: "Copilot",
    shortLabel: "Ask",
    icon: Sparkles,
    description: "Voice and text with full evidence",
    badge: "approvals",
  },
  {
    href: "/app/projects",
    label: "Projects",
    icon: FolderKanban,
    description: "Scope, milestones, and client work",
  },
  {
    href: "/app/inbox",
    label: "Scope Inbox",
    shortLabel: "Inbox",
    icon: Inbox,
    description: "Client messages and candidate changes",
    badge: "scope",
  },
  {
    href: "/app/payments",
    label: "Payments",
    icon: Wallet,
    description: "Invoices and verified PayPal state",
    badge: "payments",
  },
  {
    href: "/app/calendar",
    label: "Calendar",
    icon: CalendarDays,
    description: "Deadlines and connected events",
  },
  {
    href: "/app/leads",
    label: "Leads",
    icon: Users,
    description: "Pipeline and today's inquiries",
  },
  {
    href: "/app/reports",
    label: "Reports",
    icon: FileText,
    description: "Drafts, previews, and delivery",
  },
  {
    href: "/app/activity",
    label: "Activity",
    icon: Activity,
    description: "Every action and source access",
  },
];

export const settingsNav: NavItem[] = [
  {
    href: "/app/settings/integrations",
    label: "Integrations",
    icon: Plug,
    description: "Connected accounts and scopes",
  },
  {
    href: "/app/settings/preferences",
    label: "Preferences",
    icon: Settings2,
    description: "Voice, retention, and motion",
  },
];

export const allNav = [...overviewNav, ...settingsNav];

export function pageMeta(pathname: string) {
  if (pathname.startsWith("/app/projects/")) {
    return { label: "Project detail", parent: "Projects" };
  }
  const item = allNav.find((nav) => nav.href === pathname);
  if (item) return { label: item.label, parent: "Workspace" };
  return { label: "Workspace", parent: "Visun" };
}
