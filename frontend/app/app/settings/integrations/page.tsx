"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  KeyRound,
  Link2,
  Mail,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Unplug,
  Wallet,
} from "lucide-react";
import {
  Badge,
  Button,
  Modal,
  Panel,
  useToast,
} from "@/components/ui";
import {
  api,
  type CredentialField,
  type CredentialStatus,
  type ProviderTestResult,
} from "@/lib/api";
import { integrations as integrationCatalog } from "@/lib/demo-data";
import { useAppStore } from "@/lib/store";
import type { Integration } from "@/lib/types";
import { cn, formatDate, formatTime, relativeTime, sleep } from "@/lib/utils";

const icons: Record<string, typeof Mail> = {
  paypal: Wallet,
  gmail: Mail,
  telegram: Send,
  gcal: CalendarDays,
  discord: MessageSquare,
};

const toneStyles: Record<Integration["tone"], string> = {
  orange: "border-[#f5c7ab] bg-[#ffe7d9] text-[#a63b00]",
  ink: "border-[#d9d5cd] bg-[#efede8] text-ink",
  stone: "border-[#d6d1c7] bg-stone text-ink",
  yellow: "border-[#e5c95e] bg-yellow text-ink",
};

const limitations = [
  {
    title: "Telegram reads opted-in groups only",
    detail:
      "A bot can only see messages in groups where it was explicitly added and granted access. It cannot read personal chats or other groups.",
  },
  {
    title: "No WhatsApp personal-chat reading",
    detail:
      "WhatsApp Cloud API handles messages users send to a business number plus approved templates. It does not expose arbitrary personal conversations, so Visun does not offer it here.",
  },
  {
    title: "Discord is allowlisted",
    detail:
      "Only channels you name during setup are ingested. Everything else stays invisible to Visun.",
  },
  {
    title: "Writes need your approval",
    detail:
      "Gmail, Google Calendar, and PayPal write scopes are only used after you approve the exact payload in the copilot. Read scopes never send anything.",
  },
];

