"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Laptop,
  Loader2,
  MessageSquareText,
  Server,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { ClosingCta } from "@/components/marketing/ClosingCta";
import { Kicker, Reveal } from "@/components/marketing/Motion";
import { cn } from "@/lib/utils";

const inquiryOptions = [
  { value: "personal", label: "Personal Setup" },
  { value: "studio", label: "Studio / Business Setup" },
  { value: "general", label: "General Inquiry" },
  { value: "technical", label: "Technical Support" },
] as const;

const installationOptions = [
  { value: "computer", label: "Personal Computer" },
  { value: "server", label: "Private Server / VPS" },
  { value: "unsure", label: "Need Help Deciding" },
] as const;

const osOptions = [
  { value: "windows", label: "Windows" },
  { value: "macos", label: "macOS" },
  { value: "linux", label: "Linux" },
  { value: "unsure", label: "Not Sure" },
] as const;

const fieldClass =
  "w-full rounded-xl border border-[#dcd6cc] bg-white/90 px-3.5 py-2.5 text-[12.5px] text-ink shadow-[inset_1px_1px_3px_rgba(35,31,24,0.05)] outline-none transition placeholder:text-[#a39d93] focus:border-[#b9b1a3] focus:ring-2 focus:ring-[#cfc8bc]/60";

type FieldName =
  | "fullName"
  | "email"
  | "inquiry"
  | "installation"
  | "os"
  | "message";

