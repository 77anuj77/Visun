"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Link2Off,
  Plus,
  Sparkles,
  Wallet,
} from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  Modal,
  Panel,
  useToast,
} from "@/components/ui";
import { invoices, milestones, projects, workspace } from "@/lib/demo-data";
import { useAppStore } from "@/lib/store";
import {
  cn,
  formatDate,
  formatMoney,
  formatTime,
} from "@/lib/utils";

const DEMO_TODAY = "2026-11-03";

type ViewId = "month" | "week" | "day" | "agenda";

type CalendarEvent = {
  id: string;
  date: string;
  time: string;
  title: string;
  projectId: string;
  type: "milestone" | "invoice" | "local";
  done: boolean;
  overdue: boolean;
  amount?: number;
};

const views: { id: ViewId; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "day", label: "Day" },
  { id: "agenda", label: "Agenda" },
];

function eventTone(event: CalendarEvent) {
  if (event.done) return "bg-[#eef7f1] text-[#1d6143] border-[#cfe5d8]";
  if (event.overdue) return "bg-[#fbe9e7] text-[#8f2f28] border-[#ecc9c4]";
  if (event.type === "invoice") return "bg-[#eef1f9] text-[#35528f] border-[#cfd9f0]";
  if (event.type === "local") return "bg-[#f2efe9] text-[#5e5a52] border-[#ddd7cc]";
  return "bg-[#fff0e6] text-[#9a3b00] border-[#f6d3ba]";
}

