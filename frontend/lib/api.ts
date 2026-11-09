"use client";

/**
 * Typed client for the FastAPI backend.
 *
 * The browser talks to `/api/backend/*`, which Next.js rewrites to the API. In
 * local development the backend runs at http://localhost:8000 with demo auth.
 * Nothing here invents provider results: a failed request surfaces as `ok:
 * false` so the store can show an honest local fallback state.
 */

import type {
  ActivityEvent,
  AppState,
  WorkspaceReference,
  ChatMessage,
  Client,
  Lead,
  LeadStage,
  Milestone,
  Preferences,
  Project,
  ProposedAction,
  Report,
} from "./types";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

export type ProviderStatus = {
  mode: "simulated" | "real";
  configured: boolean;
};

export type BootstrapResponse = {
  generatedAt: string;
  sample: boolean;
  providerMode: "simulated" | "real";
  authMode: "demo" | "clerk";
  publicDemo?: boolean;
  workspace: {
    id: string;
    name: string;
    owner: string;
    email: string;
    timezone: string;
    plan: string;
  };
  user: { id: string; name: string; email: string; timezone: string };
  state: AppState;
  reference?: WorkspaceReference;
  providers?: Record<string, ProviderStatus>;
  agent?: {
    backend: "deterministic" | "gemini";
    geminiConfigured: boolean;
    groundedTools: boolean;
  };
};

export type CredentialField = {
  key: string;
  label: string;
  envVar: string;
  secret?: boolean;
  options?: string[];
  default?: string;
  placeholder?: string;
  configured: boolean;
  preview: string | null;
  value: string | null;
};

export type CredentialStatus = {
  provider: string;
  label: string;
  docs: string;
  fields: CredentialField[];
  /** Where a provider call would read its keys from right now. */
  source: "workspace" | "environment" | null;
  configured: boolean;
  encryptionReady: boolean;
  updatedAt: string | null;
};

export type ReportPreview = {
  projectId: string | null;
  workspaceId: string;
  label: string;
  title: string;
  period: string;
  facts: string[];
  summary: string;
  narrative: string;
  sources: Record<string, { kind: string; id: string; label: string }[]>;
  empty: boolean;
};

export type ProviderTestResult = {
  provider: string;
  source: "workspace" | "environment" | null;
  ok: boolean;
  detail: string;
  identity: string | null;
  checkedAt: string;
};

export type HealthResponse = {
  status: "ok" | "degraded";
  time: string;
  environment: string;
  database: string;
  authMode: "demo" | "clerk";
  publicDemo?: boolean;
  providerMode: "simulated" | "real";
  providers: Record<string, ProviderStatus>;
  agent: { backend: string; geminiConfigured: boolean };
  voice: { backend: string; configured: boolean; model: string | null };
};

export type AgentChatResponse = {
  conversationId: string;
  conversationTitle: string;
  message: ChatMessage;
  action: ProposedAction | null;
  backend: string;
  grounded: boolean;
  sample: boolean;
  providerMode: "simulated" | "real";
  tools: NonNullable<ChatMessage["tools"]>;
  sources: NonNullable<ChatMessage["sources"]>;
};

const BASE = "/api/backend";

type ApiAuth = {
  /** Returns a Clerk session token for the current browser session. */
  getToken?: () => Promise<string | null>;
  /** Sends the public-demo header instead of a bearer token. */
  demo?: boolean;
};

let apiAuth: ApiAuth = {};

/**
 * Providers configure auth from a `useEffect`, while page components can fire
 * their own requests from child effects that run first. Without a gate the very
 * first credential-status call leaves before the demo header / bearer token is
 * wired and the backend answers 401. Track readiness and let early requests
 * wait for the provider instead of guessing.
 */
let apiAuthReady = false;
let authWaiters: Array<() => void> = [];
const AUTH_WAIT_MS = 1200;

function releaseAuthWaiters() {
  const waiters = authWaiters;
  authWaiters = [];
  for (const resolve of waiters) resolve();
}

/** Resolves once a provider has configured auth, or after a short fallback. */
function waitForApiAuth(): Promise<void> {
  if (apiAuthReady) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      authWaiters = authWaiters.filter((waiter) => waiter !== done);
      resolve();
    }, AUTH_WAIT_MS);
    authWaiters.push(done);
  });
}