type FieldErrors = Partial<Record<FieldName | "form", string>>;
type Status = "idle" | "submitting" | "success" | "blocked" | "error";

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[11px] font-medium text-ink">
          {label}
        </label>
        {hint ? (
          <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-[#a39d93]">
            {hint}
          </span>
        ) : null}
      </div>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1.5 text-[10.5px] text-[#a3443c]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Select({
  id,
  value,
  onChange,
  options,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  invalid?: boolean;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        name={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-error` : undefined}
        className={cn(
          fieldClass,
          "appearance-none pr-9",
          invalid && "border-[#c56a63] ring-2 ring-[#c56a63]/25",
        )}
      >
        {options.map((option) => (
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
  );
}

export default function ContactPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [inquiry, setInquiry] = useState<string>("personal");
  const [installation, setInstallation] = useState<string>("computer");
  const [os, setOs] = useState<string>("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [serverMessage, setServerMessage] = useState("");
  // A ref, unlike `status`, is updated synchronously. Two quick submits in the
  // same tick can both read a stale "idle" state, so this guard is the real lock.
  const inFlight = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("inquiry");
    if (requested === "sales") {
      setInquiry("personal");
      return;
    }
    if (inquiryOptions.some((option) => option.value === requested)) {
      setInquiry(requested as string);
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
    if (!installationOptions.some((option) => option.value === installation)) {
      next.installation = "Choose a preferred installation type.";
    }
    if (!osOptions.some((option) => option.value === os)) {
      next.os = "Choose an operating system.";
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
          installation,
          os,
          message: message.trim(),
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
            "Contact delivery is not configured in this installation. Nothing was sent.",
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
    setFullName("");
    setEmail("");
    setCompany("");
    setInquiry("personal");
    setInstallation("computer");
    setOs("");
    setMessage("");
  };

  const invalid = (field: FieldName) => Boolean(errors[field]);

  return (
    <>
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
            <Kicker>Installation requests</Kicker>
            <h1 className="mt-5 font-sans text-[clamp(2.8rem,6.8vw,5.7rem)] font-semibold leading-[0.93] tracking-[-0.045em]">
              Get Visun onto
              <span className="mt-1 block font-serif font-normal italic tracking-[-0.03em] text-orange">
                your own machine.
              </span>
            </h1>
            <p className="mt-5 max-w-lg text-[14px] leading-relaxed text-[#5f5a53]">
              Tell us where you want Visun installed, what you run today, and
              which integrations matter. We reply with next steps and a direct
              quote. No account is required to ask.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {[
                "Personal Setup",
                "Studio / Business",
                "General Inquiry",
                "Technical Support",
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
                  What happens next
                </span>
                <Sparkles size={13} className="text-orange" aria-hidden="true" />
              </div>
              <ul className="mt-4 space-y-4">
                {[
                  {
                    title: "We read the details",
                    body: "Your OS, preferred host, and integrations reach the Visun owner directly.",
                    icon: MessageSquareText,
                  },
                  {
                    title: "A direct reply",
                    body: "We answer the email you provide with scope questions or a quote.",
                    icon: Sparkles,
                  },
                  {
                    title: "Private installation",
                    body: "After agreement, Visun is installed with your own keys and database.",
                    icon: ShieldCheck,
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

      <section className="mx-auto max-w-[1320px] px-5 pb-14 pt-4 sm:px-6 lg:pb-20">
        <div className="grid gap-4 lg:grid-cols-[1.18fr_0.82fr]">
          <div className="rounded-[28px] border border-[#ded9cf] bg-white/85 p-5 shadow-[0_28px_60px_-34px_rgba(35,31,24,0.4)] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[#8f8a80]">
                  Installation request
                </p>
                <h2 className="mt-2 font-serif text-[clamp(1.8rem,3vw,2.5rem)] leading-none tracking-[-0.02em]">
                  Tell us about the setup.
                </h2>
              </div>
              <span className="hidden rounded-full border border-[#e6dfae] bg-yellow/60 px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-[#6d5a13] sm:inline-flex">
                No auto-charge
              </span>
            </div>

            {status === "success" ? (
              <div className="mt-5 rounded-2xl border border-[#b9dfcb] bg-[#eaf6ef] p-5">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-[#1c6142]">
                  <CheckCircle2 size={16} aria-hidden="true" />
                  Request accepted
                </p>
                <p className="mt-2 text-[12px] leading-relaxed text-[#3d6f55]">
                  Your installation request was accepted for delivery. We’ll
                  reply to the email address you provided. No account was
                  created and no payment was taken.
                </p>
                <button
                  type="button"
                  onClick={reset}
                  className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#9ccfb4] bg-white px-3.5 text-[11px] font-medium text-[#1c6142] transition hover:bg-[#f7fcf9] active:translate-y-px"
                >
                  Send another request
                  <ArrowRight size={12} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <form className="mt-5" onSubmit={onSubmit} noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full name" htmlFor="fullName" error={errors.fullName}>
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
                    <Select
                      id="inquiry"
                      value={inquiry}
                      onChange={setInquiry}
                      options={inquiryOptions}
                      invalid={invalid("inquiry")}
                    />
                  </Field>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Preferred installation"
                    htmlFor="installation"
                    error={errors.installation}
                  >
                    <Select
                      id="installation"
                      value={installation}
                      onChange={setInstallation}
                      options={installationOptions}
                      invalid={invalid("installation")}
                    />
                  </Field>

                  <Field
                    label="Operating system"
                    htmlFor="os"
                    error={errors.os}
                  >
                    <Select
                      id="os"
                      value={os}
                      onChange={setOs}
                      options={osOptions}
                      invalid={invalid("os")}
                    />
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
                      placeholder="What do you want Visun to run, and which integrations need to work?"
                      className={cn(
                        fieldClass,
                        "resize-y",
                        errors.message && "border-[#c56a63] ring-2 ring-[#c56a63]/25",
                      )}
                    />
                  </Field>
                </div>

                {/* Honeypot: hidden from people, tempting to bots. */}
                <div className="absolute -left-[9999px] top-auto h-0 w-0 overflow-hidden" aria-hidden="true">
                  <label htmlFor="website">Website</label>
                  <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
                </div>

                {serverMessage ? (
                  <div
                    role="alert"
                    className={cn(
                      "mt-4 flex items-start gap-2 rounded-xl border px-3.5 py-3 text-[11px] leading-relaxed",
                      status === "blocked" || status === "error"
                        ? "border-[#e7c9c4] bg-[#fdf1ef] text-[#8b3e36]"
                        : "border-[#e4dfd6] bg-[#faf9f6] text-[#6f6a62]",
                    )}
                  >
                    <MessageSquareText size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                    {serverMessage}
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <p className="max-w-[280px] text-[9.5px] leading-relaxed text-[#8f8a80]">
                    Submitted details are emailed to the Visun owner. They are
                    not stored in a marketing database.
                  </p>
                  <button
                    type="submit"
                    disabled={status === "submitting"}
                    className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#e24f00] bg-orange px-5 text-[12.5px] font-semibold text-ink shadow-[0_14px_28px_-14px_rgba(255,90,0,0.8)] transition hover:bg-[#ff6d1f] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {status === "submitting" ? (
                      <>
                        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                        Sending
                      </>
                    ) : (
                      <>
                        Send installation request
                        <ArrowRight size={14} aria-hidden="true" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <div className="rounded-[24px] border border-[#ded9cf] bg-white/80 p-5">
              <p className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[#8f8a80]">
                Supported hosts
              </p>
              <ul className="mt-3 space-y-3">
                {[
                  {
                    title: "Windows",
                    body: "Docker Desktop with the WSL2 backend.",
                    icon: Laptop,
                  },
                  {
                    title: "macOS",
                    body: "Docker Desktop or another compatible container runtime.",
                    icon: Laptop,
                  },
                  {
                    title: "Linux",
                    body: "Docker Engine with the Compose plugin.",
                    icon: Server,
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
              <p className="mt-4 border-t border-[#ece7de] pt-3 text-[9.5px] leading-relaxed text-[#8f8a80]">
                Compatibility is verified per installation. ARM64 and AMD64
                images are intended, but untested platforms are stated as
                untested rather than promised.
              </p>
            </div>

            <div className="rounded-[24px] border border-[#e6dfae] bg-yellow/50 p-5">
              <p className="flex items-center gap-1.5 font-mono text-[8.5px] uppercase tracking-[0.14em] text-[#7b671c]">
                <ShieldCheck size={12} aria-hidden="true" />
                Before you send
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-[#6b581b]">
                Never include API keys, passwords, or private keys in this
                form. Credentials are configured separately during your
                installation.
              </p>
            </div>
          </div>
        </div>
      </section>

      <ClosingCta
        title={
          <>
            Not ready to install?
            <span className="block font-serif italic">Try the demo first.</span>
          </>
        }
        copy="The seeded workspace costs nothing and needs no account. Explore the agent and approval flow before requesting a private setup."
        secondaryHref="/pricing"
        secondaryLabel="Compare installation options"
      />
    </>
  );
}
