"use client";

import {
  Fragment,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowDown,
  Check,
  CheckCircle2,
  CircleSlash2,
  Clock3,
  FileAudio,
  Lock,
  Mail,
  MessageSquareText,
  Mic,
  MicOff,
  PencilLine,
  Plus,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
  Wrench,
  X,
} from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Drawer,
  useToast,
} from "@/components/ui";
import { buildAgentReply } from "@/lib/agent";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { GeminiVoiceClient } from "@/lib/voice-client";
import type {
  ChatMessage,
  Conversation,
  Source,
  VoiceLanguage,
  VoiceName,
  VoiceStyle,
} from "@/lib/types";
import {
  cn,
  formatDay,
  formatMoney,
  formatTime,
  uid,
} from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Voice                                                                      */
/* -------------------------------------------------------------------------- */

type VoiceState = "idle" | "listening" | "thinking" | "speaking" | "denied" | "unsupported";

type SpeechResultLike = {
  isFinal: boolean;
  0: { transcript: string };
  length: number;
};
type SpeechEventLike = {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechResultLike };
};
type SpeechErrorLike = { error: string };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechErrorLike) => void) | null;
  onresult: ((event: SpeechEventLike) => void) | null;
};

const voiceLabels: Record<VoiceState, string> = {
  idle: "Voice ready",
  listening: "Listening — speak naturally",
  thinking: "Thinking through your records",
  speaking: "Speaking the answer",
  denied: "Microphone blocked — type instead",
  unsupported: "Voice isn’t available here — type instead",
};

const voiceOptions: Array<{ value: VoiceName; label: string; note: string }> = [
  { value: "Achird", label: "Achird", note: "Warm · default" },
  { value: "Sulafat", label: "Sulafat", note: "Bright" },
  { value: "Aoede", label: "Aoede", note: "Expressive" },
  { value: "Puck", label: "Puck", note: "Playful" },
];

const languageOptions: Array<{ value: VoiceLanguage; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "english", label: "English" },
  { value: "hindi", label: "Hindi" },
];

const styleOptions: Array<{ value: VoiceStyle; label: string }> = [
  { value: "natural", label: "Natural" },
  { value: "professional", label: "Professional" },
  { value: "energetic", label: "Energetic" },
];

