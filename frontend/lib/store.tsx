"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, configureApiAuth, type BootstrapResponse } from "./api";
import { defaultState, workspace as demoWorkspace } from "./demo-data";
import type {
  ActionStatus,
  ActivityEvent,
  AppState,
  ChatMessage,
  Lead,
  LeadStage,
  Preferences,
  ProposedAction,
  Report,
  ReviewState,
} from "./types";
import { uid } from "./utils";

const STORAGE_KEY = "visun.demo.state.v1";

type ActivityInput = Omit<ActivityEvent, "id" | "at"> & { at?: string };

export type ConnectionState = "checking" | "online" | "offline";

export type ActionResult = {
  status: ActionStatus;
  providerId?: string;
  simulated: boolean;
  error?: string;
};

type StoreValue = {
  state: AppState;
  hydrated: boolean;
  connection: ConnectionState;
  connectionError: string | null;
  providerMode: "simulated" | "real";
  authMode: "demo" | "clerk";
  apiAgent: string;
  profile: { name: string; email: string; workspace: string };
  isDemo: boolean;
  refresh: () => Promise<void>;
  noteApiFailure: (error: string) => void;
  reviewFinding: (id: string, reviewState: ReviewState) => void;
  toggleMilestone: (id: string) => void;
  addActivity: (event: ActivityInput) => void;
  approveAction: (
    conversationId: string,
    messageId: string,
    action: ProposedAction,
  ) => Promise<ActionResult>;
  rejectAction: (conversationId: string, messageId: string) => Promise<void>;
  addMessage: (conversationId: string, message: ChatMessage) => void;
  updateMessage: (
    conversationId: string,
    messageId: string,
    update: (message: ChatMessage) => ChatMessage,
  ) => void;
  createConversation: (title: string) => string;
  renameConversation: (id: string, title: string) => void;
  deleteConversation: (id: string) => void;
  addLead: (lead: Lead) => void;
  moveLead: (id: string, stage: LeadStage) => Promise<void>;
  addReport: (report: Report) => void;
  sendReport: (
    reportId: string,
    title?: string,
  ) => Promise<{ providerId?: string; simulated: boolean; error?: string }>;
  toggleIntegration: (
    id: string,
    connected: boolean,
  ) => Promise<{ ok: boolean; error?: string }>;
  updatePreferences: (update: Partial<Preferences>) => void;
  recheckPayments: () => Promise<void>;
  resetDemo: () => Promise<void>;
};

const StoreContext = createContext<StoreValue | null>(null);

type AppStoreProviderProps = {
  children: ReactNode;
  /** Clerk token getter. Omit for demo mode. */
  getToken?: () => Promise<string | null>;
  /** When true, requests carry `X-Visun-Demo: 1` instead of a bearer token. */
  demo?: boolean;
  /**
   * True only for a signed-in Clerk workspace. The seeded demo must never
   * render for an authenticated user while their own workspace loads.
   */
  authenticated?: boolean;
};

