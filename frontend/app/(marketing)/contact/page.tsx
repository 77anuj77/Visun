"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Bug,
  CheckCircle2,
  ChevronDown,
  Loader2,
  MessageSquareText,
  Send,
  Sparkles,
} from "lucide-react";
import { ClosingCta } from "@/components/marketing/ClosingCta";
import { Kicker, Reveal } from "@/components/marketing/Motion";
import { cn } from "@/lib/utils";

const inquiryOptions = [
  { value: "general", label: "General inquiry" },
  { value: "sales", label: "Sales and plan scope" },
  { value: "technical", label: "Technical support" },
  { value: "feedback", label: "Product feedback" },
] as const;

const fieldClass =
  "w-full rounded-xl border border-[#dcd6cc] bg-white/90 px-3.5 py-2.5 text-[12.5px] text-ink shadow-[inset_1px_1px_3px_rgba(35,31,24,0.05)] outline-none transition placeholder:text-[#a39d93] focus:border-[#b9b1a3] focus:ring-2 focus:ring-[#cfc8bc]/60";

type FieldErrors = Partial<
  Record<"fullName" | "email" | "inquiry" | "message" | "form", string>
>;

type Status = "idle" | "submitting" | "success" | "blocked" | "error";

export default function ContactPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [inquiry, setInquiry] = useState<string>("general");
  const [message, setMessage] = useState("");
  const [planNote, setPlanNote] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [serverMessage, setServerMessage] = useState("");
  // A ref, unlike `status`, is updated synchronously. Two quick submits in the
  // same tick can both read a stale "idle" state, so this guard is the real lock.
  const inFlight = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("inquiry");
    if (requested && inquiryOptions.some((option) => option.value === requested)) {
      setInquiry(requested);
    }
    const plan = params.get("plan");
    if (plan === "pro" || plan === "team") {
      setPlanNote(
        plan === "pro"
          ? "You came from the Pro plan card."
          : "You came from the Team plan card.",
      );
    }
  }, []);

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (fullName.trim().length < 2) next.fullName = "Enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      next.email = "Enter a valid email address.";
    }
    if (!inquiryOptions.some((option) => option.value === inquiry)) {
      next.inquiry = "Choose an inquiry type.";
    }
    const trimmed = message.trim();
    if (trimmed.length < 10) next.message = "Add at least 10 characters.";
    if (trimmed.length > 2000) next.message = "Keep the message under 2,000 characters.";
    return next;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current || status === "submitting" || status === "success") {
      return;
    }

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setStatus("idle");
      setServerMessage("");
      return;
    }

    inFlight.current = true;
    setStatus("submitting");
    setServerMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const honeypot = String(formData.get("website") ?? "");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          company: company.trim(),
          inquiry,
          message: message.trim(),
          plan: planNote ? new URLSearchParams(window.location.search).get("plan") : null,
          website: honeypot,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            configured?: boolean;
            error?: string;
            fields?: Record<string, string>;
          }
        | null;

      if (response.ok && payload?.ok) {
        setStatus("success");
        setErrors({});
        setServerMessage("");
        return;
      }

      if (payload?.fields) {
        setErrors(payload.fields as FieldErrors);
      }

      if (response.status === 503) {
        setStatus("blocked");
        setServerMessage(
          payload?.error ??
            "Contact delivery is not configured in this build. Nothing was sent.",
        );
        return;
      }

      setStatus("error");
      setServerMessage(
        payload?.error ??
          "The message could not be submitted. Nothing was confirmed.",
      );
    } catch {
      setStatus("error");
      setServerMessage(
        "The network request failed. Nothing was confirmed — please try again.",
      );
    } finally {
      inFlight.current = false;
    }
  };

  const reset = () => {
    inFlight.current = false;
    setStatus("idle");
    setServerMessage("");
    setErrors({});
    setMessage("");
  };

  const invalid = (field: keyof FieldErrors) =>
    Boolean(errors[field]);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pb-8 pt-10 sm:pt-14 lg:pb-12 lg:pt-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-[420px] max-w-[1320px]"
        >
          <span className="absolute -left-20 top-4 h-60 w-60 rounded-full bg-yellow/35 blur-3xl" />
          <span className="absolute right-0 top-16 h-64 w-64 rounded-full bg-orange/12 blur-3xl" />
        </div>

        <div className="relative mx-auto grid max-w-[1320px] gap-10 px-5 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <Kicker>Contact</Kicker>
            <h1 className="mt-5 font-sans text-[clamp(2.8rem,6.8vw,5.7rem)] font-semibold leading-[0.93] tracking-[-0.045em]">
              Tell us what’s
              <span className="mt-1 block font-serif font-normal italic tracking-[-0.03em] text-orange">
                actually in the way.
              </span>
            </h1>
            <p className="mt-5 max-w-lg text-[14px] leading-relaxed text-[#5f5a53]">
              Ask about a plan, report something broken, or describe the
              workflow you want to run. This build has no invented inbox: if
              delivery is not configured, the form will say so plainly.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {[
                "General inquiry",
                "Sales",
                "Technical support",
                "Feedback",
              ].map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-[#dcd7cd] bg-white/70 px-3 py-1.5 text-[10.5px] text-[#6f6a62]"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          <Reveal delay={0.08}>
            <div className="relative mx-auto max-w-[320px] rotate-[-2deg] rounded-[24px] border border-[#ded9cf] bg-white p-5 shadow-[0_28px_60px_-30px_rgba(35,31,24,0.4)]">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[#8f8a80]">
                  Where messages go
                </span>
                <Send size={13} className="text-orange" aria-hidden="true" />
              </div>
              <ul className="mt-4 space-y-4">
                {[
                  {
                    title: "Technical support",
                    body: "GitHub Issues is the reliable channel for bugs and setup problems.",
                    icon: Bug,
                  },
                  {
                    title: "Sales and scope",
                    body: "This form, once a delivery endpoint is configured.",
                    icon: Sparkles,
                  },
                  {
                    title: "No fake addresses",
                    body: "There is no public email or social link in this build.",
                    icon: MessageSquareText,
                  },
                ].map((row) => {
                  const Icon = row.icon;
                  return (
                    <li key={row.title} className="flex gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#e6e1d8] bg-[#faf9f6] text-[#6f6a62]">
                        <Icon size={13} aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-[11px] font-semibold">{row.title}</p>
                        <p className="mt-0.5 text-[10px] leading-relaxed text-[#7a756c]">
                          {row.body}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Form + support */}
      <section className="mx-auto max-w-[1320px] px-5 pb-14 pt-4 sm:px-6 lg:pb-20">
        <div className="grid gap-4 lg:grid-cols-[1.18fr_0.82fr]">
          <div className="rounded-[28px] border border-[#ded9cf] bg-white/85 p-5 shadow-[0_28px_60px_-34px_rgba(35,31,24,0.4)] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[#8f8a80]">
                  Message form
                </p>
                <h2 className="mt-2 font-serif text-[clamp(1.8rem,3vw,2.5rem)] leading-none tracking-[-0.02em]">
                  Start a conversation.
                </h2>
              </div>
              {planNote ? (
                <span className="rounded-full border border-[#e6dfae] bg-yellow/60 px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-[#6d5a13]">
                  {planNote}
                </span>
              ) : null}
            </div>

            {status === "success" ? (
              <div className="mt-5 rounded-2xl border border-[#b9dfcb] bg-[#eaf6ef] p-5">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-[#1c6142]">
                  <CheckCircle2 size={16} aria-hidden="true" />
                  Message accepted
                </p>
                <p className="mt-2 text-[12px] leading-relaxed text-[#3d6f55]">
                  The configured contact endpoint accepted your message. That is
                  the only confirmation this build can give — there is no shared
                  inbox to check here.
                </p>
                <button
                  type="button"
                  onClick={reset}
                  className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#9ccfb4] bg-white px-3.5 text-[11px] font-medium text-[#1c6142] transition hover:bg-[#f7fcf9] active:translate-y-px"
                >
                  Send another message
                  <ArrowRight size={12} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <form className="mt-5" onSubmit={onSubmit} noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Full name"
                    htmlFor="fullName"
                    error={errors.fullName}
                  >
                    <input
                      id="fullName"
                      name="fullName"
                      type="text"
                      autoComplete="name"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      aria-invalid={invalid("fullName")}
                      aria-describedby={
                        errors.fullName ? "fullName-error" : undefined
                      }
                      placeholder="Your name"
                      className={cn(
                        fieldClass,
                        errors.fullName && "border-[#c56a63] ring-2 ring-[#c56a63]/25",
                      )}
                    />
                  </Field>

                  <Field label="Email" htmlFor="email" error={errors.email}>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      aria-invalid={invalid("email")}
                      aria-describedby={errors.email ? "email-error" : undefined}
                      placeholder="you@studio.com"
                      className={cn(
                        fieldClass,
                        errors.email && "border-[#c56a63] ring-2 ring-[#c56a63]/25",
                      )}
                    />
                  </Field>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Company or workspace"
                    htmlFor="company"
                    hint="Optional"
                  >
                    <input
                      id="company"
                      name="company"
                      type="text"
                      autoComplete="organization"
                      value={company}
                      onChange={(event) => setCompany(event.target.value)}
                      placeholder="Your studio"
                      className={fieldClass}
                    />
                  </Field>

                  <Field
                    label="Inquiry type"
                    htmlFor="inquiry"
                    error={errors.inquiry}
                  >
                    <div className="relative">
                      <select
                        id="inquiry"
                        name="inquiry"
                        value={inquiry}
                        onChange={(event) => setInquiry(event.target.value)}
                        aria-invalid={invalid("inquiry")}
                        aria-describedby={
                          errors.inquiry ? "inquiry-error" : undefined
                        }
                        className={cn(fieldClass, "appearance-none pr-9")}
                      >
                        {inquiryOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={14}
                        aria-hidden="true"
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8f8a80]"
                      />
                    </div>
                  </Field>
                </div>

                <div className="mt-4">
                  <Field
                    label="Message"
                    htmlFor="message"
                    error={errors.message}
                    hint={`${message.trim().length}/2000`}
                  >
                    <textarea
                      id="message"
                      name="message"
                      rows={6}
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      aria-invalid={invalid("message")}
                      aria-describedby={errors.message ? "message-error" : undefined}
                      placeholder="What are you trying to run, fix, or understand?"
                      className={cn(
                        fieldClass,
                        "resize-y",
                        errors.message && "border-[#c56a63] ring-2 ring-[#c56a63]/25",
                      )}
                    />
                  </Field>
                </div>

                {/* Honeypot: hidden from people, tempting to bots. */}
                <div className="sr-only" aria-hidden="true">
                  <label htmlFor="website">Website</label>
                  <input
                    id="website"
                    name="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </div>

                {errors.form ? (
                  <p role="alert" className="mt-3 text-[11px] text-[#b64038]">
                    {errors.form}
                  </p>
                ) : null}

                {status === "blocked" ? (
                  <div
                    role="alert"
                    className="mt-4 flex gap-2.5 rounded-xl border border-[#e6dfae] bg-yellow/60 p-3.5"
                  >
                    <AlertCircle
                      size={15}
                      className="mt-0.5 shrink-0 text-[#7b671c]"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-[11.5px] font-semibold text-[#6d5a13]">
                        Nothing was sent
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-[#6d5a13]">
                        {serverMessage} A delivery endpoint has not been
                        configured for this build, so the form does not pretend
                        otherwise.
                      </p>
                      <a
                        href="https://github.com/77anuj77/Visun/issues"
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-ink underline decoration-[#8a6d00]/40 underline-offset-4 hover:decoration-[#8a6d00]"
                      >
                        Use GitHub Issues instead
                        <ArrowUpRight size={11} aria-hidden="true" />
                      </a>
                    </div>
                  </div>
                ) : null}

                {status === "error" ? (
                  <div
                    role="alert"
                    className="mt-4 flex gap-2.5 rounded-xl border border-[#e7c4c1] bg-[#fbeceb] p-3.5"
                  >
                    <AlertCircle
                      size={15}
                      className="mt-0.5 shrink-0 text-[#b64038]"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-[11.5px] font-semibold text-[#8f302b]">
                        Message not confirmed
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-[#8f302b]">
                        {serverMessage}
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={status === "submitting"}
                    className="group inline-flex h-11 items-center gap-2 rounded-xl border border-black bg-ink px-5 text-[12.5px] font-semibold text-canvas transition hover:bg-[#2a2a2a] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {status === "submitting" ? (
                      <>
                        <Loader2
                          size={14}
                          className="animate-spin"
                          aria-hidden="true"
                        />
                        Sending…
                      </>
                    ) : (
                      <>
                        Send message
                        <Send
                          size={13}
                          aria-hidden="true"
                          className="transition-transform group-hover:translate-x-0.5"
                        />
                      </>
                    )}
                  </button>
                  <p className="text-[10px] leading-relaxed text-[#8f8a80]">
                    No marketing email. No invented inbox. Fields are validated
                    here and again on the server.
                  </p>
                </div>
              </form>
            )}
          </div>

          {/* Support channels */}
          <div className="flex flex-col gap-3">
            <div className="rounded-[24px] border border-[#ded9cf] bg-[#f4f1ea] p-5">
              <p className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[#8f8a80]">
                Support channels
              </p>
              <ul className="mt-4 space-y-2.5">
                <SupportLink
                  href="https://github.com/77anuj77/Visun/issues"
                  icon={Bug}
                  title="Report a bug"
                  detail="GitHub Issues · the reliable technical channel"
                />
                <SupportLink
                  href="https://github.com/77anuj77/Visun/blob/main/SETUP.md"
                  icon={BookOpen}
                  title="Setup and configuration"
                  detail="Clerk, FastAPI, and demo-mode notes"
                />
                <SupportLink
                  href="/pricing"
                  icon={Sparkles}
                  title="Plan questions"
                  detail="See the proposed scopes and pricing disclosure"
                  internal
                />
                <SupportLink
                  href="https://github.com/77anuj77/Visun"
                  icon={MessageSquareText}
                  title="Read the source"
                  detail="The repository is public"
                />
              </ul>
            </div>

            <div className="rounded-[24px] border border-[#e6dfae] bg-yellow/55 p-5">
              <p className="flex items-center gap-1.5 font-mono text-[8.5px] uppercase tracking-[0.14em] text-[#7b671c]">
                <AlertCircle size={11} aria-hidden="true" />
                How this actually works
              </p>
              <ul className="mt-3 space-y-2 text-[10.5px] leading-relaxed text-[#6b581b]">
                {[
                  "Messages post to /api/contact with server-side validation.",
                  "Without CONTACT_WEBHOOK_URL, the server returns 503 and the form says nothing was sent.",
                  "A honeypot and a small rate limit guard against spam.",
                  "There is no public support email or social account in this build.",
                ].map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#8a6d00]" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <ClosingCta
        title={
          <>
            Prefer to see it first?
            <span className="block font-serif italic">Open the demo.</span>
          </>
        }
        copy="The seeded workspace needs no card and no message. Ask a question, inspect the tool calls, and approve the exact next step yourself."
        secondaryHref="/pricing"
        secondaryLabel="Compare plans"
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Small field + link helpers                                                 */
/* -------------------------------------------------------------------------- */

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label
          htmlFor={htmlFor}
          className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-[#6f6a62]"
        >
          {label}
        </label>
        {hint ? (
          <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[#a39d93]">
            {hint}
          </span>
        ) : null}
      </div>
      {children}
      {error ? (
        <p
          id={`${htmlFor}-error`}
          className="mt-1.5 flex items-center gap-1 text-[10px] text-[#b64038]"
        >
          <AlertCircle size={10} aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SupportLink({
  href,
  icon: Icon,
  title,
  detail,
  internal,
}: {
  href: string;
  icon: typeof Bug;
  title: string;
  detail: string;
  internal?: boolean;
}) {
  const className =
    "group flex items-start gap-3 rounded-xl border border-[#e2ddd3] bg-white/75 p-3 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-neu-sm";
  const body = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#e6e1d8] bg-[#faf9f6] text-[#6f6a62] transition group-hover:text-orange">
        <Icon size={13} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1 text-[11.5px] font-semibold text-ink">
          {title}
          <ArrowUpRight
            size={11}
            aria-hidden="true"
            className="text-[#a39d93] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-orange"
          />
        </span>
        <span className="mt-0.5 block text-[9.5px] leading-relaxed text-[#7a756c]">
          {detail}
        </span>
      </span>
    </>
  );

  if (internal) {
    return (
      <li>
        <Link href={href} className={className}>
          {body}
        </Link>
      </li>
    );
  }

  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={className}
      >
        {body}
      </a>
    </li>
  );
}
