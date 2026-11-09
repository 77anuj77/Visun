"use client";

import { useEffect, useState } from "react";
import { Building2, Check, Plus } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import type { MutationResult, ProjectDraft } from "@/lib/store";
import type { Client, Project, ProjectStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const statuses: { id: ProjectStatus; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "review", label: "In review" },
  { id: "paused", label: "Paused" },
  { id: "completed", label: "Completed" },
];

const fieldClass =
  "h-10 w-full rounded-lg border border-[#e2ded6] bg-[#f8f6f1] px-3 text-[12px] text-ink outline-none transition focus:border-orange focus:bg-white";

const labelClass = "mb-1 block text-[11px] font-medium text-muted";

/**
 * Manual project entry. Deliberately does not require any provider: a person
 * can record an engagement by hand with or without integrations connected.
 */
export function ProjectDialog({
  open,
  onClose,
  clients,
  project,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  clients: Client[];
  /** Present when editing an existing project. */
  project?: Project | null;
  onSubmit: (draft: ProjectDraft) => Promise<MutationResult>;
}) {
  const [name, setName] = useState("");
  const [codename, setCodename] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [budget, setBudget] = useState("0");
  const [dueAt, setDueAt] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(project?.name ?? "");
    setCodename(project?.codename ?? "");
    setStatus(project?.status ?? "active");
    setBudget(String(project?.budget ?? 0));
    setDueAt((project?.dueAt ?? new Date().toISOString()).slice(0, 10));
    setDescription(project?.description ?? "");
    setClientId(project?.clientId ?? clients[0]?.id ?? "__new");
    setClientName("");
    setClientCompany("");
    setClientEmail("");
    setBusy(false);
    setError(null);
  }, [clients, open, project]);

  const creatingClient = clientId === "__new";
  const canSubmit =
    name.trim().length > 0 &&
    (!creatingClient ||
      (clientName.trim().length > 0 && clientCompany.trim().length > 0));

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    const result = await onSubmit({
      name,
      codename: codename || undefined,
      status,
      budget: Number.isFinite(Number(budget)) ? Math.max(0, Number(budget)) : 0,
      dueAt,
      description,
      clientId: creatingClient ? undefined : clientId,
      clientName: creatingClient ? clientName : undefined,
      clientCompany: creatingClient ? clientCompany : undefined,
      clientEmail: creatingClient ? clientEmail : undefined,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "The project could not be saved.");
      return;
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={project ? "Edit project" : "New project"}
      description={
        project
          ? "Changes are stored in this workspace. No provider is contacted."
          : "Add a project by hand. Integrations are optional — nothing is sent to a provider."
      }
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void submit()}
            disabled={!canSubmit || busy}
          >
            {project ? <Check size={12} /> : <Plus size={12} />}
            {busy ? "Saving…" : project ? "Save changes" : "Create project"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
          <label className="block">
            <span className={labelClass}>Project name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Website rebuild"
              className={fieldClass}
              autoFocus
            />
          </label>
          <label className="block">
            <span className={labelClass}>Codename</span>
            <input
              value={codename}
              onChange={(event) => setCodename(event.target.value)}
              placeholder="Optional"
              className={fieldClass}
            />
          </label>
        </div>

        <fieldset>
          <legend className={labelClass}>Client</legend>
          <div className="flex flex-wrap gap-1.5">
            {clients.map((client) => (
              <button
                key={client.id}
                type="button"
                onClick={() => setClientId(client.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-medium transition",
                  !creatingClient && clientId === client.id
                    ? "border-[#f0c3a6] bg-[#ffe9dc] text-[#a63b00]"
                    : "border-[#e2ded6] bg-[#f8f6f1] text-muted hover:border-[#d3ccbf] hover:text-ink",
                )}
                aria-pressed={!creatingClient && clientId === client.id}
              >
                {client.company}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setClientId("__new")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-medium transition",
                creatingClient
                  ? "border-[#f0c3a6] bg-[#ffe9dc] text-[#a63b00]"
                  : "border-dashed border-[#d8d2c6] bg-white text-muted hover:border-[#c9c2b4] hover:text-ink",
              )}
              aria-pressed={creatingClient}
            >
              <Building2 size={11} /> New client
            </button>
          </div>
        </fieldset>

        {creatingClient ? (
          <div className="grid gap-3 rounded-xl border border-[#eae5dc] bg-[#fbfaf7] p-3 sm:grid-cols-3">
            <label className="block">
              <span className={labelClass}>Contact name</span>
              <input
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                placeholder="Rahul Mehta"
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Company</span>
              <input
                value={clientCompany}
                onChange={(event) => setClientCompany(event.target.value)}
                placeholder="Northwind Labs"
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Email</span>
              <input
                type="email"
                value={clientEmail}
                onChange={(event) => setClientEmail(event.target.value)}
                placeholder="Optional"
                className={fieldClass}
              />
            </label>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className={labelClass}>Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as ProjectStatus)}
              className={fieldClass}
            >
              {statuses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Budget (USD)</span>
            <input
              type="number"
              min={0}
              step="100"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Due date</span>
            <input
              type="date"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              className={fieldClass}
            />
          </label>
        </div>

        <label className="block">
          <span className={labelClass}>Description</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            placeholder="What was agreed, in one or two lines."
            className="w-full rounded-lg border border-[#e2ded6] bg-[#f8f6f1] px-3 py-2 text-[12px] leading-relaxed text-ink outline-none transition focus:border-orange focus:bg-white"
          />
        </label>

        {error ? (
          <p className="rounded-lg bg-[#fbe9e7] px-3 py-2 text-[10.5px] leading-relaxed text-[#8f2f28]">
            {error}
          </p>
        ) : (
          <p className="rounded-lg bg-[#fff8e2] px-3 py-2 text-[10px] leading-relaxed text-[#7a6b3e]">
            Stored only in this workspace. Budgets and dates are your own
            records, not provider-verified amounts.
          </p>
        )}
      </div>
    </Modal>
  );
}
