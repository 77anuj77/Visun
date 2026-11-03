"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, PanelLeftClose, PanelLeftOpen, ShieldCheck, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Avatar } from "@/components/ui";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { allNav, overviewNav, settingsNav } from "./nav";

function useBadges() {
  const { state } = useAppStore();
  const scope = Object.values(state.findingReviews).filter(
    (value) => value === "potential" || value === "reviewing",
  ).length;
  const payments = 1;
  const approvals = state.conversations.reduce(
    (total, conversation) =>
      total +
      conversation.messages.filter(
        (message) => message.action?.status === "pending_approval",
      ).length,
    0,
  );
  return { scope, payments, approvals };
}

export function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();
  const badges = useBadges();

  const isActive = (href: string) =>
    href === "/app" ? pathname === "/app" : pathname.startsWith(href);

  const badgeFor = (badge?: "scope" | "payments" | "approvals") => {
    if (!badge) return 0;
    return badges[badge];
  };

  const navSection = (items: typeof overviewNav, label: string) => (
    <div className="px-3">
      <p
        className={cn(
          "mb-2 px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#858078]",
          collapsed && "sr-only",
        )}
      >
        {label}
      </p>
      <ul className="flex flex-col gap-1">
        {items.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          const count = badgeFor(item.badge);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onCloseMobile}
                title={collapsed ? item.label : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex min-h-[42px] items-center gap-3 rounded-xl px-2.5 py-2 text-[13.5px] font-medium transition-all duration-200",
                  active
                    ? "bg-white text-ink shadow-[3px_3px_8px_rgba(35,31,24,0.11),-3px_-3px_8px_rgba(255,255,255,0.8)]"
                    : "text-[#59564f] hover:bg-white/55 hover:text-ink",
                  collapsed && "justify-center px-0",
                )}
              >
                {active ? (
                  <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-orange" />
                ) : null}
                <Icon
                  size={17}
                  strokeWidth={active ? 2.2 : 1.8}
                  className={cn(
                    "shrink-0 transition-colors",
                    active ? "text-orange" : "text-[#77726a] group-hover:text-ink",
                  )}
                />
                <span className={cn("flex-1 truncate", collapsed && "hidden")}>
                  {item.label}
                </span>
                {!collapsed && count > 0 ? (
                  <span
                    className={cn(
                      "tabular flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold",
                      item.badge === "payments"
                        ? "bg-[#fbe9e7] text-[#8f2f28]"
                        : "bg-yellow text-ink",
                    )}
                  >
                    {count}
                  </span>
                ) : null}
                {collapsed && count > 0 ? (
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-orange" />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px] transition-opacity lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onCloseMobile}
        aria-hidden="true"
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[#dcd7cd] bg-stone transition-[width,transform] duration-300",
          collapsed ? "lg:w-[78px]" : "lg:w-[248px]",
          "w-[270px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
        aria-label="Workspace navigation"
      >
        <div
          className={cn(
            "flex h-[76px] shrink-0 items-center border-b border-[#d7d1c6] px-4",
            collapsed ? "lg:justify-center lg:px-0" : "justify-between",
          )}
        >
          <Logo href="/app" withWordmark={!collapsed} />
          <button
            onClick={onCloseMobile}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-white/60 hover:text-ink lg:hidden"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <div className={cn("px-3 pt-3", collapsed && "lg:px-2")}>
          <button
            className={cn(
              "flex w-full items-center gap-2.5 rounded-xl border border-[#d7d1c6] bg-[#f1eee8] px-2.5 py-2 text-left transition hover:bg-[#f5f2ec]",
              collapsed && "justify-center border-0 bg-transparent px-0",
            )}
            title={collapsed ? "Paroha Studio — demo workspace" : undefined}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ink font-mono text-[10px] font-medium text-canvas">
              PS
            </span>
            {!collapsed ? (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold leading-tight">
                    Paroha Studio
                  </span>
                  <span className="block text-[10.5px] text-muted">
                    Solo workspace
                  </span>
                </span>
                <ChevronDown size={14} className="text-muted" />
              </>
            ) : null}
          </button>
        </div>

        <nav className="mt-4 flex-1 overflow-y-auto pb-4" aria-label="Main">
          {navSection(overviewNav, "Workspace")}
          <div className="my-3 h-px bg-[#d7d1c6]/80" />
          {navSection(settingsNav, "Settings")}
        </nav>

        <div className="shrink-0 border-t border-[#d7d1c6] p-3">
          {!collapsed ? (
            <div className="mb-3 rounded-xl border border-[#d5cfc4] bg-[#f2efe9] p-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-[#6b5a15]">
                <ShieldCheck size={14} className="text-[#8a6d00]" />
                Sandbox demo
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-[#77726a]">
                Paypal, Gmail and Telegram are simulated. No money moves and no
                email leaves this browser.
              </p>
            </div>
          ) : null}
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-1.5 py-1",
              collapsed && "justify-center",
            )}
          >
            <Avatar name="Ayush Paroha" initials="AP" hue="orange" />
            {!collapsed ? (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold leading-tight">
                  Ayush Paroha
                </p>
                <p className="truncate text-[10.5px] text-muted">Owner</p>
              </div>
            ) : null}
            {!collapsed ? (
              <Link
                href="/app/settings/preferences"
                className="rounded-md p-1 text-muted transition hover:bg-white/60 hover:text-ink"
                aria-label="Preferences"
              >
                <ChevronDown size={14} className="-rotate-90" />
              </Link>
            ) : null}
          </div>
        </div>

        <button
          onClick={onToggleCollapse}
          className="absolute -right-3 top-[92px] hidden h-7 w-7 items-center justify-center rounded-full border border-[#d3cdc2] bg-canvas text-muted shadow-neu-sm transition hover:text-ink lg:flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={13} /> : <PanelLeftClose size={13} />}
        </button>
      </aside>
    </>
  );
}
