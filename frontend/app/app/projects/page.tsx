"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  Download,
  Filter,
  FolderKanban,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Panel,
  Progress,
  useToast,
} from "@/components/ui";
import {
  clients,
  invoices,
  milestones,
  projects,
  scopeFindings,
} from "@/lib/demo-data";
import { useAppStore } from "@/lib/store";
import { cn, formatDate, formatMoney, pct, sum } from "@/lib/utils";

const filters = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "review", label: "In review" },
  { id: "completed", label: "Completed" },
] as const;

export default function ProjectsPage() {
  const router = useRouter();
  const { push } = useToast();
  const { state } = useAppStore();
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"due" | "value" | "progress">("due");

  const enriched = useMemo(
    () =>
      projects.map((project) => {
        const client = clients.find((item) => item.id === project.clientId)!;
        const projectMilestones = milestones.filter(
          (milestone) => milestone.projectId === project.id,
        );
        const done = projectMilestones.filter((milestone) =>
          state.doneMilestones.includes(milestone.id),
        ).length;
        const outstanding = invoices
          .filter(
            (invoice) =>
              invoice.projectId === project.id &&
              ["sent", "overdue", "partially_paid"].includes(invoice.status),
          )
          .reduce(
            (total, invoice) => total + (invoice.amount - invoice.amountPaid),
            0,
          );
        const findings = scopeFindings.filter(
          (finding) => finding.projectId === project.id,
        );
        const openFindings = findings.filter((finding) => {
          const review = state.findingReviews[finding.id];
          return review === "potential" || review === "reviewing";
        }).length;
        return {
          project,
          client,
          progress: pct(done, projectMilestones.length),
          outstanding,
          openFindings,
          nextMilestone: projectMilestones
            .filter((milestone) => !state.doneMilestones.includes(milestone.id))
            .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0],
        };
      }),
    [state.doneMilestones, state.findingReviews],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return enriched
      .filter((item) => filter === "all" || item.project.status === filter)
      .filter((item) =>
        term
          ? `${item.project.name} ${item.client.name} ${item.client.company} ${item.project.codename}`
              .toLowerCase()
              .includes(term)
          : true,
      )
      .sort((a, b) => {
        if (sort === "value") return b.project.budget - a.project.budget;
        if (sort === "progress") return b.progress - a.progress;
        return a.project.dueAt.localeCompare(b.project.dueAt);
      });
  }, [enriched, filter, query, sort]);

  const totalValue = sum(
    enriched
      .filter((item) => item.project.status !== "completed")
      .map((item) => item.project.budget),
  );
  const totalOutstanding = sum(enriched.map((item) => item.outstanding));

  const exportCsv = () => {
    const rows = [
      ["Project", "Client", "Status", "Budget", "Paid", "Outstanding", "Due"],
      ...enriched.map((item) => [
        item.project.name,
        item.client.company,
        item.project.status,
        String(item.project.budget),
        String(item.project.paid),
        String(item.outstanding),
        item.project.dueAt.slice(0, 10),
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "visun-projects-demo.csv";
    link.click();
    URL.revokeObjectURL(url);
    push({
      tone: "success",
      title: "Project summary exported",
      detail: "A CSV of the demo workspace was downloaded.",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Client work</p>
          <h2 className="mt-1.5 text-[clamp(1.8rem,2.8vw,2.3rem)] font-semibold leading-tight tracking-[-0.035em]">
            Projects
          </h2>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-muted">
            {enriched.filter((item) => item.project.status !== "completed").length}{" "}
            active engagements · {formatMoney(totalValue)} contracted ·{" "}
            {formatMoney(totalOutstanding)} still outstanding.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="md" onClick={exportCsv}>
            <Download size={14} /> Export
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() =>
              push({
                tone: "info",
                title: "Ask the copilot to scope it",
                detail:
                  "Project creation is seeded in this demo. Use “Ask Visun” to draft a scope from a client message.",
              })
            }
          >
            <Plus size={14} /> New project
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-[#e3dfd7] bg-white p-3 shadow-neu-sm sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-1">
          {filters.map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={cn(
                "rounded-lg px-3 py-2 text-[12px] font-medium transition",
                filter === item.id
                  ? "bg-ink text-canvas shadow-sm"
                  : "text-muted hover:bg-[#f6f3ed] hover:text-ink",
              )}
              aria-pressed={filter === item.id}
            >
              {item.label}
              <span className="ml-1.5 font-mono text-[9px] opacity-60">
                {item.id === "all"
                  ? projects.length
                  : projects.filter((project) => project.status === item.id).length}
              </span>
            </button>
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <label className="relative flex-1 sm:max-w-[240px]">
            <Search
              size={13}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search client or project"
              className="h-9 w-full rounded-lg border border-[#e2ded6] bg-[#f8f6f1] pl-8 pr-2 text-[12px] outline-none transition focus:border-[#c8c1b4] focus:bg-white"
              aria-label="Search projects"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[10.5px] text-muted">
            <Filter size={12} /> Sort
            <select
              value={sort}
              onChange={(event) =>
                setSort(event.target.value as typeof sort)
              }
              className="h-9 rounded-lg border border-[#e2ded6] bg-[#f8f6f1] px-2 text-[11.5px] text-ink outline-none focus:border-orange"
              aria-label="Sort projects"
            >
              <option value="due">Due date</option>
              <option value="value">Budget</option>
              <option value="progress">Progress</option>
            </select>
          </label>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<FolderKanban size={18} />}
          title="No projects match this view"
          description="Clear the search or choose a different status. The demo workspace has five seeded projects."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
            >
              Reset filters
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(({ project, client, progress, outstanding, openFindings, nextMilestone }) => (
            <Link
              key={project.id}
              href={`/app/projects/${project.id}`}
              className="card-lift group flex flex-col overflow-hidden rounded-[22px] border border-[#e3dfd7] bg-white shadow-neu-sm"
            >
              <div className="flex items-start justify-between gap-3 px-5 pt-5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar
                    name={client.name}
                    initials={client.initials}
                    hue={client.hue}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[11.5px] font-medium">
                      {client.company}
                    </p>
                    <p className="font-mono text-[8.5px] uppercase tracking-wider text-muted">
                      {project.codename}
                    </p>
                  </div>
                </div>
                <Badge
                  tone={
                    project.status === "active"
                      ? "success"
                      : project.status === "review"
                        ? "warning"
                        : project.status === "completed"
                          ? "neutral"
                          : "info"
                  }
                  dot
                  className="!py-0.5 !text-[9px]"
                >
                  {project.status === "active"
                    ? "Active"
                    : project.status === "review"
                      ? "In review"
                      : project.status === "completed"
                        ? "Complete"
                        : "Paused"}
                </Badge>
              </div>

              <div className="px-5 pt-3">
                <h3 className="text-[17px] font-semibold leading-snug tracking-[-0.015em] transition group-hover:text-orange">
                  {project.name}
                </h3>
                <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-muted">
                  {project.description}
                </p>
              </div>

              <div className="mt-4 px-5">
                <Progress
                  value={progress}
                  tone={project.health === "at_risk" ? "orange" : "success"}
                  label="Milestones complete"
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 px-5">
                <div className="rounded-xl border border-[#eae5dc] bg-[#faf9f6] px-3 py-2.5">
                  <p className="eyebrow !text-[8.5px]">Next due</p>
                  <p className="mt-1 text-[11.5px] font-semibold">
                    {nextMilestone ? formatDate(nextMilestone.dueAt, "d MMM") : "—"}
                  </p>
                  <p className="mt-0.5 truncate text-[9.5px] text-muted">
                    {nextMilestone?.title ?? "Handed off"}
                  </p>
                </div>
                <div className="rounded-xl border border-[#eae5dc] bg-[#faf9f6] px-3 py-2.5">
                  <p className="eyebrow !text-[8.5px]">Outstanding</p>
                  <p className="tabular mt-1 text-[11.5px] font-semibold">
                    {outstanding ? formatMoney(outstanding) : "—"}
                  </p>
                  <p className="mt-0.5 text-[9.5px] text-muted">
                    {outstanding ? "Provider verified" : "Nothing open"}
                  </p>
                </div>
              </div>

              <div className="mt-auto flex items-center justify-between gap-2 border-t border-[#eeeae2] px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="flex items-center gap-1 rounded-md bg-[#f4f1ea] px-1.5 py-1 text-[9px] font-medium text-muted">
                    <Wallet size={10} /> {formatMoney(project.budget)}
                  </span>
                  {openFindings > 0 ? (
                    <span className="flex items-center gap-1 rounded-md bg-[#fff3cf] px-1.5 py-1 text-[9px] font-medium text-[#775000]">
                      <ShieldAlert size={10} /> {openFindings} scope
                    </span>
                  ) : null}
                  {project.health === "at_risk" ? (
                    <span className="flex items-center gap-1 rounded-md bg-[#fbe9e7] px-1.5 py-1 text-[9px] font-medium text-[#8f2f28]">
                      <TrendingUp size={10} /> At risk
                    </span>
                  ) : null}
                </div>
                <span className="flex items-center gap-1 text-[10.5px] font-medium text-muted transition group-hover:text-ink">
                  Open <ArrowUpRight size={12} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Panel className="flex flex-col items-start justify-between gap-4 bg-[#fbfaf7] p-5 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow text-ink">
            <CalendarClock size={17} />
          </span>
          <div>
            <p className="text-[13px] font-semibold">
              Need a grounded answer across all projects?
            </p>
            <p className="mt-0.5 text-[11.5px] text-muted">
              Ask for deadlines, scope changes, or unpaid balances — each answer
              links to the record it used.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push("/app/calendar")}
          >
            Calendar
          </Button>
          <Button
            size="sm"
            variant="dark"
            onClick={() => router.push("/app/copilot?prompt=Give%20me%20a%20status%20update%20across%20all%20projects.")}
          >
            <Sparkles size={12} /> Ask Visun
          </Button>
        </div>
      </Panel>
    </div>
  );
}
