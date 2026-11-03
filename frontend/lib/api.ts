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
  ChatMessage,
  Lead,
  LeadStage,
  Preferences,
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
  providers?: Record<string, ProviderStatus>;
  agent?: {
    backend: "deterministic" | "gemini";
    geminiConfigured: boolean;
    groundedTools: boolean;
  };
};

export type HealthResponse = {
  status: "ok" | "degraded";
  time: string;
  environment: string;
  database: string;
  authMode: "demo" | "clerk";
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

async function request<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = 4500,
): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
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

  prepareReportSend: (id: string) =>
    request<{ action: ProposedAction }>(`/reports/${id}/send`, {
      method: "POST",
    }),

  toggleIntegration: (provider: string, connected: boolean) =>
    request<{ integration: unknown }>(
      `/integrations/${provider}/toggle?connected=${connected}`,
      { method: "POST" },
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