function VoiceOrb({
  state,
  onClick,
  disabled,
}: {
  state: VoiceState;
  onClick: () => void;
  disabled?: boolean;
}) {
  const listening = state === "listening";
  const speaking = state === "speaking";
  const thinking = state === "thinking";
  const blocked = state === "denied" || state === "unsupported";

  return (
    <button
      onClick={onClick}
      disabled={disabled || thinking}
      className={cn(
        "relative flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border transition-all duration-300",
        listening
          ? "border-[#e24f00] bg-orange text-ink shadow-[0_10px_26px_-8px_rgba(255,90,0,0.8)]"
          : blocked
            ? "border-[#d7d3cb] bg-[#efede8] text-[#8b867d]"
            : "border-[#ddd8cf] bg-white text-ink shadow-neu-sm hover:shadow-neu-md",
      )}
      aria-label={
        listening ? "Stop listening" : "Start voice input"
      }
      aria-pressed={listening}
    >
      {listening ? (
        <>
          <span className="absolute inset-0 animate-pulse-ring rounded-full border-2 border-orange/50" />
          <span className="absolute inset-[-7px] animate-pulse-ring rounded-full border border-orange/30 [animation-delay:0.6s]" />
          <span className="flex items-end gap-[3px]" aria-hidden="true">
            {[8, 16, 24, 14, 19].map((height, index) => (
              <motion.span
                key={index}
                className="w-[3px] rounded-full bg-ink"
                animate={{ height: [height * 0.5, height, height * 0.65, height] }}
                transition={{
                  duration: 0.9,
                  repeat: Infinity,
                  delay: index * 0.08,
                  ease: "easeInOut",
                }}
              />
            ))}
          </span>
        </>
      ) : speaking ? (
        <Volume2 size={19} />
      ) : blocked ? (
        <MicOff size={18} />
      ) : (
        <Mic size={19} />
      )}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Rich text                                                                  */
/* -------------------------------------------------------------------------- */

function RichText({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-[13.5px] leading-[1.7] text-[#2c2a27]">
      {text.split("\n").map((line, lineIndex) => {
        if (!line.trim()) return <div key={lineIndex} className="h-1" />;
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={lineIndex}>
            {parts.map((part, index) =>
              part.startsWith("**") && part.endsWith("**") ? (
                <strong key={index} className="font-semibold text-ink">
                  {part.slice(2, -2)}
                </strong>
              ) : (
                <Fragment key={index}>{part}</Fragment>
              ),
            )}
          </p>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tool chips                                                                 */
/* -------------------------------------------------------------------------- */

function ToolTrace({ message }: { message: ChatMessage }) {
  if (!message.tools?.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {message.tools.map((tool) => (
        <details
          key={tool.id}
          className="group rounded-lg border border-[#e4dfd6] bg-[#faf9f6] text-[10px]"
        >
          <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg px-2 py-1.5 font-mono text-[9.5px] text-[#6f6a62] transition hover:bg-[#f4f1ea]">
            <Wrench size={10} className="text-[#9a948a]" />
            {tool.name}
            <span className="text-[#a9a39a]">·</span>
            <span className="text-[#8f8a81]">{tool.duration}</span>
            {tool.status === "done" ? (
              <Check size={10} className="text-success" />
            ) : (
              <Clock3 size={10} className="text-warning" />
            )}
          </summary>
          <div className="border-t border-[#e8e3da] px-2 py-1.5 font-mono text-[9px] leading-relaxed text-[#7b756c]">
            <p>{tool.args}</p>
            <p className="mt-0.5 text-success">{tool.result}</p>
          </div>
        </details>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Action card                                                                */
/* -------------------------------------------------------------------------- */

function ActionCard({
  conversationId,
  message,
  onOpenEvidence,
}: {
  conversationId: string;
  message: ChatMessage;
  onOpenEvidence: () => void;
}) {
  const { push } = useToast();
  const { approveAction, rejectAction, updateMessage } = useAppStore();
  const action = message.action;
  const [editing, setEditing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [subject, setSubject] = useState(action?.subject ?? "");
  const [body, setBody] = useState(action?.body ?? "");
  const [recipient, setRecipient] = useState(action?.recipient ?? "");

  if (!action) return null;

  const status = action.status;
  const locked = status !== "pending_approval";

  const saveDraft = () => {
    updateMessage(conversationId, message.id, (current) =>
      current.action
        ? {
            ...current,
            action: {
              ...current.action,
              subject,
              body,
              recipient,
              status: "pending_approval",
            },
          }
        : current,
    );
    setEditing(false);
    push({
      tone: "info",
      title: "Draft updated",
      detail: "Material edits keep the action pending a fresh approval.",
    });
  };

  const approve = async () => {
    setApproving(true);
    const result = await approveAction(conversationId, message.id, {
      ...action,
      subject,
      body,
      recipient,
    });
    setApproving(false);
    if (result.status === "failed") {
      push({
        tone: "error",
        title: "Action failed safely",
        detail:
          result.error ??
          "The provider rejected the request. Nothing was reported as sent.",
      });
      return;
    }
    if (result.status !== "succeeded") {
      push({
        tone: "info",
        title: "No external request made",
        detail: `Action is ${result.status.replace("_", " ")}. Check Activity for the recorded state.`,
      });
      return;
    }
    push({
      tone: result.simulated ? "info" : "success",
      title: result.simulated
        ? "Simulated send recorded"
        : "Action executed exactly once",
      detail: result.simulated
        ? `No external request was made. Simulated reference ${result.providerId ?? "none"}.`
        : `${action.provider} accepted the request · ${result.providerId ?? "provider reference returned"}`,
    });
  };

  const reject = () => {
    void rejectAction(conversationId, message.id);
    push({
      tone: "info",
      title: "Draft rejected",
      detail: "No external request was made. The rejection is in Activity.",
    });
  };

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[#e2d4ae] bg-white shadow-[0_16px_36px_-24px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-between gap-3 border-b border-[#efe4c6] bg-[#fff9e8] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow text-ink">
            <ShieldCheck size={12} />
          </span>
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[#7d5d00]">
            Action preview
          </span>
        </div>
        <Badge
          tone={
            status === "succeeded"
              ? "success"
              : status === "rejected"
                ? "neutral"
                : status === "failed"
                  ? "danger"
                  : "warning"
          }
          className="!py-0.5 !text-[9px]"
        >
          {status === "pending_approval"
            ? "Awaiting approval"
            : status === "executing"
              ? "Sending…"
              : status === "succeeded"
                ? action.simulated
                  ? "Simulated · no send"
                  : "Sent · verified"
                : status === "rejected"
                  ? "Rejected"
                  : "Failed"}
        </Badge>
      </div>

      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f6f3ec] text-[#6f6a62]">
            <Mail size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold">{action.title}</p>
            <div className="mt-1.5 grid gap-1 text-[11px] text-muted sm:grid-cols-2">
              <p>
                <span className="text-[#968f84]">To </span>
                {locked ? action.recipient : recipient}
              </p>
              <p className="truncate">
                <span className="text-[#968f84]">Via </span>
                {action.provider} · single send
              </p>
              {action.amount ? (
                <p>
                  <span className="text-[#968f84]">Amount </span>
                  {formatMoney(action.amount, action.currency)}
                </p>
              ) : null}
              <p>
                <span className="text-[#968f84]">Approval </span>
                exact payload hash
              </p>
            </div>
          </div>
        </div>

        {editing ? (
          <div className="mt-4 space-y-2.5">
            <label className="block">
              <span className="eyebrow !text-[9px]">Recipient</span>
              <input
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-[#ddd7cc] bg-canvas px-3 text-[12px] outline-none focus:border-orange"
              />
            </label>
            <label className="block">
              <span className="eyebrow !text-[9px]">Subject</span>
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-[#ddd7cc] bg-canvas px-3 text-[12px] outline-none focus:border-orange"
              />
            </label>
            <label className="block">
              <span className="eyebrow !text-[9px]">Body</span>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={7}
                className="mt-1 w-full resize-y rounded-lg border border-[#ddd7cc] bg-canvas px-3 py-2 text-[12px] leading-relaxed outline-none focus:border-orange"
              />
            </label>
            <div className="flex gap-2">
              <Button size="sm" variant="dark" onClick={saveDraft}>
                Save draft
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-[#ece7de] bg-[#fbfaf7] p-3">
            <p className="text-[11px] font-semibold text-[#4a4741]">
              {action.subject}
            </p>
            <p className="mt-1.5 line-clamp-4 whitespace-pre-line text-[11.5px] leading-relaxed text-[#6a665e]">
              {action.body}
            </p>
            <button
              onClick={onOpenEvidence}
              className="mt-2 flex items-center gap-1 text-[10px] font-medium text-muted hover:text-ink"
            >
              <FileAudio size={10} /> View sources & provider reference
            </button>
          </div>
        )}

        {status === "pending_approval" && !editing ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={approve}
              loading={approving}
              className="min-w-[132px]"
            >
              <Lock size={12} /> Approve & send
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <PencilLine size={12} /> Edit draft
            </Button>
            <Button size="sm" variant="ghost" onClick={reject} className="text-[#8b857b]">
              Reject
            </Button>
            <p className="ml-auto text-[9.5px] text-muted">
              Expires in 23h · demo only
            </p>
          </div>
        ) : null}

        {status === "executing" ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#f5f3ee] px-3 py-2.5 text-[11px] text-muted">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-warning border-t-transparent" />
            Sending once through Gmail. Waiting for the provider response…
          </div>
        ) : null}

        {status === "succeeded" ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#cfe7da] bg-[#f0f8f4] px-3 py-2.5">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-success" />
            <div>
              <p className="text-[11.5px] font-semibold text-[#1c6142]">
                Provider accepted the send request
              </p>
              <p className="mt-0.5 font-mono text-[9.5px] text-[#4c7a63]">
                {action.providerId} · logged in Activity
              </p>
            </div>
          </div>
        ) : null}

        {status === "rejected" ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#e5e0d7] bg-[#f8f6f1] px-3 py-2.5 text-[11px] text-muted">
            <CircleSlash2 size={13} /> Rejected. Nothing was sent and no external
            side effect occurred.
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Message                                                                    */
/* -------------------------------------------------------------------------- */

function MessageBubble({
  message,
  conversationId,
  onSelectSource,
  onSpeak,
  speaking,
}: {
  message: ChatMessage;
  conversationId: string;
  onSelectSource: (messageId: string, source: Source) => void;
  onSpeak: (text: string) => void;
  speaking: boolean;
}) {
  if (message.role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24 }}
        className="flex justify-end gap-3"
      >
        <div className="max-w-[85%]">
          <div className="mb-1.5 flex items-center justify-end gap-2 text-[10px] text-muted">
            {message.modality === "voice" ? (
              <span className="flex items-center gap-1">
                <Mic size={10} /> Voice
              </span>
            ) : (
              <span>You</span>
            )}
            <span>·</span>
            <span>{formatTime(message.at)}</span>
          </div>
          <div className="rounded-[18px] rounded-tr-md border border-[#ded9cf] bg-stone px-4 py-3 text-[13.5px] leading-relaxed text-ink shadow-[3px_3px_8px_rgba(35,31,24,0.06)]">
            {message.text}
          </div>
        </div>
        <Avatar name="demo_user" initials="DU" hue="orange" size="sm" />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="flex gap-3"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#f4c7ad] bg-[#fff0e6] text-orange">
        <Sparkles size={14} />
      </span>
      <div className="min-w-0 max-w-[calc(100%-44px)] flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted">
          <span className="font-semibold text-ink">Visun</span>
          <Badge tone="success" className="!px-1.5 !py-0 !text-[8.5px]">
            Grounded
          </Badge>
          <span>·</span>
          <span>{formatTime(message.at)}</span>
          <button
            onClick={() => onSpeak(message.text)}
            className="ml-auto flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9.5px] text-muted transition hover:bg-stone hover:text-ink"
            aria-label={speaking ? "Stop reading reply" : "Read reply aloud"}
          >
            {speaking ? <VolumeX size={11} /> : <Volume2 size={11} />}
            {speaking ? "Stop" : "Read"}
          </button>
        </div>
        <div className="rounded-[18px] rounded-tl-md border border-[#e5e0d7] bg-white px-4 py-3.5 shadow-[2px_2px_8px_rgba(35,31,24,0.045)]">
          <RichText text={message.text} />
          <ToolTrace message={message} />

          {message.sources?.length ? (
            <div className="mt-3.5 border-t border-[#efebe3] pt-3">
              <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                <span className="h-1 w-1 rounded-full bg-orange" /> What I checked
              </p>
              <div className="flex flex-wrap gap-1.5">
                {message.sources.map((source) => (
                  <button
                    key={`${source.id}-${source.kind}`}
                    onClick={() => onSelectSource(message.id, source)}
                    className="flex items-center gap-1.5 rounded-lg border border-[#e3ded5] bg-[#faf9f6] px-2 py-1.5 text-left text-[10px] text-[#5f5b54] transition hover:border-[#d0c9bd] hover:bg-white hover:text-ink"
                  >
                    <span className="font-medium">{source.kind}</span>
                    <span className="max-w-[200px] truncate text-[#8a857c]">
                      {source.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {message.action ? (
            <ActionCard
              conversationId={conversationId}
              message={message}
              onOpenEvidence={() => {
                const source = message.sources?.[0];
                if (source) onSelectSource(message.id, source);
              }}
            />
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* Inspector                                                                  */
/* -------------------------------------------------------------------------- */

function InspectorContent({
  conversation,
  selectedSource,
  onClearSource,
}: {
  conversation: Conversation;
  selectedSource: { messageId: string; source: Source } | null;
  onClearSource: () => void;
}) {
  const { state, updatePreferences } = useAppStore();
  const pending = conversation.messages.flatMap((message) =>
    message.action?.status === "pending_approval" ? [message.action] : [],
  );
  const toolCount = conversation.messages.reduce(
    (total, message) => total + (message.tools?.length ?? 0),
    0,
  );

  return (
    <div className="space-y-4">
      {selectedSource ? (
        <div className="rounded-2xl border border-[#e0dacd] bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="eyebrow !text-[9px]">Source evidence</p>
              <p className="mt-1.5 text-[12.5px] font-semibold leading-snug">
                {selectedSource.source.label}
              </p>
            </div>
            <button
              onClick={onClearSource}
              className="rounded-md p-1 text-muted hover:bg-stone hover:text-ink"
              aria-label="Close source"
            >
              <X size={13} />
            </button>
          </div>
          <dl className="mt-3 space-y-2 text-[11px]">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Kind</dt>
              <dd className="text-right font-medium">{selectedSource.source.kind}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Record ID</dt>
              <dd className="font-mono text-[10px]">{selectedSource.source.id}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Checked</dt>
              <dd className="text-right">{formatTime(selectedSource.source.checkedAt)}</dd>
            </div>
          </dl>
          <div className="mt-3 rounded-lg bg-[#f8f6f1] p-2.5 text-[10.5px] leading-relaxed text-[#6f6a62]">
            This is a stored demo record. In production this opens the authorized
            project, message, or invoice with a provider verification timestamp.
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#e0dacd] bg-[#f8f6f1] p-4">
          <p className="eyebrow !text-[9px]">Evidence</p>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            Select a source chip in a reply to inspect the exact record Visun used.
            No source is inferred.
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-[#e0dacd] bg-white p-4">
        <p className="eyebrow !text-[9px]">This session</p>
        <dl className="mt-3 space-y-2.5 text-[11px]">
          <div className="flex items-center justify-between">
            <dt className="text-muted">Messages</dt>
            <dd className="tabular font-medium">{conversation.messages.length}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted">Tool calls</dt>
            <dd className="tabular font-medium">{toolCount}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted">Pending approvals</dt>
            <dd>
              <Badge tone={pending.length ? "warning" : "neutral"} className="!py-0.5 !text-[9px]">
                {pending.length}
              </Badge>
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted">Timezone</dt>
            <dd className="font-mono text-[9.5px]">{state.preferences.timezone}</dd>
          </div>
        </dl>
        <div className="mt-3 border-t border-[#efebe3] pt-3">
          <label className="flex cursor-pointer items-start justify-between gap-3">
            <span>
              <span className="block text-[11.5px] font-medium">Save transcripts</span>
              <span className="mt-0.5 block text-[10px] leading-relaxed text-muted">
                Final text only. Audio is never stored.
              </span>
            </span>
            <button
              role="switch"
              aria-checked={state.preferences.saveTranscripts}
              onClick={() =>
                updatePreferences({
                  saveTranscripts: !state.preferences.saveTranscripts,
                })
              }
              className={cn(
                "relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition",
                state.preferences.saveTranscripts
                  ? "border-[#d94b00] bg-orange"
                  : "border-[#d6d0c5] bg-[#e8e4dc]",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-all",
                  state.preferences.saveTranscripts ? "left-[18px]" : "left-0.5",
                )}
              />
            </button>
          </label>
        </div>
      </div>

      {pending.length ? (
        <div className="rounded-2xl border border-[#ead9a8] bg-[#fff9e8] p-4">
          <p className="flex items-center gap-1.5 text-[10.5px] font-semibold text-[#7d5d00]">
            <ShieldCheck size={12} /> Approval gate active
          </p>
          <p className="mt-1.5 text-[10.5px] leading-relaxed text-[#7d6a35]">
            {pending.length} action is drafted but not executed. Voice alone cannot
            approve it — use the action card.
          </p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-[#e0dacd] bg-white p-4">
        <p className="eyebrow !text-[9px]">Trust boundary</p>
        <ul className="mt-2.5 space-y-2 text-[10.5px] leading-relaxed text-muted">
          {[
            "Answers come only from stored demo records.",
            "PayPal state is Sandbox, not real money.",
            "Email sends are simulated in this browser.",
            "Client chats are treated as untrusted evidence.",
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <Check size={11} className="mt-0.5 shrink-0 text-success" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

function CopilotWorkspace() {
  const searchParams = useSearchParams();
  const reduce = useReducedMotion();
  const { push } = useToast();
  const {
    state,
    hydrated,
    addMessage,
    addActivity,
    createConversation,
    renameConversation,
    deleteConversation,
    noteApiFailure,
    updatePreferences,
  } = useAppStore();

  const conversations = state.conversations;
  const [activeId, setActiveId] = useState(conversations[0]?.id ?? "");
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [thinking, setThinking] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [interim, setInterim] = useState("");
  const [liveReply, setLiveReply] = useState("");
  const [voicePanelOpen, setVoicePanelOpen] = useState(false);
  const [voiceEngine, setVoiceEngine] = useState<"checking" | "live" | "browser">(
    "checking",
  );
  const [voiceEngineModel, setVoiceEngineModel] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<{
    messageId: string;
    source: Source;
  } | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [stickToBottom, setStickToBottom] = useState(true);
  const [showJump, setShowJump] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const liveClientRef = useRef<GeminiVoiceClient | null>(null);
  const voiceIntentRef = useRef(false);
  const voiceRestartsRef = useRef(0);
  const voiceFinalRef = useRef("");
  const interimRef = useRef("");
  const voiceTimerRef = useRef<number | null>(null);
  const autoSentRef = useRef(false);
  const thinkingTimer = useRef<number | null>(null);

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeId) ??
    conversations[0];

  useEffect(() => {
    if (!hydrated) return;
    if (!conversations.find((conversation) => conversation.id === activeId)) {
      setActiveId(conversations[0]?.id ?? "");
    }
  }, [activeId, conversations, hydrated]);

  const filteredSessions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return conversations;
    return conversations.filter(
      (conversation) =>
        conversation.title.toLowerCase().includes(term) ||
        conversation.messages.some((message) =>
          message.text.toLowerCase().includes(term),
        ),
    );
  }, [conversations, search]);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const node = scrollerRef.current;
      if (!node) return;
      node.scrollTo({ top: node.scrollHeight, behavior });
      setStickToBottom(true);
      setShowJump(false);
    },
    [],
  );

  useEffect(() => {
    if (!stickToBottom) {
      setShowJump(true);
      return;
    }
    const timer = window.setTimeout(
      () => scrollToBottom(reduce ? "auto" : "smooth"),
      60,
    );
    return () => window.clearTimeout(timer);
  }, [
    activeConversation?.messages.length,
    activeId,
    reduce,
    scrollToBottom,
    stickToBottom,
    thinking,
  ]);

  useEffect(() => {
    if (!thinking) return;
    setThinkingStep(0);
    thinkingTimer.current = window.setInterval(() => {
      setThinkingStep((step) => (step + 1) % 3);
    }, 520);
    return () => {
      if (thinkingTimer.current) window.clearInterval(thinkingTimer.current);
    };
  }, [thinking]);

  useEffect(() => {
    let cancelled = false;
    void api.health().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setVoiceEngine(result.data.voice.configured ? "live" : "browser");
        setVoiceEngineModel(
          result.data.voice.configured ? result.data.voice.model : null,
        );
      } else {
        setVoiceEngine("browser");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Release the microphone and any pending voice timer when leaving the page.
  useEffect(() => {
    return () => {
      liveClientRef.current?.stop();
      liveClientRef.current = null;
      voiceIntentRef.current = false;
      if (voiceTimerRef.current !== null) {
        window.clearTimeout(voiceTimerRef.current);
        voiceTimerRef.current = null;
      }
      try {
        recognitionRef.current?.abort();
      } catch {
        // Already stopped.
      }
      recognitionRef.current = null;
    };
  }, []);

  const speak = useCallback(
    (raw: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        push({
          tone: "info",
          title: "Speech output unavailable",
          detail: "This browser does not expose the speech synthesis API.",
        });
        return;
      }
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        if (voiceState === "speaking") {
          setVoiceState("idle");
          return;
        }
      }
      const clean = raw
        .replace(/\*\*/g, "")
        .replace(/[•#]/g, "")
        .slice(0, 700);
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.rate = 1.02;
      utterance.pitch = 1;
      utterance.onstart = () => setVoiceState("speaking");
      utterance.onend = () => setVoiceState("idle");
      utterance.onerror = () => setVoiceState("idle");
      window.speechSynthesis.speak(utterance);
    },
    [push, voiceState],
  );

  const send = useCallback(
    async (raw: string, modality: "text" | "voice" = "text") => {
      const text = raw.trim();
      if (!text || thinking) return;

      if (liveClientRef.current) {
        liveClientRef.current.stop();
        liveClientRef.current = null;
        setLiveReply("");
      }

      let conversationId = activeConversation?.id;
      if (!conversationId) {
        conversationId = createConversation("New conversation");
        setActiveId(conversationId);
      }

      if ((activeConversation?.messages.length ?? 0) === 0) {
        renameConversation(conversationId, text.slice(0, 44));
      }

      const userMessage: ChatMessage = {
        id: uid("m"),
        role: "user",
        modality,
        text,
        at: new Date().toISOString(),
      };
      addMessage(conversationId, userMessage);
      setInput("");
      setInterim("");
      setSelectedSource(null);
      setThinking(true);
      setVoiceState(modality === "voice" ? "thinking" : "idle");
      setStickToBottom(true);
      scrollToBottom(reduce ? "auto" : "smooth");

      const result = await api.agentChat({
        conversation_id: conversationId,
        message: text,
        modality,
        client_message_id: userMessage.id,
        client_message_at: userMessage.at,
        title: text.slice(0, 44),
      });

      setThinking(false);

      if (result.ok) {
        const data = result.data;
        addMessage(data.conversationId, {
          ...data.message,
          action: data.action ?? data.message.action,
        });
        if (data.conversationTitle) {
          renameConversation(data.conversationId, data.conversationTitle);
        }
        if (modality === "voice" && state.preferences.voiceReplies) {
          setVoiceState("speaking");
          window.setTimeout(() => speak(data.message.text), 120);
        } else if (modality === "voice") {
          setVoiceState("idle");
        }
        return;
      }

      // Backend unreachable: answer locally, but label the fallback so nobody
      // mistakes a scripted draft for a grounded server result.
      noteApiFailure(result.error);
      const reply = buildAgentReply(text, state);
      addMessage(conversationId, {
        id: uid("m"),
        role: "assistant",
        modality: "text",
        text: reply.text,
        at: new Date().toISOString(),
        sources: reply.sources,
        tools: reply.tools,
        action: reply.action,
      });
      addActivity({
        type: "system",
        actor: "Visun",
        title: "Offline fallback answer",
        detail: `${result.error} This reply came from the local demo script, not the grounded backend. Any approval will be attempted against the backend first.`,
        status: "info",
        reference: conversationId,
      });
      if (modality === "voice" && state.preferences.voiceReplies) {
        setVoiceState("speaking");
        window.setTimeout(() => speak(reply.text), 120);
      } else if (modality === "voice") {
        setVoiceState("idle");
      }
    },
    [
      activeConversation?.id,
      activeConversation?.messages.length,
      addActivity,
      addMessage,
      createConversation,
      noteApiFailure,
      reduce,
      renameConversation,
      scrollToBottom,
      speak,
      state,
      thinking,
    ],
  );

  // Prompt handed over from the dashboard or command palette.
  useEffect(() => {
    if (!hydrated || autoSentRef.current) return;
    const prompt = searchParams.get("prompt");
    if (!prompt) return;
    autoSentRef.current = true;
    setInput("");
    void send(prompt, "text");
  }, [hydrated, searchParams, send]);

  const clearVoiceTimer = () => {
    if (voiceTimerRef.current !== null) {
      window.clearTimeout(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
  };

  const stopVoice = (transcript?: string) => {
    const text = (
      transcript ?? `${voiceFinalRef.current} ${interimRef.current}`
    ).trim();
    voiceIntentRef.current = false;
    voiceRestartsRef.current = 0;
    clearVoiceTimer();
    voiceFinalRef.current = "";
    interimRef.current = "";
    setInterim("");
    try {
      recognitionRef.current?.abort();
    } catch {
      // Already stopped — nothing to clean up.
    }
    recognitionRef.current = null;
    if (text.length >= 2) {
      void send(text, "voice");
    } else {
      setVoiceState("idle");
    }
  };

  const beginBrowserRecognition = () => {
    if (typeof window === "undefined") return;

    const host = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Recognition = host.SpeechRecognition ?? host.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceState("unsupported");
      push({
        tone: "info",
        title: "Voice is not available in this browser",
        detail:
          "Use the text composer, or try Chrome for the Web Speech API demo.",
      });
      return;
    }

    voiceIntentRef.current = true;
    voiceRestartsRef.current = 0;
    voiceFinalRef.current = "";
    interimRef.current = "";
    clearVoiceTimer();
    setInterim("");
    setLiveReply("");
    setStickToBottom(true);
    // Reflect the click immediately; the browser may take a moment to open
    // the microphone or ask for permission.
    setVoiceState("listening");

    const begin = () => {
      if (!voiceIntentRef.current) return;
      const recognition = new Recognition();
      recognitionRef.current = recognition;
      recognition.lang =
        state.preferences.voiceLanguage === "hindi" ? "hi-IN" : "en-IN";
      // Keep a single session open across natural pauses. Chrome otherwise
      // ends the session at the first pause and the orb drops back to idle.
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setVoiceState("listening");
        setStickToBottom(true);
      };

      recognition.onresult = (event) => {
        voiceRestartsRef.current = 0;
        let interimText = "";
        let finalText = voiceFinalRef.current;
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const transcript = result[0]?.transcript ?? "";
          if (result.isFinal) finalText += transcript;
          else interimText += transcript;
        }
        voiceFinalRef.current = finalText;
        interimRef.current = interimText;
        setInterim(interimText);

        if (finalText.trim()) {
          // Wait for a short pause before sending, then include any trailing
          // interim words so nothing is dropped.
          clearVoiceTimer();
          voiceTimerRef.current = window.setTimeout(() => {
            const pending = `${voiceFinalRef.current} ${interimRef.current}`.trim();
            stopVoice(pending);
          }, 900);
        }
      };

      recognition.onerror = (event) => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          voiceIntentRef.current = false;
          voiceRestartsRef.current = 0;
          clearVoiceTimer();
          setVoiceState("denied");
          push({
            tone: "error",
            title: "Microphone access blocked",
            detail:
              "Allow microphone access for this site in your browser settings, or type your question instead.",
          });
          return;
        }

        if (
          event.error === "audio-capture" ||
          event.error === "network" ||
          event.error === "language-not-supported"
        ) {
          voiceIntentRef.current = false;
          voiceRestartsRef.current = 0;
          clearVoiceTimer();
          setVoiceState("idle");
          push({
            tone: "error",
            title: "Voice input stopped",
            detail:
              event.error === "network"
                ? "Speech recognition lost its network connection. Check your connection and try again."
                : "The microphone could not be used. Close other apps using it, then try again or type instead.",
          });
        }
        // "no-speech" and "aborted" are recoverable: onend restarts the mic.
      };

      recognition.onend = () => {
        recognitionRef.current = null;
        if (voiceIntentRef.current) {
          voiceRestartsRef.current += 1;
          if (voiceRestartsRef.current > 24) {
            voiceIntentRef.current = false;
            voiceRestartsRef.current = 0;
            setVoiceState("idle");
            push({
              tone: "error",
              title: "Microphone keeps stopping",
              detail:
                "Check that no other app is holding the microphone, then try again or type instead.",
            });
            return;
          }
          // The browser can end a session on silence or a hiccup. Restart it
          // while the visitor still has listening turned on.
          window.setTimeout(() => {
            if (voiceIntentRef.current) begin();
          }, 250);
          return;
        }
        setVoiceState((current) =>
          current === "listening" ? "idle" : current,
        );
      };

      try {
        recognition.start();
      } catch {
        voiceIntentRef.current = false;
        recognitionRef.current = null;
        setVoiceState("idle");
        push({
          tone: "error",
          title: "Voice input could not start",
          detail: "Try again, or type your question in the composer instead.",
        });
      }
    };

    begin();
  };

  const stopLiveVoice = () => {
    liveClientRef.current?.stop();
    liveClientRef.current = null;
    setLiveReply("");
    setInterim("");
    setVoiceState("idle");
  };

  const beginLiveVoice = async () => {
    if (typeof window === "undefined") return;

    if (recognitionRef.current) {
      voiceIntentRef.current = false;
      try {
        recognitionRef.current.abort();
      } catch {
        // Already stopped.
      }
      recognitionRef.current = null;
    }
    clearVoiceTimer();
    setInterim("");
    setLiveReply("");
    setStickToBottom(true);
    setVoiceState("listening");

    let conversationId = activeConversation?.id;
    if (!conversationId) {
      conversationId = createConversation("Voice session");
      setActiveId(conversationId);
    }
    const titlePending =
      !activeConversation || activeConversation.messages.length === 0;

    const client = new GeminiVoiceClient({
      onStatus: (status, detail) => {
        if (status === "ready") {
          setVoiceEngine("live");
          if (detail?.model) setVoiceEngineModel(detail.model);
          setVoiceState("listening");
          return;
        }
        if (status === "thinking") {
          setVoiceState("thinking");
          return;
        }
        if (status === "speaking") {
          setVoiceState("speaking");
          return;
        }
        if (status === "interrupted") {
          setLiveReply("");
          setVoiceState("listening");
          return;
        }
        if (status === "listening") {
          setVoiceState("listening");
          return;
        }
        setVoiceState("idle");
      },
      onTranscript: (role, text) => {
        if (role === "assistant") setLiveReply(text);
        else setInterim(text);
      },
      onTurn: (turn) => {
        const target = turn.conversationId || conversationId;
        setInterim("");
        setLiveReply("");
        if (turn.userMessage) {
          addMessage(target, turn.userMessage);
        } else if (turn.userText) {
          addMessage(target, {
            id: uid("m"),
            role: "user",
            modality: "voice",
            text: turn.userText,
            at: new Date().toISOString(),
          });
        }
        if (turn.assistantMessage) {
          addMessage(target, turn.assistantMessage);
        } else if (turn.assistantText) {
          addMessage(target, {
            id: uid("m"),
            role: "assistant",
            modality: "voice",
            text: turn.assistantText,
            at: new Date().toISOString(),
          });
        }
        if (turn.userText && titlePending) {
          renameConversation(target, turn.userText.slice(0, 44));
        }
      },
      onApproval: (action) => {
        push({
          tone: "info",
          title: "Draft ready for approval",
          detail: `${action.title}. Nothing has been sent.`,
        });
      },
      onError: (message) => {
        setVoiceState("idle");
        push({
          tone: "error",
          title: "Voice session",
          detail: message,
        });
      },
    });
    liveClientRef.current = client;

    let mode: "live" | "fallback" = "fallback";
    try {
      mode = await client.connect(conversationId);
    } catch {
      mode = "fallback";
    }

    if (mode === "fallback") {
      client.stop();
      if (liveClientRef.current === client) liveClientRef.current = null;
      setVoiceEngine("browser");
      setVoiceState("idle");
      beginBrowserRecognition();
      return;
    }
    setVoiceEngine("live");
    setVoiceState("listening");
  };

  const startVoice = () => {
    if (typeof window === "undefined") return;

    if (liveClientRef.current) {
      stopLiveVoice();
      return;
    }
    if (voiceState === "listening" || voiceState === "thinking") {
      stopVoice();
      return;
    }
    if (voiceState === "speaking") {
      window.speechSynthesis?.cancel();
      setVoiceState("idle");
    }
    void beginLiveVoice();
  };

  const newSession = () => {
    const id = createConversation("New conversation");
    setActiveId(id);
    setInput("");
    setSelectedSource(null);
    push({
      tone: "info",
      title: "Fresh conversation",
      detail: "Same workspace records, same approval rules.",
    });
    window.setTimeout(() => textareaRef.current?.focus(), 80);
  };

  const selectConversation = (id: string) => {
    setActiveId(id);
    setSelectedSource(null);
    setStickToBottom(true);
    window.setTimeout(() => scrollToBottom("auto"), 40);
  };

  const handleScroll = () => {
    const node = scrollerRef.current;
    if (!node) return;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    const atBottom = distance < 90;
    setStickToBottom(atBottom);
    setShowJump(!atBottom);
  };

  const suggestedPrompts = [
    "What is due this week?",
    "How much is still unpaid?",
    "What changed on my projects?",
    "Draft a reminder for the overdue invoice.",
  ];

  const groupedSessions = [
    {
      label: "Today",
      items: filteredSessions.filter((conversation) =>
        conversation.updatedAt.startsWith("2026-11-03"),
      ),
    },
    {
      label: "Earlier",
      items: filteredSessions.filter(
        (conversation) => !conversation.updatedAt.startsWith("2026-11-03"),
      ),
    },
  ].filter((group) => group.items.length > 0);

  if (!hydrated) {
    return null;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Voice + text · one history</p>
          <h2 className="mt-1.5 text-[clamp(1.8rem,2.8vw,2.3rem)] font-semibold leading-tight tracking-[-0.035em]">
            Copilot
          </h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">
            Ask about deadlines, scope, or payments. Every answer cites the record
            it used, and every send waits for your approval.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={voiceState === "idle" ? "success" : "warning"} dot>
            {voiceLabels[voiceState]}
          </Badge>
          <Badge
            tone={voiceEngine === "live" ? "success" : "neutral"}
            className="hidden sm:inline-flex"
          >
            {voiceEngine === "live"
              ? "Gemini Live"
              : voiceEngine === "browser"
                ? "Browser voice"
                : "Checking voice"}
          </Badge>
          <Button variant="primary" size="md" onClick={newSession}>
            <Plus size={14} /> New session
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[218px_minmax(0,1fr)] xl:grid-cols-[218px_minmax(0,1fr)_308px]">
        {/* Session rail */}
        <aside className="hidden min-h-0 flex-col overflow-hidden rounded-[22px] border border-[#e3dfd7] bg-white shadow-neu-sm lg:flex">
          <div className="border-b border-[#ece8e0] p-3">
            <div className="relative">
              <Search
                size={13}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search history"
                className="h-9 w-full rounded-lg border border-[#e2ded6] bg-[#f8f6f1] pl-8 pr-2 text-[11.5px] outline-none transition focus:border-[#c9c2b5] focus:bg-white"
                aria-label="Search conversations"
              />
            </div>
            <p className="mt-2.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[#968f84]">
              {filteredSessions.length} sessions · saved locally
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {groupedSessions.map((group) => (
              <div key={group.label} className="mb-2">
                <p className="px-2 py-1.5 font-mono text-[8.5px] uppercase tracking-[0.14em] text-[#9b958b]">
                  {group.label}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((conversation) => {
                    const active = conversation.id === activeConversation?.id;
                    return (
                      <li key={conversation.id} className="group relative">
                        <button
                          onClick={() => selectConversation(conversation.id)}
                          className={cn(
                            "w-full rounded-lg px-2.5 py-2 text-left transition",
                            active
                              ? "bg-[#f3f0e9] text-ink"
                              : "text-[#5f5b54] hover:bg-[#faf8f4] hover:text-ink",
                          )}
                        >
                          <span className="flex items-center gap-1.5">
                            <MessageSquareText
                              size={11}
                              className={cn(
                                "shrink-0",
                                active ? "text-orange" : "text-[#a09a90]",
                              )}
                            />
                            <span className="truncate text-[11.5px] font-medium">
                              {conversation.title}
                            </span>
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5 pl-[17px] font-mono text-[8.5px] text-[#9b958b]">
                            {formatDay(conversation.updatedAt)} ·{" "}
                            {conversation.messages.length} msg
                          </span>
                        </button>
                        {conversations.length > 1 ? (
                          <button
                            onClick={() => deleteConversation(conversation.id)}
                            className="absolute right-1.5 top-1.5 hidden h-5 w-5 items-center justify-center rounded text-[#a09a90] hover:bg-stone hover:text-danger group-hover:flex"
                            aria-label={`Delete ${conversation.title}`}
                          >
                            <X size={10} />
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-[#ece8e0] p-3">
            <button
              onClick={newSession}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#d7d1c6] py-2 text-[10.5px] font-medium text-muted transition hover:border-[#c4bcae] hover:bg-[#faf8f4] hover:text-ink"
            >
              <Plus size={11} /> Start fresh
            </button>
          </div>
        </aside>

        {/* Chat */}
        <section className="flex min-h-[640px] min-w-0 flex-col overflow-hidden rounded-[22px] border border-[#e3dfd7] bg-white shadow-neu-sm lg:h-[calc(100vh-190px)] lg:min-h-[620px]">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#ece8e0] px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#fff0e6] text-orange">
                <Sparkles size={14} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold">
                  {activeConversation?.title ?? "New conversation"}
                </p>
                <p className="flex items-center gap-1.5 text-[9.5px] text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  Records connected · history persists locally
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setInspectorOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-[#e3ded5] bg-white px-2 py-1.5 text-[10px] font-medium text-muted transition hover:text-ink xl:hidden"
              >
                <ShieldCheck size={11} /> Evidence
              </button>
              <span className="hidden rounded-md bg-[#f4f1ea] px-2 py-1 font-mono text-[9px] text-muted sm:block">
                demo workspace
              </span>
            </div>
          </div>

          <div
            ref={scrollerRef}
            onScroll={handleScroll}
            className="relative min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5"
            aria-live="polite"
          >
            {!activeConversation || activeConversation.messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center py-8 text-center">
                <div className="relative mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-[#e2ddd4] bg-canvas shadow-neu-md">
                  <Sparkles size={26} className="text-orange" />
                  <span className="absolute -right-1 top-2 flex h-6 w-6 items-center justify-center rounded-full border border-[#e7cf6f] bg-yellow text-[10px] font-semibold">
                    AI
                  </span>
                </div>
                <h3 className="font-serif text-[26px] leading-tight tracking-tight">
                  What should we check?
                </h3>
                <p className="mt-1.5 max-w-sm text-[12px] leading-relaxed text-muted">
                  I answer from stored projects, agreements, messages, and PayPal
                  Sandbox records. I show the evidence and never send without you.
                </p>
                <div className="mt-5 grid w-full max-w-lg gap-2 sm:grid-cols-2">
                  {suggestedPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => void send(prompt, "text")}
                      className="rounded-xl border border-[#e6e1d8] bg-[#fbfaf7] px-3 py-2.5 text-left text-[11.5px] font-medium text-[#55514a] transition hover:border-[#d3ccbf] hover:bg-white hover:text-ink"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-[760px] space-y-6">
                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-[#ece8e0]" />
                  <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[#a59f95]">
                    Today · {formatDay(activeConversation.updatedAt)}
                  </span>
                  <span className="h-px flex-1 bg-[#ece8e0]" />
                </div>
                {activeConversation.messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    conversationId={activeConversation.id}
                    onSelectSource={(messageId, source) => {
                      setSelectedSource({ messageId, source });
                      if (window.innerWidth < 1280) setInspectorOpen(true);
                    }}
                    onSpeak={speak}
                    speaking={voiceState === "speaking"}
                  />
                ))}
                <AnimatePresence>
                  {thinking ? (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex gap-3"
                    >
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-canvas">
                        <Sparkles size={14} />
                      </span>
                      <div className="rounded-2xl rounded-tl-md border border-[#e5e0d7] bg-[#fbfaf7] px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {[0, 1, 2].map((dot) => (
                            <motion.span
                              key={dot}
                              className="h-1.5 w-1.5 rounded-full bg-[#a39d92]"
                              animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                              transition={{
                                duration: 1,
                                repeat: Infinity,
                                delay: dot * 0.14,
                              }}
                            />
                          ))}
                          <span className="ml-1.5 text-[11px] text-muted">
                            {
                              [
                                "Reading stored milestones",
                                "Reconciling PayPal Sandbox",
                                "Checking agreement clauses",
                              ][thinkingStep]
                            }
                            …
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            )}
          </div>

          {showJump ? (
            <div className="relative">
              <button
                onClick={() => scrollToBottom(reduce ? "auto" : "smooth")}
                className="absolute -top-12 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-[#ddd8cf] bg-white px-3 py-1.5 text-[10px] font-medium text-ink shadow-neu-sm"
              >
                <ArrowDown size={11} /> Latest
              </button>
            </div>
          ) : null}

          <div className="shrink-0 border-t border-[#ece8e0] bg-[#fbfaf7] p-3 sm:p-4">
            {liveReply ? (
              <div className="mb-2 flex items-start gap-2 rounded-xl border border-[#efd9a8] bg-[#fff9e8] px-3 py-2 text-[11.5px] leading-relaxed text-[#5b4a1a]">
                <Sparkles
                  size={12}
                  className="mt-0.5 shrink-0 animate-pulse text-[#a67c00]"
                />
                <span>{liveReply}</span>
                <span className="ml-auto shrink-0 font-mono text-[8.5px] uppercase tracking-wider text-[#a67c00]">
                  live
                </span>
              </div>
            ) : null}

            {interim ? (
              <div className="mb-2 flex items-center gap-2 rounded-xl border border-[#e7cf6f] bg-yellow/50 px-3 py-2 text-[11.5px] text-[#6b5511]">
                <Mic size={12} className="animate-pulse" />
                <span className="italic">{interim}</span>
                <span className="ml-auto font-mono text-[8.5px] uppercase tracking-wider">
                  interim
                </span>
              </div>
            ) : null}

            {voicePanelOpen ? (
              <div className="mb-2 rounded-2xl border border-[#e0dbd2] bg-white p-3 shadow-neu-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold">Voice settings</p>
                    <p className="mt-0.5 text-[9.5px] text-muted">
                      {voiceEngine === "live"
                        ? `Gemini Live · ${voiceEngineModel ?? "native audio"}`
                        : voiceEngine === "browser"
                          ? "Browser voice fallback"
                          : "Checking voice engine…"}
                    </p>
                  </div>
                  <button
                    onClick={() => setVoicePanelOpen(false)}
                    className="rounded-md p-1 text-muted transition hover:bg-stone hover:text-ink"
                    aria-label="Close voice settings"
                  >
                    <X size={12} />
                  </button>
                </div>
                <div className="mt-3 space-y-2.5">
                  <div>
                    <p className="eyebrow !text-[8.5px]">Voice</p>
                    <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                      {voiceOptions.map((option) => {
                        const active =
                          state.preferences.voiceName === option.value;
                        return (
                          <button
                            key={option.value}
                            onClick={() =>
                              updatePreferences({ voiceName: option.value })
                            }
                            aria-pressed={active}
                            className={cn(
                              "rounded-lg border px-2 py-1.5 text-left transition",
                              active
                                ? "border-[#e24f00] bg-[#fff0e6] text-ink"
                                : "border-[#e6e1d8] bg-[#fbfaf7] text-[#6f6a62] hover:border-[#d3ccbf] hover:bg-white",
                            )}
                          >
                            <span className="block text-[10.5px] font-semibold">
                              {option.label}
                            </span>
                            <span className="mt-0.5 block text-[8.5px] text-[#9b958b]">
                              {option.note}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <div>
                      <p className="eyebrow !text-[8.5px]">Language</p>
                      <div className="mt-1.5 flex gap-1">
                        {languageOptions.map((option) => {
                          const active =
                            state.preferences.voiceLanguage === option.value;
                          return (
                            <button
                              key={option.value}
                              onClick={() =>
                                updatePreferences({
                                  voiceLanguage: option.value,
                                })
                              }
                              aria-pressed={active}
                              className={cn(
                                "flex-1 rounded-lg border px-2 py-1.5 text-[10px] font-medium transition",
                                active
                                  ? "border-[#e24f00] bg-[#fff0e6] text-ink"
                                  : "border-[#e6e1d8] bg-[#fbfaf7] text-[#6f6a62] hover:border-[#d3ccbf] hover:bg-white",
                              )}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="eyebrow !text-[8.5px]">Style</p>
                      <div className="mt-1.5 flex gap-1">
                        {styleOptions.map((option) => {
                          const active =
                            state.preferences.voiceStyle === option.value;
                          return (
                            <button
                              key={option.value}
                              onClick={() =>
                                updatePreferences({ voiceStyle: option.value })
                              }
                              aria-pressed={active}
                              className={cn(
                                "flex-1 rounded-lg border px-1.5 py-1.5 text-[9.5px] font-medium transition",
                                active
                                  ? "border-[#e24f00] bg-[#fff0e6] text-ink"
                                  : "border-[#e6e1d8] bg-[#fbfaf7] text-[#6f6a62] hover:border-[#d3ccbf] hover:bg-white",
                              )}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-[9px] leading-relaxed text-[#9b958b]">
                  Saved to your workspace and applied when you start the next
                  voice session. Live voice uses Gemini native audio; the fallback
                  uses your browser voice.
                </p>
              </div>
            ) : null}

            <div className="rounded-2xl border border-[#ded8cc] bg-canvas p-2 shadow-[inset_3px_3px_8px_rgba(35,31,24,0.08),inset_-3px_-3px_8px_rgba(255,255,255,0.9)]">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => {
                  setInput(event.target.value);
                  const node = event.target;
                  node.style.height = "auto";
                  node.style.height = `${Math.min(120, node.scrollHeight)}px`;
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send(input, "text");
                  }
                }}
                rows={1}
                placeholder="Ask about deadlines, scope, payments…"
                className="max-h-[120px] w-full resize-none bg-transparent px-2 py-2 text-[13px] leading-relaxed outline-none placeholder:text-[#9c968c]"
                aria-label="Message Visun"
              />
              <div className="flex items-center justify-between gap-2 px-1 pb-0.5">
                <div className="flex items-center gap-1.5">
                  <VoiceOrb
                    state={voiceState}
                    onClick={startVoice}
                    disabled={thinking}
                  />
                  <div className="hidden sm:block">
                    <p className="text-[10px] font-medium text-[#5f5b54]">
                      {voiceLabels[voiceState]}
                    </p>
                    <p className="text-[9px] text-[#9b958b]">
                      {thinking
                        ? "Tools are running · nothing is sent"
                        : voiceEngine === "live"
                          ? "Gemini Live · mic audio is not stored"
                          : voiceEngine === "browser"
                            ? "Browser voice · mic audio is not stored"
                            : "Checking voice engine…"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setVoicePanelOpen((open) => !open)}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg border transition",
                      voicePanelOpen
                        ? "border-[#e0a58a] bg-[#fff0e6] text-ink"
                        : "border-[#e0dbd2] bg-white text-ink",
                    )}
                    aria-label="Voice settings"
                    aria-expanded={voicePanelOpen}
                  >
                    <SlidersHorizontal size={15} />
                  </button>
                  <button
                    onClick={() =>
                      updatePreferences({
                        voiceReplies: !state.preferences.voiceReplies,
                      })
                    }
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg border transition",
                      state.preferences.voiceReplies
                        ? "border-[#e0dbd2] bg-white text-ink"
                        : "border-transparent bg-transparent text-[#a39d92]",
                    )}
                    aria-label={
                      state.preferences.voiceReplies
                        ? "Turn spoken replies off"
                        : "Turn spoken replies on"
                    }
                    aria-pressed={state.preferences.voiceReplies}
                  >
                    {state.preferences.voiceReplies ? (
                      <Volume2 size={15} />
                    ) : (
                      <VolumeX size={15} />
                    )}
                  </button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => void send(input, "text")}
                    disabled={!input.trim() || thinking}
                    className="!h-9 !px-3"
                    aria-label="Send message"
                  >
                    {thinking ? (
                      <Square size={12} />
                    ) : (
                      <Send size={13} />
                    )}
                    <span className="hidden sm:inline">Send</span>
                  </Button>
                </div>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[9px] text-[#9b958b]">
                Enter to send · Shift + Enter for a new line · demo responses
              </p>
              <div className="hidden gap-1 sm:flex">
                {suggestedPrompts.slice(0, 2).map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setInput(prompt)}
                    className="rounded-full border border-[#e2ddd4] bg-white px-2 py-1 text-[9px] text-muted transition hover:text-ink"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Inspector */}
        <aside className="hidden min-h-0 overflow-y-auto xl:block xl:h-[calc(100vh-190px)]">
          <InspectorContent
            conversation={
              activeConversation ?? {
                id: "empty",
                title: "New conversation",
                updatedAt: new Date().toISOString(),
                messages: [],
              }
            }
            selectedSource={selectedSource}
            onClearSource={() => setSelectedSource(null)}
          />
        </aside>
      </div>

      <Drawer
        open={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        title="Evidence inspector"
        subtitle="Sources, tool calls, and approval state"
      >
        <InspectorContent
          conversation={
            activeConversation ?? {
              id: "empty",
              title: "New conversation",
              updatedAt: new Date().toISOString(),
              messages: [],
            }
          }
          selectedSource={selectedSource}
          onClearSource={() => setSelectedSource(null)}
        />
      </Drawer>
    </div>
  );
}

export default function CopilotPage() {
  return (
    <Suspense
      fallback={
        <div className="grid h-[70vh] place-items-center">
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-orange border-t-transparent" />
            Opening copilot…
          </div>
        </div>
      }
    >
      <CopilotWorkspace />
    </Suspense>
  );
}