export default function CalendarPage() {
  const router = useRouter();
  const { push } = useToast();
  const { state, addActivity } = useAppStore();
  const [view, setView] = useState<ViewId>("month");
  const [cursor, setCursor] = useState(() => new Date(2026, 10, 3));
  const [selectedDate, setSelectedDate] = useState(DEMO_TODAY);
  const [projectFilter, setProjectFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newProject, setNewProject] = useState("p-northwind");
  const [newDate, setNewDate] = useState("2026-11-06");
  const [newTime, setNewTime] = useState("18:00");
  const [localEvents, setLocalEvents] = useState<CalendarEvent[]>([]);

  const events = useMemo<CalendarEvent[]>(() => {
    const fromMilestones = milestones.map((milestone) => ({
      id: milestone.id,
      date: milestone.dueAt.slice(0, 10),
      time: formatTime(milestone.dueAt),
      title: milestone.title,
      projectId: milestone.projectId,
      type: "milestone" as const,
      done: state.doneMilestones.includes(milestone.id),
      overdue:
        milestone.dueAt.slice(0, 10) < DEMO_TODAY &&
        !state.doneMilestones.includes(milestone.id),
    }));
    const fromInvoices = invoices
      .filter((invoice) => invoice.status !== "paid" && invoice.status !== "draft")
      .map((invoice) => ({
        id: invoice.id,
        date: invoice.dueAt.slice(0, 10),
        time: formatTime(invoice.dueAt),
        title: `${invoice.number} due — ${formatMoney(invoice.amount - invoice.amountPaid, invoice.currency)}`,
        projectId: invoice.projectId,
        type: "invoice" as const,
        done: false,
        overdue: invoice.status === "overdue",
        amount: invoice.amount - invoice.amountPaid,
      }));
    return [...fromMilestones, ...fromInvoices, ...localEvents].filter(
      (event) => projectFilter === "all" || event.projectId === projectFilter,
    );
  }, [localEvents, projectFilter, state.doneMilestones]);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }
    return map;
  }, [events]);

  const monthDays = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }),
      }),
    [cursor],
  );

  const weekDays = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(cursor, { weekStartsOn: 1 }),
        end: endOfWeek(cursor, { weekStartsOn: 1 }),
      }),
    [cursor],
  );

  const selectedEvents = byDate.get(selectedDate) ?? [];

  const upcoming = useMemo(
    () =>
      [...events]
        .filter((event) => event.date >= selectedDate && !event.done)
        .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
        .slice(0, 6),
    [events, selectedDate],
  );

  const weekEvents = events.filter(
    (event) => event.date >= "2026-11-03" && event.date <= "2026-11-09",
  );
  const overdueCount = events.filter((event) => event.overdue).length;
  const doneCount = events.filter((event) => event.done).length;

  const shift = (direction: number) => {
    if (view === "month") {
      setCursor((current) => addMonths(current, direction));
      return;
    }
    if (view === "week" || view === "agenda") {
      setCursor((current) => addDays(current, 7 * direction));
      return;
    }
    const next = addDays(parseISO(selectedDate), direction);
    setCursor(next);
    setSelectedDate(format(next, "yyyy-MM-dd"));
  };

  const goToday = () => {
    setCursor(new Date(2026, 10, 3));
    setSelectedDate(DEMO_TODAY);
  };

  const addLocalEvent = () => {
    if (!newTitle.trim()) return;
    const event: CalendarEvent = {
      id: `local-${Date.now()}`,
      date: newDate,
      time: formatTime(`${newDate}T${newTime || "18:00"}:00+05:30`),
      title: newTitle.trim(),
      projectId: newProject,
      type: "local",
      done: false,
      overdue: false,
    };
    setLocalEvents((current) => [...current, event]);
    addActivity({
      type: "system",
      actor: "You",
      title: "Local deadline added",
      detail: `${event.title} was added to the demo calendar for ${formatDate(newDate)}. Google Calendar is not connected, so nothing was written externally.`,
      status: "info",
      projectId: newProject,
    });
    push({
      tone: "success",
      title: "Deadline added locally",
      detail: "Not written to Google Calendar — demo storage only.",
    });
    setAddOpen(false);
    setNewTitle("");
    setNewDate("2026-11-06");
    setNewTime("18:00");
    setSelectedDate(newDate);
    setCursor(parseISO(newDate));
  };

  const renderEventChip = (event: CalendarEvent, compact = false) => {
    const project = projects.find((item) => item.id === event.projectId);
    return (
      <button
        key={event.id}
        onClick={(clickEvent) => {
          clickEvent.stopPropagation();
          setSelectedDate(event.date);
        }}
        className={cn(
          "flex w-full items-center gap-1 rounded-md border px-1.5 py-1 text-left transition hover:brightness-[0.98]",
          eventTone(event),
          compact && "py-0.5",
        )}
        title={`${project?.name ?? ""} · ${event.title}`}
      >
        {event.done ? (
          <Check size={8} strokeWidth={3} className="shrink-0" />
        ) : event.type === "invoice" ? (
          <Wallet size={8} className="shrink-0" />
        ) : (
          <span className="h-1 w-1 shrink-0 rounded-full bg-current" />
        )}
        <span
          className={cn(
            "truncate font-medium leading-tight",
            compact ? "text-[8.5px]" : "text-[9px]",
          )}
        >
          {event.title}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="eyebrow">Time</p>
            <Badge tone="yellow" className="!py-0.5 !text-[9.5px]">
              Stored deadlines
            </Badge>
          </div>
          <h2 className="mt-1.5 text-[clamp(1.8rem,2.8vw,2.3rem)] font-semibold leading-tight tracking-[-0.035em]">
            Calendar
          </h2>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-muted">
            Milestones and invoice due dates, shown in{" "}
            {workspace.timezone.replace("_", " ")}. Google Calendar is not
            connected, so this view never implies external availability.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="md"
            onClick={() => router.push("/app/settings/integrations")}
          >
            <Link2Off size={14} /> Connect calendar
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => setAddOpen(true)}
          >
            <Plus size={14} /> Add deadline
          </Button>
        </div>
      </section>

      <div className="flex flex-col gap-3 rounded-2xl border border-[#e3dfd7] bg-white p-3 shadow-neu-sm lg:flex-row lg:items-center">
        <div className="flex items-center gap-1">
          <button
            onClick={() => shift(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e2ded6] bg-[#f8f6f1] text-muted transition hover:bg-white hover:text-ink"
            aria-label="Previous period"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={() => shift(1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e2ded6] bg-[#f8f6f1] text-muted transition hover:bg-white hover:text-ink"
            aria-label="Next period"
          >
            <ChevronRight size={15} />
          </button>
          <Button variant="outline" size="sm" onClick={goToday} className="ml-1">
            Today
          </Button>
        </div>

        <p className="min-w-[160px] px-1 text-[13px] font-semibold tracking-tight">
          {view === "day"
            ? formatDate(selectedDate, "EEEE d MMMM")
            : format(cursor, "MMMM yyyy")}
        </p>

        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <label className="flex items-center gap-1.5 text-[10.5px] text-muted">
            <CalendarDays size={12} /> Project
            <select
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
              className="h-9 rounded-lg border border-[#e2ded6] bg-[#f8f6f1] px-2 text-[11.5px] text-ink outline-none focus:border-orange"
              aria-label="Filter by project"
            >
              <option value="all">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex rounded-lg border border-[#e2ded6] bg-[#f4f1ea] p-0.5">
            {views.map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-[11px] font-medium transition",
                  view === item.id
                    ? "bg-white text-ink shadow-sm"
                    : "text-muted hover:text-ink",
                )}
                aria-pressed={view === item.id}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px]">
        <Panel className="overflow-hidden">
          {view === "month" ? (
            <div>
              <div className="grid grid-cols-7 border-b border-[#ece8e0] bg-[#fbfaf7]">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                  <span
                    key={day}
                    className="px-2 py-2 text-center font-mono text-[9px] uppercase tracking-[0.12em] text-muted"
                  >
                    {day}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthDays.map((day) => {
                  const iso = format(day, "yyyy-MM-dd");
                  const dayEvents = byDate.get(iso) ?? [];
                  const outside = !isSameMonth(day, cursor);
                  const today = iso === DEMO_TODAY;
                  const selected = iso === selectedDate;
                  return (
                    <button
                      key={iso}
                      onClick={() => setSelectedDate(iso)}
                      className={cn(
                        "flex min-h-[108px] flex-col border-b border-r border-[#f0ece5] p-1.5 text-left transition last:border-r-0 hover:bg-[#fbfaf7]",
                        outside && "bg-[#fbfaf7]/60",
                        selected && "bg-[#fff8ec]",
                      )}
                      aria-pressed={selected}
                      aria-label={`${formatDate(iso, "EEEE d MMMM")}, ${dayEvents.length} deadlines`}
                    >
                      <span
                        className={cn(
                          "mb-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
                          today
                            ? "bg-orange text-ink"
                            : outside
                              ? "text-[#b6afa3]"
                              : "text-[#5f5b54]",
                        )}
                      >
                        {format(day, "d")}
                      </span>
                      <span className="flex flex-1 flex-col gap-0.5">
                        {dayEvents.slice(0, 3).map((event) => renderEventChip(event, true))}
                        {dayEvents.length > 3 ? (
                          <span className="px-1 text-[8px] font-medium text-muted">
                            +{dayEvents.length - 3} more
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {view === "week" ? (
            <div>
              <div className="grid grid-cols-1 divide-y divide-[#f0ece5] sm:grid-cols-7 sm:divide-x sm:divide-y-0">
                {weekDays.map((day) => {
                  const iso = format(day, "yyyy-MM-dd");
                  const dayEvents = byDate.get(iso) ?? [];
                  const today = iso === DEMO_TODAY;
                  return (
                    <div
                      key={iso}
                      className={cn(
                        "min-h-[160px] p-2.5 sm:min-h-[420px]",
                        today && "bg-[#fffaf2]",
                      )}
                    >
                      <button
                        onClick={() => {
                          setSelectedDate(iso);
                          setView("day");
                        }}
                        className="mb-2 flex w-full items-baseline justify-between gap-1 text-left"
                      >
                        <span
                          className={cn(
                            "font-mono text-[9px] uppercase tracking-wider",
                            today ? "text-orange" : "text-muted",
                          )}
                        >
                          {format(day, "EEE")}
                        </span>
                        <span
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold",
                            today && "bg-orange text-ink",
                          )}
                        >
                          {format(day, "d")}
                        </span>
                      </button>
                      <div className="flex flex-col gap-1">
                        {dayEvents.length ? (
                          dayEvents.map((event) => renderEventChip(event))
                        ) : (
                          <span className="rounded-md border border-dashed border-[#e7e2d9] px-1.5 py-2 text-center text-[8.5px] text-muted">
                            Open
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {view === "day" ? (
            <div className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="eyebrow !text-[9px]">
                    {formatDate(selectedDate, "EEEE")}
                  </p>
                  <p className="mt-1 text-[24px] font-semibold leading-none tracking-tight">
                    {formatDate(selectedDate, "d MMMM yyyy")}
                  </p>
                </div>
                <Badge tone={selectedDate === DEMO_TODAY ? "orange" : "neutral"}>
                  {selectedDate === DEMO_TODAY ? "Today" : "Selected day"}
                </Badge>
              </div>

              {selectedEvents.length ? (
                <ol className="mt-5 space-y-2">
                  {selectedEvents.map((event) => {
                    const project = projects.find(
                      (item) => item.id === event.projectId,
                    );
                    return (
                      <li key={event.id}>
                        <Link
                          href={`/app/projects/${event.projectId}`}
                          className={cn(
                            "flex items-start gap-3 rounded-xl border p-3.5 transition hover:brightness-[0.99]",
                            eventTone(event),
                          )}
                        >
                          <span className="mt-0.5 flex w-[58px] shrink-0 flex-col">
                            <span className="font-mono text-[10px] font-medium">
                              {event.time}
                            </span>
                            <span className="text-[8.5px] opacity-70">
                              {event.type === "invoice"
                                ? "Payment"
                                : event.type === "local"
                                  ? "Local"
                                  : "Milestone"}
                            </span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[12.5px] font-semibold leading-snug">
                              {event.title}
                            </span>
                            <span className="mt-0.5 block text-[10px] opacity-80">
                              {project?.name} · {project?.codename}
                            </span>
                          </span>
                          {event.done ? (
                            <Badge tone="success" className="!py-0 !text-[8px]">
                              Done
                            </Badge>
                          ) : event.overdue ? (
                            <Badge tone="danger" className="!py-0 !text-[8px]">
                              Overdue
                            </Badge>
                          ) : (
                            <ArrowUpRight size={12} className="mt-1 shrink-0 opacity-60" />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <div className="mt-5">
                  <EmptyState
                    icon={<CalendarClock size={18} />}
                    title="Nothing scheduled"
                    description="No stored milestones or invoice dates fall on this day. External calendar events are unavailable because no provider is connected."
                    action={
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAddOpen(true)}
                      >
                        <Plus size={12} /> Add a local deadline
                      </Button>
                    }
                  />
                </div>
              )}

              <div className="mt-5 rounded-xl border border-[#eae5dc] bg-[#fbfaf7] p-3.5">
                <p className="text-[10.5px] leading-relaxed text-muted">
                  Drag-to-reschedule is intentionally disabled until Google
                  Calendar write access is connected and each change is
                  confirmed. No hidden calendar writes happen here.
                </p>
              </div>
            </div>
          ) : null}

          {view === "agenda" ? (
            <div className="p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold">Next up</p>
                <span className="font-mono text-[9.5px] text-muted">
                  {upcoming.length} shown
                </span>
              </div>
              {upcoming.length ? (
                <ul className="mt-3 divide-y divide-[#f0ece5]">
                  {upcoming.map((event) => {
                    const project = projects.find(
                      (item) => item.id === event.projectId,
                    );
                    return (
                      <li key={event.id}>
                        <Link
                          href={`/app/projects/${event.projectId}`}
                          className="group flex items-center gap-3 py-3"
                        >
                          <div className="flex w-14 shrink-0 flex-col items-center rounded-lg border border-[#eae5dc] bg-[#fbfaf7] py-1">
                            <span className="font-mono text-[8.5px] uppercase tracking-wider text-muted">
                              {formatDate(event.date, "MMM")}
                            </span>
                            <span className="text-[15px] font-semibold leading-tight">
                              {formatDate(event.date, "d")}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] font-semibold group-hover:text-orange">
                              {event.title}
                            </p>
                            <p className="mt-0.5 text-[10px] text-muted">
                              {project?.name} · {event.time} ·{" "}
                              {event.type === "invoice" ? "Payment" : "Milestone"}
                            </p>
                          </div>
                          {event.overdue ? (
                            <Badge tone="danger" className="!py-0 !text-[8px]">
                              Overdue
                            </Badge>
                          ) : event.done ? (
                            <Badge tone="success" className="!py-0 !text-[8px]">
                              Done
                            </Badge>
                          ) : (
                            <ArrowUpRight size={12} className="shrink-0 text-muted" />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState
                  compact
                  icon={<CalendarClock size={16} />}
                  title="No upcoming deadlines"
                  description="Everything filtered into this view is already done or outside the stored records."
                />
              )}
            </div>
          ) : null}
        </Panel>

        <div className="space-y-4">
          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#ece8e0] px-4 py-3">
              <h3 className="text-[13px] font-semibold">
                {formatDate(selectedDate, "EEE d MMM")}
              </h3>
              <Badge tone="neutral" className="!py-0 !text-[8.5px]">
                {selectedEvents.length} item{selectedEvents.length === 1 ? "" : "s"}
              </Badge>
            </div>
            {selectedEvents.length ? (
              <ul className="divide-y divide-[#f0ece5]">
                {selectedEvents.map((event) => {
                  const project = projects.find(
                    (item) => item.id === event.projectId,
                  );
                  return (
                    <li key={event.id}>
                      <Link
                        href={`/app/projects/${event.projectId}`}
                        className="block px-4 py-3 transition hover:bg-[#fbfaf7]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[8.5px] uppercase tracking-wider text-muted">
                            {event.type === "invoice"
                              ? "Payment"
                              : event.type === "local"
                                ? "Local deadline"
                                : "Milestone"}
                          </span>
                          <span className="font-mono text-[8.5px] text-muted">
                            {event.time}
                          </span>
                        </div>
                        <p className="mt-1 text-[11.5px] font-medium leading-snug">
                          {event.title}
                        </p>
                        <p className="mt-0.5 truncate text-[9.5px] text-muted">
                          {project?.name}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-4 py-5 text-center text-[10.5px] text-muted">
                Clear. No stored deadline on this day.
              </p>
            )}
          </Panel>

          <Panel className="p-4">
            <p className="eyebrow !text-[8.5px]">This week</p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Open", value: weekEvents.filter((event) => !event.done).length },
                { label: "Overdue", value: overdueCount },
                { label: "Done", value: doneCount },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-[#eae5dc] bg-[#fbfaf7] py-2"
                >
                  <p className="tabular text-[17px] font-semibold leading-none">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-[8.5px] uppercase tracking-wider text-muted">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[9.5px] leading-relaxed text-muted">
              Based on stored milestones and open invoices. Overdue items are
              derived from the demo date, 3 November.
            </p>
          </Panel>

          <Panel className="p-4">
            <div className="flex items-start gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone text-muted">
                <Link2Off size={14} />
              </span>
              <div>
                <p className="text-[12px] font-semibold">No external calendar</p>
                <p className="mt-1 text-[10px] leading-relaxed text-muted">
                  Google Calendar is disconnected. Visun does not know your real
                  availability and will not write events without approval.
                </p>
                <Link
                  href="/app/settings/integrations"
                  className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-orange hover:underline"
                >
                  Review integration <ArrowUpRight size={10} />
                </Link>
              </div>
            </div>
          </Panel>

          <Panel className="p-4">
            <div className="flex items-start gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow text-ink">
                <Sparkles size={14} />
              </span>
              <div>
                <p className="text-[12px] font-semibold">Need to reprioritise?</p>
                <p className="mt-1 text-[10px] leading-relaxed text-muted">
                  Ask which deadlines actually threaten delivery, not just which
                  ones are closest.
                </p>
                <button
                  onClick={() =>
                    router.push(
                      `/app/copilot?prompt=${encodeURIComponent("What is due this week and what is at risk?")}`,
                    )
                  }
                  className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-orange hover:underline"
                >
                  Ask Visun <ArrowUpRight size={10} />
                </button>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add a local deadline"
        description="This demo stores the deadline in your browser only. Google Calendar is not connected, so nothing is written externally."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={addLocalEvent}
              disabled={!newTitle.trim()}
            >
              <Plus size={12} /> Add deadline
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-muted">Title</span>
            <input
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="e.g. Send staging link to Rahul"
              className="h-10 w-full rounded-lg border border-[#e2ded6] bg-[#f8f6f1] px-3 text-[12px] outline-none transition focus:border-orange focus:bg-white"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-muted">Project</span>
            <select
              value={newProject}
              onChange={(event) => setNewProject(event.target.value)}
              className="h-10 w-full rounded-lg border border-[#e2ded6] bg-[#f8f6f1] px-3 text-[12px] outline-none focus:border-orange focus:bg-white"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-muted">Date</span>
              <input
                type="date"
                value={newDate}
                onChange={(event) => setNewDate(event.target.value)}
                className="h-10 w-full rounded-lg border border-[#e2ded6] bg-[#f8f6f1] px-3 text-[12px] outline-none focus:border-orange focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-muted">Time</span>
              <input
                type="time"
                value={newTime}
                onChange={(event) => setNewTime(event.target.value)}
                className="h-10 w-full rounded-lg border border-[#e2ded6] bg-[#f8f6f1] px-3 text-[12px] outline-none focus:border-orange focus:bg-white"
              />
            </label>
          </div>
          <p className="rounded-lg bg-[#fff8e2] px-3 py-2 text-[10px] leading-relaxed text-[#7a6b3e]">
            Local deadlines appear in this calendar with a neutral chip and are
            logged in Activity. They are not sent to any provider.
          </p>
        </div>
      </Modal>
    </div>
  );
}