export default function IntegrationsPage() {
  const { state, profile, toggleIntegration, addActivity } = useAppStore();
  const integrations = integrationCatalog.map((item) => {
    const persisted = state.reference.integrations.find(
      (row) => row.id === item.id,
    );
    return {
      ...item,
      // Provider names and scopes are static product copy, but demo-specific
      // labels (such as opted-in group names) must never leak into a workspace
      // that has no connection rows of its own.
      env: persisted?.env ?? "Not connected",
      connected: state.integrations[item.id] ?? persisted?.connected ?? false,
      lastSync: persisted?.lastSync ?? null,
    };
  });
  const { push } = useToast();
  const [target, setTarget] = useState<Integration | null>(null);
  const [mode, setMode] = useState<"connect" | "revoke">("connect");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);

  // Live credential configuration for one provider at a time.
  const [credentialFor, setCredentialFor] = useState<Integration | null>(null);
  const [credentialStatus, setCredentialStatus] = useState<CredentialStatus | null>(null);
  const [credentialValues, setCredentialValues] = useState<Record<string, string>>({});
  const [credentialBusy, setCredentialBusy] = useState(false);
  const [credentialError, setCredentialError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<ProviderTestResult | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  // AI model configuration (Google Gemini), stored encrypted per workspace.
  const [aiStatus, setAiStatus] = useState<CredentialStatus | null>(null);
  const [aiValues, setAiValues] = useState<Record<string, string>>({});
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiTest, setAiTest] = useState<ProviderTestResult | null>(null);

  const loadAi = useCallback(async () => {
    const result = await api.credentialStatus("gemini");
    if (result.ok) {
      setAiStatus(result.data);
      setAiError(null);
    } else {
      setAiError(result.error);
    }
  }, []);

  useEffect(() => {
    void loadAi();
  }, [loadAi]);

  const saveAi = async () => {
    setAiBusy(true);
    setAiError(null);
    const result = await api.saveCredentials("gemini", aiValues);
    setAiBusy(false);
    if (!result.ok) {
      setAiError(result.error);
      return;
    }
    setAiStatus(result.data);
    setAiValues({});
    push({
      tone: "success",
      title: "AI configuration saved",
      detail: "The key is encrypted on the server. Run Test connection to validate the models.",
    });
  };

  const testAi = async () => {
    setAiBusy(true);
    setAiError(null);
    const result = await api.testProvider("gemini");
    setAiBusy(false);
    if (!result.ok) {
      setAiError(result.error);
      return;
    }
    setAiTest(result.data);
    push({
      tone: result.data.ok ? "success" : "error",
      title: result.data.ok ? "Gemini configuration valid" : "Gemini test failed",
      detail: result.data.detail,
    });
  };

  const clearAi = async () => {
    setAiBusy(true);
    setAiError(null);
    const result = await api.clearCredentials("gemini");
    setAiBusy(false);
    if (!result.ok) {
      setAiError(result.error);
      return;
    }
    setAiStatus(result.data);
    setAiValues({});
    setAiTest(null);
    push({
      tone: "info",
      title: "AI configuration removed",
      detail: "Stored values were deleted. Environment variables still apply if present.",
    });
  };

  const isConnected = (integration: Integration) =>
    state.integrations[integration.id] ?? integration.connected;

  const connectedCount = integrations.filter(isConnected).length;

  const openConnect = (integration: Integration) => {
    setTarget(integration);
    setMode("connect");
    setAcknowledged(false);
  };

  const openRevoke = (integration: Integration) => {
    setTarget(integration);
    setMode("revoke");
    setAcknowledged(false);
  };

  const close = () => {
    if (busy) return;
    setTarget(null);
    setAcknowledged(false);
  };

  const confirm = async () => {
    if (!target) return;
    setBusy(true);
    await sleep(500);
    const connecting = mode === "connect";
    const result = await toggleIntegration(target.id, connecting);
    setBusy(false);
    if (!result.ok) {
      push({
        tone: "error",
        title: "Connection not changed",
        detail: `${result.error ?? "The backend rejected the change."} The previous state was kept, so nothing was linked.`,
      });
      setTarget(null);
      setAcknowledged(false);
      return;
    }
    addActivity({
      type: "integration",
      actor: "Visun",
      title: connecting
        ? `${target.name} enabled in sandbox`
        : `${target.name} disconnected`,
      detail: connecting
        ? `${target.name} was enabled in the backend workspace. Provider mode is simulated, so no live credential was exchanged; environment remains ${target.env}.`
        : `${target.name} access was revoked in the backend workspace. Existing project data is untouched.`,
      status: connecting ? "success" : "info",
      reference: `integration-${target.id}`,
    });
    setTarget(null);
    setAcknowledged(false);
    push({
      tone: connecting ? "info" : "success",
      title: connecting ? `${target.name} enabled (sandbox)` : `${target.name} revoked`,
      detail: connecting
        ? "The backend recorded the connection, but provider mode is simulated. No OAuth window opened and no real account was linked."
        : "The backend revoked local access. Nothing was deleted from your projects.",
    });
  };

  /** Real, read-only call to the provider with the resolved credentials. */
  const runTest = async (integration: Integration) => {
    setTesting(integration.id);
    setTestResult(null);
    const result = await api.testProvider(integration.id);
    setTesting(null);
    if (!result.ok) {
      push({
        tone: "error",
        title: `${integration.name} test did not run`,
        detail: result.error,
      });
      return null;
    }
    setTestResult(result.data);
    push({
      tone: result.data.ok ? "success" : "error",
      title: result.data.ok
        ? `${integration.name} verified`
        : `${integration.name} test failed`,
      detail: result.data.detail,
    });
    return result.data;
  };

  const openCredentials = async (integration: Integration) => {
    setCredentialFor(integration);
    setCredentialStatus(null);
    setCredentialValues({});
    setCredentialError(null);
    setTestResult(null);
    const result = await api.credentialStatus(integration.id);
    if (!result.ok) {
      setCredentialError(result.error);
      return;
    }
    setCredentialStatus(result.data);
  };

  const closeCredentials = () => {
    if (credentialBusy) return;
    setCredentialFor(null);
    setCredentialStatus(null);
    setCredentialValues({});
    setCredentialError(null);
    setTestResult(null);
  };

  const saveCredentials = async () => {
    if (!credentialFor) return;
    setCredentialBusy(true);
    setCredentialError(null);
    const result = await api.saveCredentials(credentialFor.id, credentialValues);
    setCredentialBusy(false);
    if (!result.ok) {
      setCredentialError(result.error);
      return;
    }
    setCredentialStatus(result.data);
    setCredentialValues({});
    push({
      tone: "success",
      title: `${credentialFor.name} credentials saved`,
      detail: "Encrypted for this workspace. Run Test connection to confirm they work.",
    });
  };

  const clearCredentials = async () => {
    if (!credentialFor) return;
    setCredentialBusy(true);
    setCredentialError(null);
    const result = await api.clearCredentials(credentialFor.id);
    setCredentialBusy(false);
    if (!result.ok) {
      setCredentialError(result.error);
      return;
    }
    setCredentialStatus(result.data);
    setCredentialValues({});
    setTestResult(null);
    push({
      tone: "info",
      title: `${credentialFor.name} credentials removed`,
      detail: "Stored values were deleted. Values from backend/.env still apply if present.",
    });
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="eyebrow">Settings</p>
            <Badge tone="yellow" className="!py-0.5 !text-[9.5px]">
              Sandbox · Demo
            </Badge>
          </div>
          <h2 className="mt-1.5 text-[clamp(1.8rem,2.8vw,2.3rem)] font-semibold leading-tight tracking-[-0.035em]">
            Integrations
          </h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">
            Connect only what you need. Every scope is listed before access is
            granted, and write actions still require approval per payload.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="success" dot>
            {connectedCount} of {integrations.length} connected
          </Badge>
          <Badge tone="neutral">
            Workspace · {profile.workspace}
          </Badge>
        </div>
      </section>

      <Panel className="flex flex-wrap items-start gap-3 border-[#e7cf6f] bg-[#fffdf4] p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#e7cf6f] bg-yellow text-ink">
          <ShieldAlert size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold">
            Read this before connecting anything
          </p>
          <p className="mt-0.5 max-w-3xl text-[11px] leading-relaxed text-muted">
            No real OAuth flow runs in this demo. The buttons below flip local
            state so you can see the full connected experience. In production,
            tokens would be encrypted server-side and every scope would be shown
            on the provider&apos;s consent screen.
          </p>
        </div>
      </Panel>


      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#ece8e0] px-5 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="eyebrow !text-[9px]">AI model configuration</p>
              <Badge tone={aiStatus?.configured ? "success" : "neutral"} dot={aiStatus?.configured}>
                {aiStatus?.configured
                  ? aiStatus?.source === "workspace"
                    ? "Configured in this workspace"
                    : "Using environment values"
                  : "Not configured"}
              </Badge>
              {aiStatus?.configured && !aiStatus?.fields.find((field) => field.key === "live_model")?.configured ? (
                <Badge tone="warning">Voice unavailable</Badge>
              ) : null}
            </div>
            <p className="mt-1 text-[12px] font-semibold">Google Gemini for Copilot text and voice</p>
            <p className="mt-1 max-w-2xl text-[10.5px] leading-relaxed text-muted">
              The API key is encrypted with APP_ENCRYPTION_KEY and scoped to this
              workspace. It is never returned to the browser. Model IDs are
              validated against Google&apos;s model list — a name containing
              &quot;live&quot; is not enough for voice.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => void testAi()} loading={aiBusy}>
              <RefreshCw size={12} /> Test connection
            </Button>
            {aiStatus?.source === "workspace" ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void clearAi()}
                disabled={aiBusy}
                className="!text-[#8f2f28] hover:!bg-[#fbe9e7]"
              >
                Remove
              </Button>
            ) : null}
          </div>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          {(aiStatus?.fields ?? []).map((field) => (
            <label key={field.key} className={cn("block", field.key === "api_key" && "sm:col-span-2")}>
              <span className="flex items-center justify-between gap-2">
                <span className="text-[11.5px] font-semibold">
                  {field.label}
                  {field.key === "live_model" ? (
                    <span className="ml-1 text-[9px] font-normal text-muted">optional</span>
                  ) : null}
                </span>
                <span className="font-mono text-[8.5px] text-[#a19b91]">{field.envVar}</span>
              </span>
              <input
                type={field.secret ? "password" : "text"}
                autoComplete="off"
                spellCheck={false}
                value={aiValues[field.key] ?? (field.secret ? "" : field.value ?? "")}
                placeholder={
                  field.configured
                    ? field.preview ?? "Saved — leave blank to keep"
                    : field.placeholder ?? "Enter a value"
                }
                onChange={(event) =>
                  setAiValues((current) => ({ ...current, [field.key]: event.target.value }))
                }
                className="mt-1.5 h-9 w-full rounded-lg border border-[#e2ddd3] bg-white px-2.5 font-mono text-[11px] text-ink outline-none focus:border-[#c9c2b5]"
              />
              {field.configured ? (
                <span className="mt-1 block text-[9px] text-[#a19b91]">
                  Currently set{field.preview ? ` · ${field.preview}` : ""}
                </span>
              ) : null}
            </label>
          ))}
          {!aiStatus ? (
            <p className="text-[11px] text-muted">Loading AI configuration…</p>
          ) : null}
        </div>
        {aiError ? (
          <div className="mx-5 mb-4 flex items-start gap-2 rounded-xl border border-[#ecc9c4] bg-[#fbe9e7] p-3">
            <ShieldAlert size={14} className="mt-0.5 shrink-0 text-danger" />
            <p className="text-[10.5px] leading-relaxed text-[#7d2a24]">{aiError}</p>
          </div>
        ) : null}
        {aiTest ? (
          <div
            className={cn(
              "mx-5 mb-4 flex items-start gap-2 rounded-xl border p-3",
              aiTest.ok ? "border-[#c9e3d4] bg-[#f0f9f4]" : "border-[#ecc9c4] bg-[#fbe9e7]",
            )}
          >
            {aiTest.ok ? (
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-success" />
            ) : (
              <ShieldAlert size={14} className="mt-0.5 shrink-0 text-danger" />
            )}
            <div>
              <p className="text-[11px] font-semibold">{aiTest.ok ? "Validated" : "Rejected"}</p>
              <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted">{aiTest.detail}</p>
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#ece8e0] bg-[#fcfbf9] px-5 py-3">
          <p className="text-[9.5px] text-muted">
            Leave a field blank to keep the saved value. Environment values
            (GOOGLE_API_KEY, GEMINI_TEXT_MODEL, GEMINI_LIVE_MODEL) are the fallback.
          </p>
          <Button
            size="sm"
            variant="primary"
            onClick={() => void saveAi()}
            loading={aiBusy}
            disabled={Object.values(aiValues).every((value) => !value.trim())}
          >
            <KeyRound size={12} /> Save configuration
          </Button>
        </div>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        {integrations.map((integration) => {
          const Icon = icons[integration.id] ?? Link2;
          const connected = isConnected(integration);
          return (
            <Panel
              key={integration.id}
              className="flex flex-col justify-between overflow-hidden"
            >
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                        toneStyles[integration.tone],
                      )}
                    >
                      <Icon size={17} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[14px] font-semibold">{integration.name}</h3>
                        <Badge
                          tone={connected ? "success" : "neutral"}
                          className="!py-0 !text-[8.5px]"
                          dot={connected}
                        >
                          {connected ? "Connected" : "Disconnected"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted">
                        {integration.description}
                      </p>
                    </div>
                  </div>
                </div>

                <dl className="mt-3.5 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-[#eeeae2] bg-[#fbfaf7] px-2.5 py-2">
                    <dt className="eyebrow !text-[8px]">Environment</dt>
                    <dd className="mt-0.5 truncate font-mono text-[9.5px]">
                      {connected
                        ? integration.env
                        : integration.connected
                          ? "Not connected"
                          : integration.env}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-[#eeeae2] bg-[#fbfaf7] px-2.5 py-2">
                    <dt className="eyebrow !text-[8px]">Last sync</dt>
                    <dd className="mt-0.5 truncate text-[9.5px]">
                      {connected && integration.lastSync
                        ? `${formatDate(integration.lastSync, "d MMM")} · ${formatTime(integration.lastSync)}`
                        : "Never"}
                    </dd>
                  </div>
                </dl>

                <div className="mt-3">
                  <p className="eyebrow !text-[8px]">Requested scopes</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {integration.scopes.map((scope) => (
                      <span
                        key={scope}
                        className="rounded-md border border-[#e6e1d8] bg-white px-1.5 py-1 font-mono text-[8.5px] text-[#5c5851]"
                      >
                        {scope}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#f0ece5] bg-[#fcfbf9] px-4 py-3 sm:px-5">
                <p className="font-mono text-[8.5px] text-[#a19b91]">
                  {connected && integration.lastSync
                    ? relativeTime(integration.lastSync)
                    : "No credential stored"}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void openCredentials(integration)}
                  >
                    <KeyRound size={12} /> Credentials
                  </Button>
                  {connected ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        loading={testing === integration.id}
                        onClick={() => void runTest(integration)}
                      >
                        <RefreshCw size={12} /> Test
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openRevoke(integration)}
                        className="!text-[#8f2f28] hover:!bg-[#fbe9e7]"
                      >
                        <Unplug size={12} /> Revoke
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => openConnect(integration)}
                    >
                      <Link2 size={12} /> Connect
                    </Button>
                  )}
                </div>
              </div>
            </Panel>
          );
        })}
      </div>

      <Panel className="overflow-hidden">
        <div className="border-b border-[#ece8e0] px-5 py-3.5">
          <p className="eyebrow !text-[9px]">Limitations</p>
          <p className="mt-1 text-[12px] font-semibold">
            What Visun will never claim to read
          </p>
        </div>
        <ul className="grid divide-y divide-[#f0ece5] sm:grid-cols-2 sm:divide-y-0">
          {limitations.map((item) => (
            <li
              key={item.title}
              className="flex gap-2.5 border-[#f0ece5] p-4 sm:border-b sm:even:border-l"
            >
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-success" />
              <div>
                <p className="text-[11.5px] font-semibold">{item.title}</p>
                <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted">
                  {item.detail}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <div className="border-t border-[#ece8e0] bg-[#fcfbf9] px-5 py-3">
          <p className="text-[10px] leading-relaxed text-muted">
            Revoking access stops future calls. It does not delete projects,
            invoices, or messages already stored — manage those separately under
            Preferences.
          </p>
        </div>
      </Panel>

      <Modal
        open={Boolean(target)}
        onClose={close}
        title={
          target
            ? mode === "connect"
              ? `Connect ${target.name}`
              : `Revoke ${target.name}?`
            : "Integration"
        }
        description={
          target
            ? mode === "connect"
              ? "Review the environment and scopes before enabling this connection."
              : "Future reads and writes will stop immediately."
            : undefined
        }
        size="md"
        footer={
          target ? (
            <>
              <Button size="md" variant="ghost" onClick={close} disabled={busy}>
                Cancel
              </Button>
              <Button
                size="md"
                variant={mode === "connect" ? "primary" : "danger"}
                onClick={confirm}
                loading={busy}
                disabled={mode === "connect" && !acknowledged}
              >
                {busy
                  ? mode === "connect"
                    ? "Connecting…"
                    : "Revoking…"
                  : mode === "connect"
                    ? "Connect in sandbox"
                    : "Revoke access"}
              </Button>
            </>
          ) : null
        }
      >
        {target ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-[#eae5dc] bg-white p-3.5">
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                  toneStyles[target.tone],
                )}
              >
                {(() => {
                  const Icon = icons[target.id] ?? Link2;
                  return <Icon size={15} />;
                })()}
              </span>
              <div>
                <p className="text-[12px] font-semibold">
                  Environment: {target.env}
                </p>
                <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted">
                  {target.description}
                </p>
              </div>
            </div>

            <div>
              <p className="eyebrow !text-[8.5px]">
                {mode === "connect" ? "Scopes requested" : "Currently granted"}
              </p>
              <ul className="mt-2 space-y-1.5">
                {target.scopes.map((scope) => (
                  <li
                    key={scope}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[#eeeae2] bg-[#fbfaf7] px-2.5 py-2"
                  >
                    <span className="font-mono text-[9.5px]">{scope}</span>
                    {mode === "connect" ? (
                      <Check size={12} className="shrink-0 text-success" />
                    ) : (
                      <span className="text-[9px] text-muted">revoked</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {mode === "connect" ? (
              <>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[#e7cf6f] bg-[#fffdf4] p-3">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(event) => setAcknowledged(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[#ff5a00]"
                  />
                  <span className="text-[10.5px] leading-relaxed text-[#5d4a12]">
                    I understand this is a local sandbox simulation. No real
                    account is linked, no OAuth window opens, and no provider is
                    contacted.
                  </span>
                </label>
                <p className="text-[10px] leading-relaxed text-muted">
                  Read-only scopes are used to answer questions with citations.
                  Write scopes &mdash; marked{" "}
                  <span className="font-mono text-[9px]">approved</span> &mdash;
                  only run after you approve a specific payload.
                </p>
              </>
            ) : (
              <div className="flex items-start gap-2 rounded-xl border border-[#ecc9c4] bg-[#fbe9e7] p-3">
                <ShieldAlert size={14} className="mt-0.5 shrink-0 text-danger" />
                <p className="text-[10.5px] leading-relaxed text-[#7d2a24]">
                  This removes the local connection state. Project data, invoices,
                  and messages already stored are not deleted. You can reconnect
                  at any time.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 rounded-lg bg-[#f8f6f1] px-3 py-2">
              <span className="text-[9.5px] text-muted">Workspace</span>
              <span className="font-mono text-[9px]">{profile.workspace}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setTarget(null);
                push({
                  tone: "info",
                  title: "No documentation opened",
                  detail:
                    "External docs are disabled in this offline demo build.",
                });
              }}
              className="inline-flex items-center gap-1 text-[10.5px] font-medium text-muted underline-offset-2 transition hover:text-ink hover:underline"
            >
              How scopes are enforced <ArrowUpRight size={10} />
            </button>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(credentialFor)}
        onClose={closeCredentials}
        title={credentialFor ? `${credentialFor.name} credentials` : "Credentials"}
        description="Saved values are encrypted for this workspace. Anything left empty falls back to the backend .env file."
        size="md"
        footer={
          credentialFor ? (
            <>
              <Button size="md" variant="ghost" onClick={closeCredentials} disabled={credentialBusy}>
                Close
              </Button>
              {credentialStatus?.source === "workspace" ? (
                <Button
                  size="md"
                  variant="ghost"
                  onClick={() => void clearCredentials()}
                  disabled={credentialBusy}
                  className="!text-[#8f2f28] hover:!bg-[#fbe9e7]"
                >
                  Remove stored
                </Button>
              ) : null}
              <Button
                size="md"
                variant="primary"
                onClick={() => void saveCredentials()}
                loading={credentialBusy}
                disabled={Object.values(credentialValues).every((value) => !value.trim())}
              >
                Save credentials
              </Button>
            </>
          ) : null
        }
      >
        {credentialFor ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                tone={
                  credentialStatus?.source === "workspace"
                    ? "success"
                    : credentialStatus?.source === "environment"
                      ? "info"
                      : "neutral"
                }
                dot={Boolean(credentialStatus?.source)}
              >
                {credentialStatus?.source === "workspace"
                  ? "Stored in this workspace"
                  : credentialStatus?.source === "environment"
                    ? "Using backend .env values"
                    : "Not configured"}
              </Badge>
              {credentialStatus?.encryptionReady === false ? (
                <Badge tone="warning">APP_ENCRYPTION_KEY missing</Badge>
              ) : null}
            </div>

            {credentialError ? (
              <div className="flex items-start gap-2 rounded-xl border border-[#ecc9c4] bg-[#fbe9e7] p-3">
                <ShieldAlert size={14} className="mt-0.5 shrink-0 text-danger" />
                <p className="text-[10.5px] leading-relaxed text-[#7d2a24]">{credentialError}</p>
              </div>
            ) : null}

            {testResult ? (
              <div
                className={cn(
                  "flex items-start gap-2 rounded-xl border p-3",
                  testResult.ok
                    ? "border-[#c9e3d4] bg-[#f0f9f4]"
                    : "border-[#ecc9c4] bg-[#fbe9e7]",
                )}
              >
                {testResult.ok ? (
                  <ShieldCheck size={14} className="mt-0.5 shrink-0 text-success" />
                ) : (
                  <ShieldAlert size={14} className="mt-0.5 shrink-0 text-danger" />
                )}
                <div>
                  <p
                    className={cn(
                      "text-[11px] font-semibold",
                      testResult.ok ? "text-[#1e6344]" : "text-[#7d2a24]",
                    )}
                  >
                    {testResult.ok ? "Provider accepted the credentials" : "Provider test failed"}
                  </p>
                  <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted">
                    {testResult.detail}
                  </p>
                  <p className="mt-1 font-mono text-[9px] text-[#a19b91]">
                    checked {formatTime(testResult.checkedAt)}
                    {testResult.source ? ` · source: ${testResult.source}` : ""}
                  </p>
                </div>
              </div>
            ) : null}

            {credentialStatus ? (
              <div className="space-y-3">
                {credentialStatus.fields.map((field: CredentialField) => (
                  <label key={field.key} className="block">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[11.5px] font-semibold">{field.label}</span>
                      <span className="font-mono text-[8.5px] text-[#a19b91]">{field.envVar}</span>
                    </span>
                    {field.options ? (
                      <select
                        value={
                          credentialValues[field.key] ??
                          (field.value as string | null) ??
                          field.default ??
                          field.options[0]
                        }
                        onChange={(event) =>
                          setCredentialValues((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                        }
                        className="mt-1.5 h-9 w-full rounded-lg border border-[#e2ddd3] bg-white px-2.5 text-[11.5px] text-ink outline-none focus:border-[#c9c2b5]"
                      >
                        {field.options.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.secret ? "password" : "text"}
                        autoComplete="off"
                        spellCheck={false}
                        value={credentialValues[field.key] ?? (field.secret ? "" : field.value ?? "")}
                        placeholder={
                          field.configured
                            ? field.preview ?? "Saved — leave blank to keep"
                            : field.secret
                              ? "Paste the value"
                              : field.default ?? ""
                        }
                        onChange={(event) =>
                          setCredentialValues((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                        }
                        className="mt-1.5 h-9 w-full rounded-lg border border-[#e2ddd3] bg-white px-2.5 font-mono text-[11px] text-ink outline-none focus:border-[#c9c2b5]"
                      />
                    )}
                    {field.configured ? (
                      <span className="mt-1 block text-[9px] text-[#a19b91]">
                        Currently set{field.preview ? ` · ${field.preview}` : ""}. Submitting a new
                        value replaces it.
                      </span>
                    ) : null}
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted">Loading credential fields…</p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#eae5dc] bg-[#fcfbf9] p-3">
              <div className="min-w-0">
                <p className="text-[10.5px] font-semibold">Test connection</p>
                <p className="mt-0.5 text-[9.5px] leading-relaxed text-muted">
                  One read-only call to {credentialFor.name}. Nothing is sent, created, or charged.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                loading={testing === credentialFor.id}
                onClick={() => void runTest(credentialFor)}
              >
                <RefreshCw size={12} /> Run test
              </Button>
            </div>

            <p className="text-[9.5px] leading-relaxed text-muted">
              Credentials are encrypted with APP_ENCRYPTION_KEY and scoped to this workspace. They
              are never returned to the browser, and the shared demo workspace refuses to store
              them. Provider writes still run in PROVIDER_MODE and still require per-payload
              approval.
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
