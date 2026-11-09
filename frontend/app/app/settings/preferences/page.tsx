"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Check,
  Clock3,
  Database,
  Download,
  Globe2,
  Keyboard,
  Mic,
  MonitorSmartphone,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
  Volume2,
} from "lucide-react";
import {
  Badge,
  Button,
  Modal,
  Panel,
  Switch,
  useToast,
} from "@/components/ui";
import { useAppStore } from "@/lib/store";
import type { Preferences } from "@/lib/types";
import { cn, formatDate, relativeTime } from "@/lib/utils";

const timezones = [
  "Asia/Kolkata",
  "UTC",
  "Asia/Singapore",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
];

const retentionOptions: Array<{
  value: Preferences["retention"];
  label: string;
  detail: string;
}> = [
  { value: "30", label: "30 days", detail: "Aggressive. Transcripts and message bodies are dropped monthly." },
  { value: "90", label: "90 days", detail: "Default. Enough history for a quarterly review." },
  { value: "365", label: "1 year", detail: "Keeps a full annual record of client conversations." },
  { value: "forever", label: "Until deleted", detail: "No automatic purge. You are responsible for retention." },
];

const shortcuts = [
  { keys: "⌘ K", label: "Open command palette" },
  { keys: "/", label: "Search from anywhere" },
  { keys: "Esc", label: "Close sheets and dialogs" },
  { keys: "Tab", label: "Move focus, never trapped" },
];

