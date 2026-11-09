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
import { defaultState, emptyReference, workspace as demoWorkspace } from "./demo-data";
import type {
  ActionStatus,
  ActivityEvent,
  AppState,
  ChatMessage,
  Lead,
  LeadStage,
  MilestoneStatus,
  Preferences,
  ProjectStatus,
  ProposedAction,
  Report,
  ReviewState,
} from "./types";
import { uid } from "./utils";

const STORAGE_KEY = "visun.demo.state.v1";

/**
 * A signed-in workspace starts blank. Nothing from the seeded demo may render
 * before the user's own snapshot arrives, and a missing snapshot never falls
 * back to sample records.
 */
const emptyState: AppState = {
  version: defaultState.version,
  reference: emptyReference,
  findingReviews: {},
  actions: {},
  integrations: {},
  leads: [],
  reports: [],
  conversations: [],
  activities: [],
  doneMilestones: [],
  preferences: defaultState.preferences,
};

type ActivityInput = Omit<ActivityEvent, "id" | "at"> & { at?: string };

/** Everything a person can type into the New/Edit project dialog. */
export type ProjectDraft = {
  name: string;
  status: ProjectStatus;
  budget: number;
  dueAt: string;
  description?: string;
  codename?: string;
  /** An existing client, or the three fields below for a new one. */
  clientId?: string;
  clientName?: string;
  clientCompany?: string;
  clientEmail?: string;
};

export type MilestoneDraft = {
  title: string;
  dueAt: string;
  status?: MilestoneStatus;
  acceptance?: string;
  value?: number;
};

