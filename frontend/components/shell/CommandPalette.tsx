"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpRight,
  Command,
  CornerDownLeft,
  FileText,
  Inbox,
  LayoutDashboard,
  MailPlus,
  RotateCcw,
  Search,
  Sparkles,
  Wallet,
  Waves,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { allNav } from "./nav";
import { useToast } from "@/components/ui";

type CommandItem = {
  id: string;
  group: "Navigate" | "Ask Visun" | "Workspace";
  label: string;
  hint: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  run: () => void;
};

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { push } = useToast();
  const { updatePreferences, resetDemo } = useAppStore();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setCursor(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = original;
    };
  }, [open]);

  const commands = useMemo<CommandItem[]>(() => {
    const navCommands: CommandItem[] = allNav.map((item) => ({
      id: `nav-${item.href}`,
      group: "Navigate",
      label: item.label,
      hint: item.description,
      icon: item.icon,
      run: () => {
        router.push(item.href);
        onClose();
      },
    }));

    const ask = (prompt: string) => {
      router.push(`/app/copilot?prompt=${encodeURIComponent(prompt)}`);
      onClose();
    };

    return [
      ...navCommands,
      {
        id: "ask-deadlines",
        group: "Ask Visun",
        label: "What is due this week?",
        hint: "Only stored milestones, with sources",
        icon: Sparkles,
        run: () => ask("What is due this week?"),
      },
      {
        id: "ask-scope",
        group: "Ask Visun",
        label: "What changed on Rahul's project?",
        hint: "Agreement vs. Telegram evidence",
        icon: Sparkles,
        run: () => ask("What changed on Rahul's project?"),
      },
      {
        id: "ask-payments",
        group: "Ask Visun",
        label: "How much is still unpaid?",
        hint: "Reconciled PayPal Sandbox invoices",
        icon: Wallet,
        run: () => ask("How much is still unpaid?"),
      },
      {
        id: "ask-reminder",
        group: "Ask Visun",
        label: "Draft the overdue invoice reminder",
        hint: "Creates a preview — sends nothing",
        icon: MailPlus,
        run: () => ask("Draft a reminder for the overdue invoice."),
      },
      {
        id: "generate-report",
        group: "Workspace",
        label: "Generate a progress report",
        hint: "Grounded in milestones and payments",
        icon: FileText,
        run: () => {
          router.push("/app/reports?generate=1");
          onClose();
        },
      },
      {
        id: "open-inbox",
        group: "Workspace",
        label: "Review scope inbox",
        hint: "Review scope findings",
        icon: Inbox,
        run: () => {
          router.push("/app/inbox");
          onClose();
        },
      },
      {
        id: "reduced-motion",
        group: "Workspace",
        label: "Toggle reduced motion",
        hint: "Applies instantly in this workspace",
        icon: Waves,
        run: () => {
          updatePreferences({ reducedMotion: true });
          push({
            tone: "info",
            title: "Reduced motion noted",
            detail:
              "The demo respects your OS-level reduced-motion preference. This workspace toggle is stored with your demo settings.",
          });
          onClose();
        },
      },
      {
        id: "reset-demo",
        group: "Workspace",
        label: "Reset demo workspace",
        hint: "Restore the seeded project data",
        icon: RotateCcw,
        run: () => {
          resetDemo();
          push({
            tone: "success",
            title: "Demo workspace restored",
            detail: "Seed projects, milestones, approvals, and chats are back.",
          });
          onClose();
          router.push("/app");
        },
      },
    ];
  }, [onClose, push, resetDemo, router, updatePreferences]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return commands;
    return commands.filter((command) =>
      `${command.label} ${command.hint} ${command.group}`
        .toLowerCase()
        .includes(term),
    );
  }, [commands, query]);

  useEffect(() => {
    setCursor((current) => Math.min(current, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  const grouped = useMemo(() => {
    const order: CommandItem["group"][] = ["Ask Visun", "Navigate", "Workspace"];
    return order
      .map((group) => ({
        group,
        items: filtered.filter((item) => item.group === group),
      }))
      .filter((section) => section.items.length > 0);
  }, [filtered]);

  const flat = grouped.flatMap((section) => section.items);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setCursor((current) => (current + 1) % Math.max(1, flat.length));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setCursor(
          (current) => (current - 1 + Math.max(1, flat.length)) % Math.max(1, flat.length),
        );
      } else if (event.key === "Enter") {
        const item = flat[cursor];
        if (item) {
          event.preventDefault();
          item.run();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [cursor, flat, onClose, open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh] sm:pt-[16vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div
            className="absolute inset-0 bg-ink/45 backdrop-blur-[3px]"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="relative z-10 w-full max-w-[600px] overflow-hidden rounded-[24px] border border-[#ddd8ce] bg-white/95 shadow-[0_50px_120px_-40px_rgba(20,18,14,0.6)] ring-1 ring-white/70 backdrop-blur-xl"
            initial={{ opacity: 0, y: -12, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center gap-3 border-b border-[#eeeae2] px-4 transition-colors duration-200 focus-within:border-[#f0c9ae] focus-within:bg-[#fffdfa] sm:px-5">
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors duration-200",
                  query.trim()
                    ? "border-[#f3c6ad] bg-[#ffe9dc] text-orange"
                    : "border-[#e8e4dc] bg-[#faf9f6] text-[#8b867d]",
                )}
                aria-hidden="true"
              >
                <Search size={16} />
              </span>
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search pages or ask Visun…"
                className="h-16 min-w-0 flex-1 bg-transparent text-[15px] text-ink caret-orange placeholder:text-[#a09a90]"
                style={{ outline: "none" }}
                aria-label="Command search"
                autoComplete="off"
                spellCheck={false}
              />
              <kbd className="hidden rounded-full border border-[#e6e2d9] bg-[#f7f5f0] px-2.5 py-1 font-mono text-[9.5px] leading-none tracking-[0.08em] text-[#8b867d] sm:block">
                ESC
              </kbd>
            </div>

            <div className="max-h-[min(52vh,420px)] overflow-y-auto p-2">
              {grouped.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm font-medium">No matches for “{query}”</p>
                  <p className="mt-1 text-[12px] text-muted">
                    Try “payments”, “scope”, or “report”.
                  </p>
                </div>
              ) : (
                grouped.map((section) => (
                  <div key={section.group} className="mb-1">
                    <p className="px-2.5 pb-1.5 pt-3 font-mono text-[9px] uppercase tracking-[0.16em] text-[#918c83]">
                      {section.group}
                    </p>
                    {section.items.map((item) => {
                      const index = flat.findIndex((entry) => entry.id === item.id);
                      const Icon = item.icon;
                      const selected = index === cursor;
                      return (
                        <button
                          key={item.id}
                          onMouseEnter={() => setCursor(index)}
                          onClick={item.run}
                          className={cn(
                            "group flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition duration-150",
                            selected
                              ? "bg-[#f7f4ee] shadow-[inset_0_0_0_1px_#e9e3d7]"
                              : "hover:bg-[#faf8f4]",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                              selected
                                ? "border-[#f3c6ad] bg-[#ffe9dc] text-orange"
                                : "border-[#e5e0d7] bg-white text-[#6f6a62]",
                            )}
                          >
                            <Icon size={15} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                "block truncate text-[13px] font-medium transition-colors duration-150",
                                selected ? "text-ink" : "text-[#2f2d29]",
                              )}
                            >
                              {item.label}
                            </span>
                            <span className="block truncate text-[11px] text-muted">
                              {item.hint}
                            </span>
                          </span>
                          {selected ? (
                            <CornerDownLeft size={13} className="shrink-0 text-muted" />
                          ) : (
                            <ArrowUpRight size={13} className="shrink-0 text-transparent" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[#eeeae2] bg-[#faf9f6] px-4 py-2.5 text-[10.5px] text-muted sm:px-5">
              <span className="flex items-center gap-1.5 truncate">
                <span className="hidden items-center gap-1.5 sm:flex">
                  <Command size={11} /> K to open
                </span>
                <span className="sm:hidden">
                  {filtered.length} {filtered.length === 1 ? "result" : "results"}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="hidden sm:inline">↑↓ navigate</span>
                <span className="hidden sm:inline">↵ open</span>
                <span className="sm:hidden">Esc to close</span>
              </span>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
