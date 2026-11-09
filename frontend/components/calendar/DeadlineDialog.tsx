"use client";

import { useEffect, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import type { MutationResult } from "@/lib/store";
import type { Project } from "@/lib/types";

const fieldClass =
  "h-10 w-full rounded-lg border border-[#e2ded6] bg-[#f8f6f1] px-3 text-[12px] text-ink outline-none transition focus:border-orange focus:bg-white";

const labelClass = "mb-1 block text-[11px] font-medium text-muted";

export type DeadlineValues = {
  title: string;
  projectId: string;
  date: string;
  time: string;
  acceptance: string;
};

/**
 * A deadline is a milestone stored in this workspace. No calendar provider is
 * involved, so adding, editing, and deleting work without any integration.
 */
export function DeadlineDialog({
  open,
  onClose,
  projects,
  initial,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  projects: Project[];
  initial?: {
    id?: string;
    title?: string;
    projectId?: string;
    date?: string;
    time?: string;
    acceptance?: string;
  } | null;
  onSubmit: (values: DeadlineValues) => Promise<MutationResult>;
  onDelete?: () => Promise<MutationResult>;
}) {
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("18:00");
  const [acceptance, setAcceptance] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setProjectId(initial?.projectId ?? projects[0]?.id ?? "");
    setDate(initial?.date ?? new Date().toISOString().slice(0, 10));
    setTime(initial?.time ?? "18:00");
    setAcceptance(initial?.acceptance ?? "");
    setBusy(false);
    setError(null);
  }, [initial, open, projects]);

  const editing = Boolean(initial?.id);
  const canSubmit = title.trim().length > 0 && projectId.length > 0;

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    const result = await onSubmit({
      title,
      projectId,
      date,
      time,
      acceptance,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "The deadline could not be saved.");
      return;
    }
    onClose();
  };

  const remove = async () => {
    if (!onDelete || busy) return;
    setBusy(true);
    setError(null);
    const result = await onDelete();
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "The deadline could not be deleted.");
      return;
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit deadline" : "Add a deadline"}
      description="Stored in this workspace. No external calendar is connected or written to."
      footer={
        <>
          {editing && onDelete ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void remove()}
              disabled={busy}
              className="mr-auto text-[#8f2f28] hover:bg-[#fbe9e7]"
            >
              <Trash2 size={12} /> Delete
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void submit()}
            disabled={!canSubmit || busy}
          >
            {editing ? <Check size={12} /> : <Plus size={12} />}
            {busy ? "Saving…" : editing ? "Save changes" : "Save deadline"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className={labelClass}>Title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Send the staging link"
            className={fieldClass}
            autoFocus
          />
        </label>
        <label className="block">
          <span className={labelClass}>Project</span>
          <select
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            className={fieldClass}
            disabled={projects.length === 0}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
            {projects.length === 0 ? (
              <option value="">Create a project first</option>
            ) : null}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Date</span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Time</span>
            <input
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              className={fieldClass}
            />
          </label>
        </div>
        <label className="block">
          <span className={labelClass}>Acceptance (optional)</span>
          <input
            value={acceptance}
            onChange={(event) => setAcceptance(event.target.value)}
            placeholder="What counts as done"
            className={fieldClass}
          />
        </label>

        {error ? (
          <p className="rounded-lg bg-[#fbe9e7] px-3 py-2 text-[10.5px] leading-relaxed text-[#8f2f28]">
            {error}
          </p>
        ) : (
          <p className="rounded-lg bg-[#fff8e2] px-3 py-2 text-[10px] leading-relaxed text-[#7a6b3e]">
            Managed by hand, so it works with no calendar provider connected.
            Nothing is written to Google Calendar.
          </p>
        )}
      </div>
    </Modal>
  );
}