export type MutationResult = { ok: boolean; error?: string };

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
  profile: {
    name: string;
    email: string;
    workspace: string;
    plan: string;
  };
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
  createProject: (draft: ProjectDraft) => Promise<MutationResult>;
  updateProject: (id: string, draft: ProjectDraft) => Promise<MutationResult>;
  deleteProject: (id: string) => Promise<MutationResult>;
  createMilestone: (
    projectId: string,
    draft: MilestoneDraft,
  ) => Promise<MutationResult>;
  updateMilestone: (
    id: string,
    draft: MilestoneDraft,
  ) => Promise<MutationResult>;
  deleteMilestone: (id: string) => Promise<MutationResult>;
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
  const [state, setState] = useState<AppState>(() =>
    authenticated ? emptyState : defaultState,
  );
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
    plan: demoWorkspace.plan,
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
    // Reference records (clients, projects, milestones, invoices, findings) come
    // from the same workspace snapshot, so no screen falls back to sample data.
    setState({
      ...snapshot.state,
      reference:
        snapshot.reference ??
        (authenticated ? emptyReference : defaultState.reference),
    });
    setProviderMode(snapshot.providerMode);
    setAuthMode(snapshot.authMode);
    setApiAgent(snapshot.agent?.backend ?? "deterministic");
    setProfile({
      name: snapshot.user.name,
      email: snapshot.user.email,
      workspace: snapshot.workspace.name,
      plan: snapshot.workspace.plan || "Workspace",
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
  }, [authenticated, storageKey]);

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
          // A cache written before `reference` existed must not leave the app
          // without workspace records; the server snapshot replaces it anyway.
          setState({
            ...defaultState,
            ...parsed,
            reference: parsed.reference ?? defaultState.reference,
          });
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

  const createProject = useCallback(
    async (draft: ProjectDraft): Promise<MutationResult> => {
      const result = await api.createProject({
        name: draft.name.trim(),
        client_id: draft.clientId || undefined,
        client_name: draft.clientId ? undefined : draft.clientName?.trim(),
        client_company: draft.clientId
          ? undefined
          : draft.clientCompany?.trim(),
        client_email: draft.clientId ? undefined : draft.clientEmail?.trim(),
        codename: draft.codename?.trim() || undefined,
        description: draft.description?.trim(),
        status: draft.status,
        budget: draft.budget,
        due_at: draft.dueAt || null,
      });
      if (!result.ok) {
        noteFailure(result.error);
        return { ok: false, error: result.error };
      }
      const { project, client } = result.data;
      setState((current) => ({
        ...current,
        reference: {
          ...current.reference,
          projects: [...current.reference.projects, project].sort((a, b) =>
            a.dueAt.localeCompare(b.dueAt),
          ),
          clients: current.reference.clients.some(
            (row) => row.id === client.id,
          )
            ? current.reference.clients
            : [...current.reference.clients, client],
        },
      }));
      return { ok: true };
    },
    [noteFailure],
  );

  const updateProject = useCallback(
    async (id: string, draft: ProjectDraft): Promise<MutationResult> => {
      const result = await api.updateProject(id, {
        name: draft.name.trim(),
        client_id: draft.clientId || undefined,
        codename: draft.codename?.trim() || undefined,
        description: draft.description?.trim(),
        status: draft.status,
        budget: draft.budget,
        due_at: draft.dueAt || null,
      });
      if (!result.ok) {
        noteFailure(result.error);
        return { ok: false, error: result.error };
      }
      const updated = result.data.project;
      setState((current) => ({
        ...current,
        reference: {
          ...current.reference,
          projects: current.reference.projects.map((project) =>
            project.id === id ? { ...project, ...updated } : project,
          ),
        },
      }));
      return { ok: true };
    },
    [noteFailure],
  );

  const deleteProject = useCallback(
    async (id: string): Promise<MutationResult> => {
      const result = await api.deleteProject(id);
      if (!result.ok) {
        noteFailure(result.error);
        return { ok: false, error: result.error };
      }
      setState((current) => ({
        ...current,
        reference: {
          ...current.reference,
          projects: current.reference.projects.filter(
            (project) => project.id !== id,
          ),
          milestones: current.reference.milestones.filter(
            (milestone) => milestone.projectId !== id,
          ),
          invoices: current.reference.invoices.filter(
            (invoice) => invoice.projectId !== id,
          ),
          scopeFindings: current.reference.scopeFindings.filter(
            (finding) => finding.projectId !== id,
          ),
          messages: current.reference.messages.filter(
            (message) => message.projectId !== id,
          ),
          agreements: current.reference.agreements.filter(
            (agreement) => agreement.projectId !== id,
          ),
        },
        reports: current.reports.filter(
          (report) => report.projectId !== id,
        ),
        doneMilestones: current.doneMilestones.filter((milestoneId) =>
          current.reference.milestones.some(
            (milestone) =>
              milestone.id === milestoneId && milestone.projectId !== id,
          ),
        ),
      }));
      return { ok: true };
    },
    [noteFailure],
  );

  const createMilestone = useCallback(
    async (
      projectId: string,
      draft: MilestoneDraft,
    ): Promise<MutationResult> => {
      const result = await api.createMilestone(projectId, {
        title: draft.title.trim(),
        due_at: draft.dueAt,
        status: draft.status,
        acceptance: draft.acceptance?.trim(),
        value: draft.value,
      });
      if (!result.ok) {
        noteFailure(result.error);
        return { ok: false, error: result.error };
      }
      const milestone = result.data.milestone;
      setState((current) => ({
        ...current,
        reference: {
          ...current.reference,
          milestones: [...current.reference.milestones, milestone].sort(
            (a, b) => a.dueAt.localeCompare(b.dueAt),
          ),
        },
      }));
      return { ok: true };
    },
    [noteFailure],
  );

  const updateMilestone = useCallback(
    async (id: string, draft: MilestoneDraft): Promise<MutationResult> => {
      const result = await api.updateMilestone(id, {
        title: draft.title.trim(),
        due_at: draft.dueAt,
        status: draft.status,
        acceptance: draft.acceptance?.trim(),
        value: draft.value,
      });
      if (!result.ok) {
        noteFailure(result.error);
        return { ok: false, error: result.error };
      }
      const milestone = result.data.milestone;
      setState((current) => ({
        ...current,
        reference: {
          ...current.reference,
          milestones: current.reference.milestones
            .map((row) => (row.id === id ? { ...row, ...milestone } : row))
            .sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
        },
      }));
      return { ok: true };
    },
    [noteFailure],
  );

  const deleteMilestone = useCallback(
    async (id: string): Promise<MutationResult> => {
      const result = await api.deleteMilestone(id);
      if (!result.ok) {
        noteFailure(result.error);
        return { ok: false, error: result.error };
      }
      setState((current) => ({
        ...current,
        reference: {
          ...current.reference,
          milestones: current.reference.milestones.filter(
            (milestone) => milestone.id !== id,
          ),
        },
        doneMilestones: current.doneMilestones.filter(
          (milestoneId) => milestoneId !== id,
        ),
      }));
      return { ok: true };
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
    setState(authenticated ? emptyState : defaultState);
    const result = await api.resetDemo();
    if (!result.ok) {
      noteFailure(result.error);
      return;
    }
    await refresh();
  }, [authenticated, noteFailure, refresh]);

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
      createProject,
      updateProject,
      deleteProject,
      createMilestone,
      updateMilestone,
      deleteMilestone,
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
      createProject,
      updateProject,
      deleteProject,
      createMilestone,
      updateMilestone,
      deleteMilestone,
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