export default function PreferencesPage() {
  const {
    state,
    profile,
    hydrated,
    updatePreferences,
    resetDemo,
    addActivity,
  } = useAppStore();
  const { push } = useToast();
  const [resetOpen, setResetOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const preferences = state.preferences;

  useEffect(() => {
    document.documentElement.classList.toggle(
      "reduce-motion",
      preferences.reducedMotion,
    );
    return () => {
      document.documentElement.classList.remove("reduce-motion");
    };
  }, [preferences.reducedMotion]);

  const update = <K extends keyof Preferences>(
    key: K,
    value: Preferences[K],
  ) => {
    updatePreferences({ [key]: value } as Partial<Preferences>);
    setLastSaved(new Date().toISOString());
    if (key === "reducedMotion") {
      document.documentElement.classList.toggle("reduce-motion", Boolean(value));
    }
  };

  const recordCount = useMemo(
    () =>
      state.activities.length +
      state.conversations.length +
      state.leads.length +
      state.reports.length,
    [state],
  );

  const exportData = () => {
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        workspace: profile.workspace,
        note: "Demo workspace exported from the browser. Contains sample data only.",
        state,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "visun-demo-workspace.json";
      anchor.click();
      URL.revokeObjectURL(url);
      push({
        tone: "success",
        title: "Export downloaded",
        detail: "visun-demo-workspace.json · sample data only",
      });
    } catch {
      push({
        tone: "error",
        title: "Export failed",
        detail: "Your browser blocked the download. Try again in a regular window.",
      });
    }
  };

  const confirmReset = async () => {
    if (confirmText.trim().toUpperCase() !== "RESET") return;
    setResetting(true);
    resetDemo();
    document.documentElement.classList.remove("reduce-motion");
    setResetting(false);
    setResetOpen(false);
    setConfirmText("");
    setLastSaved(null);
    addActivity({
      type: "system",
      actor: "You",
      title: "Demo workspace reset",
      detail:
        "All local changes were cleared and the seeded sample workspace was restored.",
      status: "info",
    });
    push({
      tone: "success",
      title: "Demo reset",
      detail: "Seeded projects, invoices, and conversations are back.",
    });
  };

  const retention = retentionOptions.find(
    (option) => option.value === preferences.retention,
  )!;

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="eyebrow">Settings</p>
            <Badge tone="yellow" className="!py-0.5 !text-[9.5px]">
              Saved locally
            </Badge>
          </div>
          <h2 className="mt-1.5 text-[clamp(1.8rem,2.8vw,2.3rem)] font-semibold leading-tight tracking-[-0.035em]">
            Preferences
          </h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">
            Control what Visun speaks, stores, and animates. Changes apply to this
            browser only and save as you toggle them.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted">
          {hydrated ? (
            <>
              <Check size={12} className="text-success" />
              {lastSaved
                ? `Saved ${relativeTime(lastSaved)}`
                : "Preferences loaded from this browser"}
            </>
          ) : (
            "Loading preferences…"
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel className="overflow-hidden">
            <div className="flex items-center gap-2.5 border-b border-[#ece8e0] px-5 py-3.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ffe7d9] text-[#a63b00]">
                <Mic size={14} />
              </span>
              <div>
                <p className="text-[12.5px] font-semibold">Voice & assistant</p>
                <p className="text-[10px] text-muted">
                  Browser speech only · no audio leaves this device
                </p>
              </div>
            </div>
            <div className="divide-y divide-[#f1ede6] px-5">
              <Switch
                checked={preferences.voiceReplies}
                onChange={(checked) => update("voiceReplies", checked)}
                label="Speak replies aloud"
                description="Uses your browser's speech synthesis. Turn off for silent answers; transcripts still appear."
              />
              <Switch
                checked={preferences.saveTranscripts}
                onChange={(checked) => update("saveTranscripts", checked)}
                label="Save voice transcripts"
                description={
                  preferences.saveTranscripts
                    ? "Voice turns are stored with the conversation so you can revisit the evidence."
                    : "New voice turns will be processed and discarded. Existing transcripts stay until retention runs."
                }
              />
              <Switch
                checked={preferences.dailyBrief}
                onChange={(checked) => update("dailyBrief", checked)}
                label="Morning brief in Today"
                description="Highlights deadlines, overdue invoices, and unreviewed scope changes when you open the workspace."
              />
            </div>
            <div className="flex items-start gap-2 border-t border-[#ece8e0] bg-[#fcfbf9] px-5 py-3">
              <Volume2 size={12} className="mt-0.5 shrink-0 text-muted" />
              <p className="text-[10px] leading-relaxed text-muted">
                Demo mode uses the Web Speech API. If your browser lacks a voice,
                replies fall back to text with no error toast.
              </p>
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="flex items-center gap-2.5 border-b border-[#ece8e0] px-5 py-3.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#efede8] text-ink">
                <MonitorSmartphone size={14} />
              </span>
              <div>
                <p className="text-[12.5px] font-semibold">Accessibility & motion</p>
                <p className="text-[10px] text-muted">
                  Reduce movement without losing state changes
                </p>
              </div>
            </div>
            <div className="px-5">
              <Switch
                checked={preferences.reducedMotion}
                onChange={(checked) => update("reducedMotion", checked)}
                label="Reduce interface motion"
                description="Shortens transitions and disables page and card lifts. Focus rings, loading states, and status text remain."
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#ece8e0] bg-[#fcfbf9] px-5 py-3">
              <p className="text-[10px] text-muted">
                Your system preference is also respected automatically.
              </p>
              <Badge tone={preferences.reducedMotion ? "success" : "neutral"}>
                {preferences.reducedMotion ? "Motion reduced" : "Full motion"}
              </Badge>
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="flex items-center gap-2.5 border-b border-[#ece8e0] px-5 py-3.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e9f1fa] text-[#1e5688]">
                <Globe2 size={14} />
              </span>
              <div>
                <p className="text-[12.5px] font-semibold">Region & retention</p>
                <p className="text-[10px] text-muted">
                  How dates and client history are handled
                </p>
              </div>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label
                  htmlFor="timezone"
                  className="text-[12px] font-medium text-ink"
                >
                  Display timezone
                </label>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                  Dates in this demo are seeded in Asia/Kolkata. Other zones are a
                  preview only — formatting is not converted yet.
                </p>
                <select
                  id="timezone"
                  value={preferences.timezone}
                  onChange={(event) => update("timezone", event.target.value)}
                  className="mt-2 h-10 w-full rounded-xl border border-[#dedad2] bg-[#f8f6f1] px-3 text-[12px] outline-none transition focus:border-[#c8c1b4] focus:bg-white sm:max-w-xs"
                >
                  {timezones.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-[12px] font-medium text-ink">
                  Transcript retention
                </p>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {retentionOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => update("retention", option.value)}
                      aria-pressed={preferences.retention === option.value}
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-left transition",
                        preferences.retention === option.value
                          ? "border-[#e24f00] bg-[#fff7f1] shadow-sm"
                          : "border-[#e6e1d8] bg-white hover:border-[#cfc8bb] hover:bg-[#fcfbf9]",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-[11.5px] font-semibold">
                          {option.label}
                        </span>
                        {preferences.retention === option.value ? (
                          <Check size={12} className="text-orange" />
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-[9.5px] leading-relaxed text-muted">
                        {option.detail}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex items-start gap-2 rounded-lg bg-[#f8f6f1] px-3 py-2.5">
                  <Clock3 size={12} className="mt-0.5 shrink-0 text-muted" />
                  <p className="text-[10px] leading-relaxed text-muted">
                    Active policy: {retention.label}. Retention is not enforced in
                    this browser demo; it is recorded here for the future backend
                    policy.
                  </p>
                </div>
              </div>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel className="overflow-hidden">
            <div className="flex items-center gap-2.5 border-b border-[#ece8e0] px-5 py-3.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e5f3ec] text-success">
                <Database size={14} />
              </span>
              <div>
                <p className="text-[12.5px] font-semibold">Demo data</p>
                <p className="text-[10px] text-muted">Everything stays in this browser</p>
              </div>
            </div>
            <div className="space-y-3 p-5">
              <dl className="space-y-2 text-[10.5px]">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Workspace</dt>
                  <dd className="font-medium">{profile.workspace}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Records</dt>
                  <dd className="tabular font-medium">{recordCount}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Storage</dt>
                  <dd className="font-mono text-[9px]">visun.demo.state.v1</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Seeded</dt>
                  <dd className="font-medium">{formatDate("2026-11-03T08:00:00+05:30")}</dd>
                </div>
              </dl>
              <div className="flex flex-col gap-2">
                <Button size="md" variant="outline" onClick={exportData}>
                  <Download size={14} /> Export workspace JSON
                </Button>
                <Button
                  size="md"
                  variant="ghost"
                  onClick={() => {
                    setResetOpen(true);
                    setConfirmText("");
                  }}
                  className="!text-[#8f2f28] hover:!bg-[#fbe9e7]"
                >
                  <RotateCcw size={14} /> Reset demo data
                </Button>
              </div>
              <p className="text-[9.5px] leading-relaxed text-muted">
                Resetting clears approvals, drafts, conversations, and preference
                changes made in this browser. Exported files are not affected.
              </p>
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="flex items-center gap-2.5 border-b border-[#ece8e0] px-5 py-3.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#efede8] text-ink">
                <Keyboard size={14} />
              </span>
              <div>
                <p className="text-[12.5px] font-semibold">Keyboard</p>
                <p className="text-[10px] text-muted">Fast paths, never hijacked</p>
              </div>
            </div>
            <ul className="divide-y divide-[#f1ede6] px-5">
              {shortcuts.map((shortcut) => (
                <li
                  key={shortcut.keys}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <span className="text-[11px] text-muted">{shortcut.label}</span>
                  <kbd className="rounded-md border border-[#dedad2] bg-[#f8f6f1] px-1.5 py-1 font-mono text-[9px] text-ink shadow-[0_1px_0_#dedad2]">
                    {shortcut.keys}
                  </kbd>
                </li>
              ))}
            </ul>
            <p className="border-t border-[#ece8e0] bg-[#fcfbf9] px-5 py-3 text-[9.5px] leading-relaxed text-muted">
              Shortcuts pause while you are typing in a field. On touch devices the
              command palette is available from the top bar.
            </p>
          </Panel>

          <Panel className="flex items-start gap-3 border-dashed p-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#f8f6f1] text-muted">
              <ShieldCheck size={14} />
            </span>
            <div>
              <p className="text-[11.5px] font-semibold">No account required</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
                This build has no authentication or server sync. Clearing browser
                data removes everything. Provider calls are simulated and clearly
                labelled.
              </p>
            </div>
          </Panel>
        </div>
      </div>

      <Panel className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-start gap-2.5">
          <Archive size={14} className="mt-0.5 shrink-0 text-muted" />
          <p className="max-w-2xl text-[10.5px] leading-relaxed text-muted">
            Retention here records intent only. A production build would enforce it
            server-side and remove expired transcripts, message bodies, and tool
            payloads without keeping silent copies.
          </p>
        </div>
        <Badge tone="neutral">
          {retention.label} · {preferences.timezone}
        </Badge>
      </Panel>

      <Modal
        open={resetOpen}
        onClose={() => {
          if (!resetting) {
            setResetOpen(false);
            setConfirmText("");
          }
        }}
        title="Reset the demo workspace?"
        description="This clears local approvals, drafts, conversations, and preferences, then restores the seeded sample data."
        size="sm"
        footer={
          <>
            <Button
              size="md"
              variant="ghost"
              onClick={() => {
                setResetOpen(false);
                setConfirmText("");
              }}
              disabled={resetting}
            >
              Keep my changes
            </Button>
            <Button
              size="md"
              variant="danger"
              onClick={confirmReset}
              loading={resetting}
              disabled={confirmText.trim().toUpperCase() !== "RESET"}
            >
              Reset everything
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-xl border border-[#ecc9c4] bg-[#fbe9e7] p-3">
            <TriangleAlert size={14} className="mt-0.5 shrink-0 text-danger" />
            <p className="text-[10.5px] leading-relaxed text-[#7d2a24]">
              There is no undo in this demo. Export the workspace first if you want
              a copy of your local changes.
            </p>
          </div>
          <div>
            <label
              htmlFor="reset-confirm"
              className="text-[11.5px] font-medium text-ink"
            >
              Type{" "}
              <span className="font-mono text-[10.5px] text-danger">RESET</span> to
              confirm
            </label>
            <input
              id="reset-confirm"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="RESET"
              className="mt-1.5 h-10 w-full rounded-xl border border-[#dedad2] bg-white px-3 font-mono text-[12px] outline-none transition focus:border-[#b64038]"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