export function AppStoreProvider({
  children,
  getToken,
  demo = false,
  authenticated = false,
}: AppStoreProviderProps) {
  const [state, setState] = useState<AppState>(defaultState);
  const [hydrated, setHydrated] = useState(false);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>("checking");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [providerMode, setProviderMode] = useState<"simulated" | "real">(
    "simulated",
  );
  const [authMode, setAuthMode] = useState<"demo" | "clerk">("demo");
  const [apiAgent, setApiAgent] = useState("deterministic");
  const [profile, setProfile] = useState({
    name: demoWorkspace.owner,
    email: demoWorkspace.email,
    workspace: demoWorkspace.name,
  });
  // Only the demo snapshot is cached in the browser. An authenticated workspace
  // always re-reads from the API so a shared browser never shows another
  // account's records from localStorage.
  const storageKey = demo ? STORAGE_KEY : null;

  // Runs before the hydration effect below, so the first bootstrap request
  // already carries the right credentials.
  useEffect(() => {
    configureApiAuth({ getToken, demo });
    return () => configureApiAuth(null);
  }, [getToken, demo]);

  const applySnapshot = useCallback((snapshot: BootstrapResponse) => {
    setState(snapshot.state);
    setProviderMode(snapshot.providerMode);
    setAuthMode(snapshot.authMode);
    setApiAgent(snapshot.agent?.backend ?? "deterministic");
    setProfile({
      name: snapshot.user.name,
      email: snapshot.user.email,
      workspace: snapshot.workspace.name,
    });
    setConnection("online");
    setConnectionError(null);
    setWorkspaceLoaded(true);
    if (!storageKey) return;
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify(snapshot.state),
      );
    } catch {
      // Quota or private mode — the in-memory snapshot is still authoritative.
    }
  }, [storageKey]);

  const refresh = useCallback(async () => {
    setConnection("checking");
    const result = await api.bootstrap();
    if (result.ok) {
      applySnapshot(result.data);
    } else {
      setConnection("offline");
      setConnectionError(result.error);
    }
  }, [applySnapshot]);

  useEffect(() => {
    if (!storageKey) {
      setHydrated(true);
      void refresh();
      return;
    }
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as AppState;
        if (parsed.version === defaultState.version) {
          setState(parsed);
        }
      }
    } catch {
      // A corrupted demo cache should never block the app.
      window.localStorage.removeItem(storageKey);
    }
    setHydrated(true);
    void refresh();
  }, [refresh, storageKey]);

  useEffect(() => {
    if (!hydrated || !storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Private browsing / quota — keep the in-memory session usable.
    }
  }, [state, hydrated, storageKey]);

  const noteFailure = useCallback((error: string) => {
    setConnection("offline");
    setConnectionError(error);
  }, []);

  const addActivity = useCallback((event: ActivityInput) => {
    setState((current) => ({
      ...current,
      activities: [
        {
          ...event,
          id: uid("act"),
          at: event.at ?? new Date().toISOString(),
        },
        ...current.activities,
      ],
    }));
  }, []);

  const reviewFinding = useCallback(
    (id: string, reviewState: ReviewState) => {
      setState((current) => ({
        ...current,
        findingReviews: { ...current.findingReviews, [id]: reviewState },
      }));
      void api.reviewFinding(id, reviewState).then((result) => {
        if (!result.ok) noteFailure(result.error);
      });
    },
    [noteFailure],
  );

  const toggleMilestone = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      doneMilestones: current.doneMilestones.includes(id)
        ? current.doneMilestones.filter((milestoneId) => milestoneId !== id)
        : [...current.doneMilestones, id],
    }));
  }, []);

  const updateMessage = useCallback(
    (
      conversationId: string,
      messageId: string,
      update: (message: ChatMessage) => ChatMessage,
    ) => {
      setState((current) => ({
        ...current,
        conversations: current.conversations.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                updatedAt: new Date().toISOString(),
                messages: conversation.messages.map((message) =>
                  message.id === messageId ? update(message) : message,
                ),
              }
            : conversation,
        ),
      }));
    },
    [],
  );

  const failAction = useCallback(
    (
      conversationId: string,
      messageId: string,
      reason: string,
    ) => {
      const message = `${reason} Nothing was sent.`;
      updateMessage(conversationId, messageId, (current) => ({
        ...current,
        action: current.action
          ? { ...current.action, status: "failed", error: message }
          : current.action,
      }));
      addActivity({
        type: "approval",
        actor: "Visun",
        title: "Action failed safely",
        detail: message,
        status: "failed",
      });
      return message;
    },
    [addActivity, updateMessage],
  );

  const approveAction = useCallback(
    async (
      conversationId: string,
      messageId: string,
      action: ProposedAction,
    ): Promise<ActionResult> => {
      updateMessage(conversationId, messageId, (message) => ({
        ...message,
        action: message.action
          ? { ...message.action, status: "executing" }
          : message.action,
      }));

      let prepared = action;
      if (!action.canonicalHash) {
        // A draft produced by the offline fallback has no server record yet.
        // Prepare it first so the same approval hash and audit trail apply.
        const result = await api.prepareAction({
          kind: action.kind,
          title: action.title,
          recipient: action.recipient,
          subject: action.subject,
          body: action.body,
          amount: action.amount,
          currency: action.currency,
          provider: action.provider,
          conversation_id: conversationId,
          message_id: messageId,
        });
        if (!result.ok) {
          noteFailure(result.error);
          const message = failAction(conversationId, messageId, result.error);
          return { status: "failed", simulated: false, error: message };
        }
        prepared = result.data.action;
        updateMessage(conversationId, messageId, (message) => ({
          ...message,
          action: prepared,
        }));
      }

      const result = await api.approveAction(
        prepared.id,
        prepared.canonicalHash,
      );
      if (!result.ok) {
        noteFailure(result.error);
        const message = failAction(conversationId, messageId, result.error);
        return { status: "failed", simulated: false, error: message };
      }

      const updated = result.data.action;
      updateMessage(conversationId, messageId, (message) => ({
        ...message,
        action: updated,
      }));

      if (updated.status === "succeeded") {
        addActivity({
          type: updated.kind === "payment_request" ? "payment" : "email",
          actor:
            updated.provider === "PayPal"
              ? "PayPal"
              : updated.provider === "Telegram"
                ? "Telegram"
                : "Gmail",
          title: updated.simulated
            ? `Simulated: ${updated.title}`
            : `${updated.title} executed`,
          detail: updated.simulated
            ? `Simulated ${updated.provider} action. No external request was made. Reference ${updated.providerId ?? "none"}.`
            : `${updated.provider} accepted the request. Provider reference ${updated.providerId ?? "returned by the provider"}.`,
          status: "success",
          reference: updated.id,
        });
      } else if (updated.status === "failed") {
        addActivity({
          type: "approval",
          actor: "Visun",
          title: "Provider action failed",
          detail: updated.error ?? "The provider rejected the request.",
          status: "failed",
          reference: updated.id,
        });
      }

      return {
        status: updated.status,
        providerId: updated.providerId,
        simulated: Boolean(updated.simulated),
        error: updated.error,
      };
    },
    [addActivity, failAction, noteFailure, updateMessage],
  );

  const rejectAction = useCallback(
    async (conversationId: string, messageId: string) => {
      const action = state.conversations
        .find((conversation) => conversation.id === conversationId)
        ?.messages.find((message) => message.id === messageId)?.action;
      updateMessage(conversationId, messageId, (message) => ({
        ...message,
        action: message.action
          ? { ...message.action, status: "rejected" }
          : message.action,
      }));
      if (action?.canonicalHash) {
        const result = await api.rejectAction(action.id);
        if (!result.ok) noteFailure(result.error);
      }
      addActivity({
        type: "approval",
        actor: "You",
        title: "Action rejected",
        detail:
          "The prepared action was rejected. No external request was made.",
        status: "info",
        reference: action?.id,
      });
    },
    [addActivity, noteFailure, state.conversations, updateMessage],
  );

  const addMessage = useCallback(
    (conversationId: string, message: ChatMessage) => {
      setState((current) => ({
        ...current,
        conversations: current.conversations.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                updatedAt: new Date().toISOString(),
                messages: [...conversation.messages, message],
              }
            : conversation,
        ),
      }));
    },
    [],
  );

  const createConversation = useCallback((title: string) => {
    const id = uid("conv");
    setState((current) => ({
      ...current,
      conversations: [
        {
          id,
          title,
          updatedAt: new Date().toISOString(),
          messages: [],
        },
        ...current.conversations,
      ],
    }));
    return id;
  }, []);

  const renameConversation = useCallback(
    (id: string, title: string) => {
      setState((current) => ({
        ...current,
        conversations: current.conversations.map((conversation) =>
          conversation.id === id ? { ...conversation, title } : conversation,
        ),
      }));
      void api.renameConversation(id, title).then((result) => {
        if (!result.ok && result.status !== 404) noteFailure(result.error);
      });
    },
    [noteFailure],
  );

  const deleteConversation = useCallback(
    (id: string) => {
      setState((current) => ({
        ...current,
        conversations: current.conversations.filter(
          (conversation) => conversation.id !== id,
        ),
      }));
      void api.deleteConversation(id).then((result) => {
        if (!result.ok && result.status !== 404) noteFailure(result.error);
      });
    },
    [noteFailure],
  );

  const addLead = useCallback(
    (lead: Lead) => {
      setState((current) => ({
        ...current,
        leads: [lead, ...current.leads],
      }));
      void api.createLead(lead).then((result) => {
        if (!result.ok) {
          noteFailure(result.error);
          return;
        }
        const stored = result.data.lead;
        setState((current) => ({
          ...current,
          leads: current.leads.map((row) =>
            row.id === lead.id ? stored : row,
          ),
        }));
      });
    },
    [noteFailure],
  );

  const moveLead = useCallback(
    async (id: string, stage: LeadStage) => {
      setState((current) => ({
        ...current,
        leads: current.leads.map((lead) =>
          lead.id === id ? { ...lead, stage } : lead,
        ),
      }));
      const result = await api.updateLead(id, { stage });
      if (!result.ok && result.status !== 404) noteFailure(result.error);
    },
    [noteFailure],
  );

  const addReport = useCallback(
    (report: Report) => {
      setState((current) => ({
        ...current,
        reports: [report, ...current.reports],
      }));
      void api.createReport(report).then((result) => {
        if (!result.ok) {
          noteFailure(result.error);
          return;
        }
        const stored = result.data.report;
        setState((current) => ({
          ...current,
          reports: current.reports.map((row) =>
            row.id === report.id ? { ...row, ...stored } : row,
          ),
        }));
      });
    },
    [noteFailure],
  );

  const sendReport = useCallback(
    async (reportId: string, title?: string) => {
      const prepared = await api.prepareReportSend(reportId);
      if (!prepared.ok) {
        noteFailure(prepared.error);
        addActivity({
          type: "report",
          actor: "Visun",
          title: "Report not sent",
          detail: `${prepared.error} Nothing was delivered.`,
          status: "failed",
          reference: reportId,
        });
        return { simulated: false, error: prepared.error };
      }
      const action = prepared.data.action;
      const approved = await api.approveAction(
        action.id,
        action.canonicalHash,
      );
      if (!approved.ok) {
        noteFailure(approved.error);
        addActivity({
          type: "report",
          actor: "Visun",
          title: "Report not sent",
          detail: `${approved.error} Nothing was delivered.`,
          status: "failed",
          reference: reportId,
        });
        return { simulated: false, error: approved.error };
      }
      const result = approved.data.action;
      if (result.status !== "succeeded") {
        const error =
          result.error ?? "The provider rejected the report delivery.";
        addActivity({
          type: "report",
          actor: "Visun",
          title: "Report not sent",
          detail: error,
          status: "failed",
          reference: reportId,
        });
        return { simulated: false, error };
      }
      setState((current) => ({
        ...current,
        reports: current.reports.map((report) =>
          report.id === reportId
            ? {
                ...report,
                status: "sent",
                providerMessageId: result.providerId,
                simulated: Boolean(result.simulated),
              }
            : report,
        ),
      }));
      addActivity({
        type: "report",
        actor: "Gmail",
        title: result.simulated
          ? `Simulated: ${title ?? "Report"} delivery`
          : `${title ?? "Report"} sent`,
        detail: result.simulated
          ? `Simulated Gmail delivery. No email left the workspace. Reference ${result.providerId ?? "none"}.`
          : `Gmail accepted the message. Provider reference ${result.providerId ?? "returned by Gmail"}.`,
        status: "success",
        reference: reportId,
      });
      return {
        providerId: result.providerId,
        simulated: Boolean(result.simulated),
      };
    },
    [addActivity, noteFailure],
  );

  const toggleIntegration = useCallback(
    async (id: string, connected: boolean) => {
      const previous = state.integrations[id];
      setState((current) => ({
        ...current,
        integrations: { ...current.integrations, [id]: connected },
      }));
      const result = await api.toggleIntegration(id, connected);
      if (!result.ok) {
        setState((current) => ({
          ...current,
          integrations: { ...current.integrations, [id]: previous },
        }));
        noteFailure(result.error);
        return { ok: false, error: result.error };
      }
      return { ok: true };
    },
    [noteFailure, state.integrations],
  );

  const updatePreferences = useCallback(
    (update: Partial<Preferences>) => {
      setState((current) => ({
        ...current,
        preferences: { ...current.preferences, ...update },
      }));
      void api.updatePreferences(update).then((result) => {
        if (!result.ok) noteFailure(result.error);
      });
    },
    [noteFailure],
  );

  const recheckPayments = useCallback(async () => {
    const result = await api.recheckPayments();
    if (!result.ok) {
      noteFailure(result.error);
      addActivity({
        type: "payment",
        actor: "PayPal",
        title: "Recheck failed",
        detail: `${result.error} No payment status was changed.`,
        status: "failed",
        reference: "paypal-sync",
      });
      return;
    }
    addActivity({
      type: "payment",
      actor: "PayPal",
      title: result.data.simulated
        ? "Sandbox recheck (simulated)"
        : "PayPal statuses verified",
      detail: result.data.message,
      status: result.data.simulated ? "info" : "success",
      reference: "paypal-sync",
    });
  }, [addActivity, noteFailure]);

  const resetDemo = useCallback(async () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setState(defaultState);
    const result = await api.resetDemo();
    if (!result.ok) {
      noteFailure(result.error);
      return;
    }
    await refresh();
  }, [noteFailure, refresh]);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      hydrated,
      connection,
      connectionError,
      providerMode,
      authMode,
      apiAgent,
      profile,
      isDemo: demo,
      refresh,
      noteApiFailure: noteFailure,
      reviewFinding,
      toggleMilestone,
      addActivity,
      approveAction,
      rejectAction,
      addMessage,
      updateMessage,
      createConversation,
      renameConversation,
      deleteConversation,
      addLead,
      moveLead,
      addReport,
      sendReport,
      toggleIntegration,
      updatePreferences,
      recheckPayments,
      resetDemo,
    }),
    [
      state,
      hydrated,
      connection,
      connectionError,
      providerMode,
      authMode,
      apiAgent,
      profile,
      demo,
      refresh,
      noteFailure,
      reviewFinding,
      toggleMilestone,
      addActivity,
      approveAction,
      rejectAction,
      addMessage,
      updateMessage,
      createConversation,
      renameConversation,
      deleteConversation,
      addLead,
      moveLead,
      addReport,
      sendReport,
      toggleIntegration,
      updatePreferences,
      recheckPayments,
      resetDemo,
    ],
  );

  // An authenticated workspace never falls back to seeded demo data. It either
  // loads the signed-in user's records or reports that the API is unreachable.
  // Only the first load is gated, so a failed background refresh keeps the
  // already-verified workspace on screen.
  if (authenticated && !workspaceLoaded) {
    const failed = connection === "offline";
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
        <div className="w-full max-w-md rounded-3xl border border-[#e0dbd2] bg-white p-8 text-center shadow-neu-md">
          <p className="text-[15px] font-semibold text-ink">
            {failed ? "We couldn't load your workspace" : "Loading your workspace…"}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            {failed
              ? connectionError ?? "The API is unreachable. Try again in a moment."
              : "Fetching your projects, payments, and conversations from Visun."}
          </p>
          {failed ? (
            <button
              type="button"
              onClick={() => void refresh()}
              className="mt-6 inline-flex h-10 items-center justify-center rounded-xl border border-[#e24f00] bg-orange px-5 text-[12.5px] font-semibold text-ink transition hover:bg-[#ff5c0a]"
            >
              Try again
            </button>
          ) : (
            <div className="mx-auto mt-6 h-1 w-24 overflow-hidden rounded-full bg-[#f1ede5]">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-orange" />
            </div>
          )}
        </div>
      </div>
    );
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useAppStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useAppStore must be used inside AppStoreProvider");
  }
  return context;
}