/**
 * Wired by the workspace providers. Clerk mode forwards a short-lived bearer
 * token; demo mode sends `X-Visun-Demo` so a Clerk-protected deployment can
 * still expose the seeded demo workspace when `ALLOW_PUBLIC_DEMO=true`.
 */
export function configureApiAuth(next: ApiAuth | null) {
  apiAuth = next ?? {};
  apiAuthReady = next !== null;
  if (next) releaseAuthWaiters();
}

/** Attaches the configured credential once the provider has settled. */
async function applyAuthHeaders(headers: Headers): Promise<void> {
  await waitForApiAuth();
  if (apiAuth.demo) {
    headers.set("X-Visun-Demo", "1");
  } else if (apiAuth.getToken) {
    try {
      const token = await apiAuth.getToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
    } catch {
      // Clerk may not have hydrated yet. The backend returns 401 and the store
      // surfaces an honest offline state instead of inventing data.
    }
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = 4500,
): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    await applyAuthHeaders(headers);

    const response = await fetch(`${BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers,
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as
      | (T & { error?: { message?: string } })
      | null;
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error:
          payload?.error?.message ??
          `Backend returned ${response.status} without a readable message.`,
      };
    }
    return { ok: true, data: payload as T };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof DOMException && error.name === "AbortError"
          ? "Backend request timed out."
          : "Backend is unreachable. Local demo data is still usable.",
    };
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  health: () => request<HealthResponse>("/health", {}, 2500),

  bootstrap: () => request<BootstrapResponse>("/bootstrap"),

  agentChat: (payload: {
    conversation_id?: string;
    message: string;
    modality?: "text" | "voice";
    project_id?: string;
    client_message_id?: string;
    client_message_at?: string;
    title?: string;
  }) =>
    request<AgentChatResponse>("/agent/chat", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  prepareAction: (payload: {
    kind: ProposedAction["kind"];
    title: string;
    recipient?: string;
    subject?: string;
    body?: string;
    amount?: number;
    currency?: string;
    provider?: string;
    conversation_id?: string;
    message_id?: string;
  }) =>
    request<{ action: ProposedAction }>("/actions/prepare", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  approveAction: (id: string, expectedHash?: string) =>
    request<{
      action: ProposedAction;
      simulated: boolean;
      providerMode: string;
    }>(`/actions/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ expected_hash: expectedHash ?? null }),
    }),

  rejectAction: (id: string, reason = "") =>
    request<{ action: ProposedAction }>(
      `/actions/${id}/reject?reason=${encodeURIComponent(reason)}`,
      { method: "POST" },
    ),

  reviewFinding: (id: string, reviewState: string) =>
    request<{ finding: unknown }>(`/scope-findings/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ review_state: reviewState }),
    }),

  createLead: (lead: Lead) =>
    request<{ lead: Lead }>("/leads", {
      method: "POST",
      body: JSON.stringify({
        name: lead.name,
        company: lead.company,
        email: lead.email,
        source: lead.source,
        stage: lead.stage,
        interest: lead.interest,
        next_action: lead.nextAction,
        value: lead.value,
      }),
    }),

  updateLead: (id: string, update: { stage?: LeadStage; next_action?: string }) =>
    request<{ lead: Lead }>(`/leads/${id}`, {
      method: "PATCH",
      body: JSON.stringify(update),
    }),

  createProject: (payload: {
    name: string;
    client_id?: string;
    client_name?: string;
    client_company?: string;
    client_email?: string;
    codename?: string;
    description?: string;
    status?: Project["status"];
    currency?: string;
    budget?: number;
    due_at?: string | null;
  }) =>
    request<{ project: Project; client: Client }>("/projects", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateProject: (
    id: string,
    payload: {
      name?: string;
      codename?: string;
      description?: string;
      status?: Project["status"];
      currency?: string;
      budget?: number;
      due_at?: string | null;
      client_id?: string;
    },
  ) =>
    request<{ project: Project }>(`/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteProject: (id: string) =>
    request<{ deleted: boolean; id: string }>(`/projects/${id}`, {
      method: "DELETE",
    }),

  createMilestone: (
    projectId: string,
    payload: {
      title: string;
      due_at: string;
      status?: Milestone["status"];
      value?: number;
      acceptance?: string;
    },
  ) =>
    request<{ milestone: Milestone }>(`/projects/${projectId}/milestones`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateMilestone: (
    id: string,
    payload: {
      title?: string;
      due_at?: string;
      status?: Milestone["status"];
      value?: number;
      acceptance?: string;
    },
  ) =>
    request<{ milestone: Milestone }>(`/milestones/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteMilestone: (id: string) =>
    request<{ deleted: boolean; id: string }>(`/milestones/${id}`, {
      method: "DELETE",
    }),

  createReport: (report: Report) =>
    request<{ report: Report }>("/reports", {
      method: "POST",
      body: JSON.stringify({
        project_id: report.projectId,
        title: report.title,
        period: report.period,
        summary: report.summary,
        pages: report.pages,
      }),
    }),

  previewReport: (payload: {
    project_id?: string | null;
    period?: string | null;
    include_narrative?: boolean;
  }) =>
    request<ReportPreview>("/reports/preview", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  prepareReportSend: (id: string) =>
    request<{ action: ProposedAction }>(`/reports/${id}/send`, {
      method: "POST",
    }),

  /** Fetch the server-rendered PDF for a stored report. */
  downloadReport: async (
    id: string,
  ): Promise<{ ok: true; blob: Blob; filename: string } | { ok: false; error: string }> => {
    try {
      const headers = new Headers();
      await applyAuthHeaders(headers);
      const response = await fetch(`${BASE}/reports/${id}/pdf`, {
        headers,
        cache: "no-store",
      });
      if (!response.ok) {
        return { ok: false, error: `Report download failed (HTTP ${response.status}).` };
      }
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = /filename="?([^";]+)"?/.exec(disposition);
      return {
        ok: true,
        blob: await response.blob(),
        filename: match?.[1] ?? `report-${id}.pdf`,
      };
    } catch {
      return { ok: false, error: "The backend is unreachable. Nothing was downloaded." };
    }
  },

  toggleIntegration: (provider: string, connected: boolean) =>
    request<{ integration: unknown }>(
      `/integrations/${provider}/toggle?connected=${connected}`,
      { method: "POST" },
    ),

  credentialStatus: (provider: string) =>
    request<CredentialStatus>(`/integrations/${provider}/credentials`),

  saveCredentials: (provider: string, values: Record<string, string>) =>
    request<CredentialStatus>(`/integrations/${provider}/credentials`, {
      method: "PUT",
      body: JSON.stringify({ values }),
    }),

  clearCredentials: (provider: string) =>
    request<CredentialStatus & { removed: boolean }>(
      `/integrations/${provider}/credentials`,
      { method: "DELETE" },
    ),

  /** Real read-only call to the provider; allow time for the network. */
  testProvider: (provider: string) =>
    request<ProviderTestResult>(
      `/integrations/${provider}/test`,
      { method: "POST" },
      20000,
    ),

  updatePreferences: (update: Partial<Preferences>) =>
    request<{ preferences: Preferences }>("/preferences", {
      method: "PATCH",
      body: JSON.stringify(update),
    }),

  recheckPayments: () =>
    request<{
      simulated: boolean;
      checked: number;
      updated: unknown[];
      message: string;
    }>("/payments/recheck", { method: "POST" }),

  createConversation: (title: string) =>
    request<{ conversation: unknown }>("/conversations", {
      method: "POST",
      body: JSON.stringify({ title }),
    }),

  renameConversation: (id: string, title: string) =>
    request<{ conversation: { id: string; title: string } }>(
      `/conversations/${id}`,
      { method: "PATCH", body: JSON.stringify({ title }) },
    ),

  deleteConversation: (id: string) =>
    request<{ deleted: boolean }>(`/conversations/${id}`, { method: "DELETE" }),

  resetDemo: () =>
    request<{ reset: boolean; sample: boolean }>("/reset-demo", {
      method: "POST",
    }),

  createActivity: (event: Omit<ActivityEvent, "id" | "at"> & { at?: string }) =>
    request<{ activity: ActivityEvent }>("/activities", {
      method: "POST",
      body: JSON.stringify({
        type: event.type,
        actor: event.actor,
        title: event.title,
        detail: event.detail,
        status: event.status,
        reference: event.reference ?? null,
        project_id: event.projectId ?? null,
      }),
    }),
};
