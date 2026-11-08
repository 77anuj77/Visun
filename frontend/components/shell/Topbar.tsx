"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Bell,
  ChevronRight,
  CircleDollarSign,
  Command,
  ExternalLink,
  Inbox,
  Menu,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Avatar, Badge } from "@/components/ui";
import { ClerkSignOut } from "@/components/auth/AuthActions";
import { clerkEnabled } from "@/lib/auth-config";
import { useAppStore } from "@/lib/store";
import { cn, formatTime } from "@/lib/utils";
import { pageMeta } from "./nav";

const iconForType = {
  scope: Inbox,
  payment: CircleDollarSign,
  email: Sparkles,
  report: Sparkles,
  tool: Sparkles,
  approval: ShieldCheck,
  integration: CircleDollarSign,
  ingest: Inbox,
  system: Sparkles,
};

export function Topbar({
  onOpenPalette,
  onOpenMobileNav,
}: {
  onOpenPalette: () => void;
  onOpenMobileNav: () => void;
}) {
  const pathname = usePathname();
  const meta = pageMeta(pathname);
  const { state, connection, providerMode, authMode, profile, isDemo, refresh } =
    useAppStore();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [read, setRead] = useState(false);
  const initials =
    profile.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "V";

  const pending = state.conversations.reduce(
    (total, conversation) =>
      total +
      conversation.messages.filter(
        (message) => message.action?.status === "pending_approval",
      ).length,
    0,
  );
  const notifications = state.activities.slice(0, 4);
  const unread = read ? 0 : Math.min(4, notifications.length) + (pending > 0 ? 1 : 0);

  return (
    <header className="sticky top-0 z-30 flex h-[76px] items-center border-b border-[#dfdbd3] bg-canvas/88 backdrop-blur-xl">
      <div className="flex h-full w-full items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          onClick={onOpenMobileNav}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#ddd8cf] bg-canvas text-ink shadow-neu-sm lg:hidden"
          aria-label="Open navigation"
        >
          <Menu size={17} />
        </button>

        <div className="min-w-0 flex-1">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className="hidden sm:inline">{meta.parent}</span>
            <ChevronRight size={11} className="hidden sm:inline" />
            <span className="text-ink">{meta.label}</span>
          </nav>
          <h1 className="truncate text-[15px] font-semibold tracking-tight sm:text-base">
            {meta.label}
          </h1>
        </div>

        <button
          onClick={onOpenPalette}
          className="group hidden h-10 items-center gap-2.5 rounded-full border border-[#e3dfd6] bg-white/70 px-3.5 text-[13px] text-muted shadow-[0_1px_2px_rgba(35,31,24,0.04)] backdrop-blur transition duration-200 hover:border-[#d2ccc0] hover:bg-white hover:text-ink hover:shadow-[0_8px_20px_-12px_rgba(35,31,24,0.45)] md:flex md:w-[248px] lg:w-[320px]"
          aria-label="Open command palette"
        >
          <Search
            size={15}
            className="shrink-0 text-[#8b867d] transition-colors duration-200 group-hover:text-orange"
          />
          <span className="flex-1 truncate text-left">Search or jump to…</span>
          <kbd className="flex shrink-0 items-center gap-1 rounded-full border border-[#e6e2d9] bg-[#f7f5f0] px-2 py-[3px] font-mono text-[10px] leading-none text-[#8b867d] transition-colors duration-200 group-hover:border-[#ded8cc] group-hover:text-ink">
            <Command size={9} />K
          </kbd>
        </button>

        <button
          onClick={onOpenPalette}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e3dfd6] bg-white/70 text-[#6f6a62] shadow-[0_1px_2px_rgba(35,31,24,0.04)] backdrop-blur transition duration-200 active:scale-95 hover:border-[#d2ccc0] hover:text-orange md:hidden"
          aria-label="Search"
        >
          <Search size={17} />
        </button>

        <button
          onClick={() => void refresh()}
          className="hidden rounded-full sm:inline-flex"
          title="Backend connection status. Click to refresh."
          aria-label={
            connection === "online"
              ? `Backend online, ${providerMode} provider mode, ${authMode} auth. Refresh workspace`
              : connection === "checking"
                ? "Checking backend connection"
                : "Backend offline, using local demo data. Retry connection"
          }
        >
          <Badge
            tone={
              connection === "online"
                ? providerMode === "real"
                  ? "success"
                  : "yellow"
                : connection === "checking"
                  ? "neutral"
                  : "danger"
            }
            dot
            className="h-8 gap-1.5 px-2.5 text-[10.5px]"
          >
            <RefreshCw
              size={11}
              className={connection === "checking" ? "animate-spin" : undefined}
            />
            {connection === "online"
              ? providerMode === "real"
                ? "API · live"
                : "API · sandbox"
              : connection === "checking"
                ? "Checking API"
                : "Offline · local"}
          </Badge>
        </button>

        {isDemo ? (
          <span className="hidden lg:block">
            <Badge tone="yellow" className="h-8 gap-1.5 px-2.5 text-[10.5px]">
              <ShieldCheck size={11} />
              Sandbox demo
            </Badge>
          </span>
        ) : null}

        <div className="relative">
          <button
            onClick={() => {
              setNotificationsOpen((open) => !open);
              setProfileOpen(false);
              setRead(true);
            }}
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-muted transition hover:border-[#ddd8cf] hover:bg-white hover:text-ink"
            aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
            aria-expanded={notificationsOpen}
          >
            <Bell size={18} />
            {unread > 0 ? (
              <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange px-1 text-[9px] font-bold text-ink">
                {unread}
              </span>
            ) : null}
          </button>
          {notificationsOpen ? (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setNotificationsOpen(false)}
                aria-hidden="true"
              />
              <div className="absolute right-0 top-12 z-50 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-[#dcd7cd] bg-white shadow-[0_30px_70px_-25px_rgba(0,0,0,0.45)]">
                <div className="flex items-center justify-between border-b border-[#e6e2da] px-4 py-3">
                  <p className="text-[13px] font-semibold">Notifications</p>
                  <span className="font-mono text-[10px] text-muted">
                    {notifications.length} recent
                  </span>
                </div>
                <ul className="max-h-[360px] divide-y divide-[#efebe3] overflow-y-auto">
                  {notifications.map((item) => {
                    const Icon = iconForType[item.type] ?? Sparkles;
                    return (
                      <li key={item.id}>
                        <Link
                          href="/app/activity"
                          onClick={() => setNotificationsOpen(false)}
                          className="flex gap-3 px-4 py-3 transition hover:bg-[#faf9f6]"
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                              item.status === "failed"
                                ? "bg-[#fbe9e7] text-danger"
                                : item.status === "pending"
                                  ? "bg-[#fff3cf] text-warning"
                                  : "bg-[#eef1ee] text-success",
                            )}
                          >
                            <Icon size={14} />
                          </span>
                          <span className="min-w-0">
                            <span className="flex items-baseline justify-between gap-3">
                              <span className="truncate text-[12.5px] font-semibold">
                                {item.title}
                              </span>
                              <span className="shrink-0 font-mono text-[9px] text-muted">
                                {formatTime(item.at)}
                              </span>
                            </span>
                            <span className="mt-0.5 line-clamp-2 block text-[11.5px] leading-relaxed text-muted">
                              {item.detail}
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                <Link
                  href="/app/activity"
                  onClick={() => setNotificationsOpen(false)}
                  className="flex items-center justify-center gap-1.5 border-t border-[#e6e2da] px-4 py-3 text-[12px] font-medium text-ink transition hover:bg-[#faf9f6]"
                >
                  Open activity <ExternalLink size={12} />
                </Link>
              </div>
            </>
          ) : null}
        </div>

        <div className="relative">
          <button
            onClick={() => {
              setProfileOpen((open) => !open);
              setNotificationsOpen(false);
            }}
            className="flex items-center gap-2 rounded-xl p-0.5 transition hover:bg-white"
            aria-label="Account menu"
            aria-expanded={profileOpen}
          >
            <Avatar name={profile.name} initials={initials} hue="orange" />
          </button>
          {profileOpen ? (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setProfileOpen(false)}
                aria-hidden="true"
              />
              <div className="absolute right-0 top-12 z-50 w-[260px] overflow-hidden rounded-2xl border border-[#dcd7cd] bg-white p-1.5 shadow-[0_30px_70px_-25px_rgba(0,0,0,0.45)]">
                <div className="flex items-center gap-3 rounded-xl bg-[#f8f7f3] px-3 py-3">
                  <Avatar name={profile.name} initials={initials} hue="orange" />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold">{profile.name}</p>
                    <p className="truncate text-[11px] text-muted">{profile.email}</p>
                    <p className="truncate text-[10px] text-[#918c83]">{profile.workspace}</p>
                  </div>
                </div>
                <div className="mt-1 flex flex-col">
                  <Link
                    href="/app/settings/preferences"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[12.5px] text-[#4c4943] transition hover:bg-[#f6f4ef] hover:text-ink"
                  >
                    <UserRound size={14} /> Profile & preferences
                  </Link>
                  <Link
                    href="/app/settings/integrations"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[12.5px] text-[#4c4943] transition hover:bg-[#f6f4ef] hover:text-ink"
                  >
                    <Settings2 size={14} /> Integrations
                  </Link>
                </div>
                <div className="my-1 h-px bg-[#eae6de]" />
                {clerkEnabled && isDemo ? (
                  <Link
                    href="/app?demo=0"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[12.5px] font-medium text-ink transition hover:bg-[#f6f4ef]"
                  >
                    <UserRound size={14} /> Sign in to your workspace
                  </Link>
                ) : null}
                {clerkEnabled && !isDemo ? (
                  <ClerkSignOut className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[12.5px] text-[#4c4943] transition hover:bg-[#f6f4ef] hover:text-ink" />
                ) : null}
                <Link
                  href="/"
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 text-[12px] text-muted transition hover:bg-[#f6f4ef] hover:text-ink"
                >
                  View marketing site <ExternalLink size={12} />
                </Link>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
