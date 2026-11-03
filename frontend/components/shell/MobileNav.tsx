"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  CalendarDays,
  ChevronRight,
  FileText,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  Plug,
  Settings2,
  Sparkles,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";
import { allNav } from "./nav";

const primary = [
  { href: "/app", label: "Today", icon: LayoutDashboard },
  { href: "/app/projects", label: "Projects", icon: FolderKanban },
  { href: "/app/copilot", label: "Ask", icon: Sparkles, primary: true },
  { href: "/app/payments", label: "Pay", icon: Wallet },
];

export function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const active = (href: string) =>
    href === "/app" ? pathname === "/app" : pathname.startsWith(href);

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#dcd7cd] bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
        aria-label="Mobile navigation"
      >
        <div className="grid h-[68px] grid-cols-5 items-center px-1">
          {primary.map((item) => {
            const Icon = item.icon;
            const isActive = active(item.href);
            if (item.primary) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative flex h-full flex-col items-center justify-center"
                  aria-label="Ask Visun"
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="absolute -top-5 flex h-14 w-14 items-center justify-center rounded-full border-4 border-canvas bg-orange text-ink shadow-[0_10px_24px_-8px_rgba(255,90,0,0.7)]">
                    <Icon size={21} strokeWidth={2} />
                  </span>
                  <span className="mt-7 text-[9.5px] font-semibold tracking-wide">
                    {item.label}
                  </span>
                </Link>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1.5 text-[9.5px] font-medium",
                  isActive ? "text-ink" : "text-[#817c73]",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon size={19} strokeWidth={isActive ? 2.2 : 1.8} />
                {item.label}
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex h-full flex-col items-center justify-center gap-1.5 text-[9.5px] font-medium text-[#817c73]"
            aria-label="More navigation"
          >
            <span className="flex gap-0.5">
              <span className="h-1 w-1 rounded-full bg-current" />
              <span className="h-1 w-1 rounded-full bg-current" />
              <span className="h-1 w-1 rounded-full bg-current" />
            </span>
            More
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {moreOpen ? (
          <motion.div
            className="fixed inset-0 z-[80] lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
              onClick={() => setMoreOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="All destinations"
              className="absolute inset-x-0 bottom-0 max-h-[86vh] overflow-y-auto rounded-t-[28px] border-t border-[#dcd7cd] bg-canvas p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
              initial={{ y: 60, opacity: 0.7 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="mb-4 flex items-center justify-between">
                <Logo href="/app" />
                <button
                  onClick={() => setMoreOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ddd8cf] bg-white text-muted"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {allNav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl border border-[#e0dbd2] bg-white px-3 py-3 text-[12.5px] font-medium"
                    >
                      <Icon size={16} className="text-orange" />
                      {item.label}
                      <ChevronRight size={13} className="ml-auto text-muted" />
                    </Link>
                  );
                })}
              </div>
              <div className="mt-4 rounded-xl border border-[#e6dfae] bg-yellow/60 p-3 text-[11px] leading-relaxed text-[#6d5a13]">
                <strong>Sandbox demo.</strong> Data is seeded and provider actions
                are simulated. Nothing leaves this browser.
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
